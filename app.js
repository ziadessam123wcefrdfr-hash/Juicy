// PASTE YOUR REAL SUPABASE CREDS HERE:
const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_KEY = "YOUR-ANON-PUBLIC-KEY-STRING";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let localStream = null;
let peerConnection = null;

// Public Google STUN servers allow your browsers to locate each other across different internet firewalls
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

document.addEventListener("DOMContentLoaded", () => {
    // Generate a random guest number so usernames are distinct by default
    document.getElementById('usernameInput').value = "Guest" + Math.floor(1000 + Math.random() * 9000);
    loadChatHistory();
    listenForChanges();
});

// 💬 TEXT CHIP: GET HISTORICAL STREAM ROWS
async function loadChatHistory() {
    const { data: messages } = await _supabase
        .from('juicy_messages')
        .select('*')
        .order('created_at', { ascending: true });
        
    if (messages) {
        const stream = document.getElementById('messageStream');
        stream.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        stream.scrollTop = stream.scrollHeight;
    }
}

// ⚡ BROADCAST ENGINE: LISTEN TO ALL REALTIME INTERACTIVE PACKETS
function listenForChanges() {
    // Listen for text messages
    _supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'juicy_messages' }, 
            payload => {
                appendMessage(payload.new);
                const stream = document.getElementById('messageStream');
                stream.scrollTop = stream.scrollHeight;
            }
        )
        // Listen for phone call WebRTC signaling handshakes
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'juicy_signaling' },
            async (payload) => {
                handleSignalingData(payload.new);
            }
        )
        .subscribe();
}

async function sendTextMessage() {
    const input = document.getElementById('msgInput');
    const user = document.getElementById('usernameInput').value.trim();
    const text = input.value.trim();

    if (!text) return;

    await _supabase.from('juicy_messages').insert([{ username: user, message_text: text }]);
    input.value = '';
}

function handleKeyPress(e) { if (e.key === 'Enter') sendTextMessage(); }

function appendMessage(msg) {
    const stream = document.getElementById('messageStream');
    const card = document.createElement('div');
    card.className = 'msg-item';
    card.innerHTML = `<div class="author">${msg.username}</div><div class="content">${msg.message_text}</div>`;
    stream.appendChild(card);
}

// 📞 PEER-TO-PEER WEBRTC VIDEO AND AUDIO HARDWARE CALL ROUTINES
async function setupMedia() {
    document.getElementById('videoGrid').classList.remove('hidden');
    document.getElementById('startCallBtn').classList.add('hidden');
    document.getElementById('hangupBtn').classList.remove('hidden');

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;

    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            await _supabase.from('juicy_signaling').insert([{ type: 'candidate', payload: event.candidate }]);
        }
    };
}

async function startCall() {
    await setupMedia();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await _supabase.from('juicy_signaling').insert([{ type: 'offer', payload: offer }]);
}

async function handleSignalingData(data) {
    if (!peerConnection && data.type === 'offer') {
        await setupMedia();
    }

    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await _supabase.from('juicy_signaling').insert([{ type: 'answer', payload: answer }]);
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
    } else if (data.type === 'candidate' && peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
        } catch (e) { console.error("Error adding ice candidate", e); }
    }
}

function hangupCall() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (peerConnection) peerConnection.close();
    
    _supabase.from('juicy_signaling').delete().not('id', 'is', null); // Wipe handshake table clear
    
    document.getElementById('videoGrid').classList.add('hidden');
    document.getElementById('startCallBtn').classList.remove('hidden');
    document.getElementById('hangupBtn').classList.add('hidden');
    location.reload(); // Hard reset network stack
}
