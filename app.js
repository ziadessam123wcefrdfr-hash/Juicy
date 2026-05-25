// JUICY CONFIGURATION ENGINE - CREDENTIALS INJECTED
const SUPABASE_URL = "https://eajljmltosdxlruxwasr.supabase.co";
const SUPABASE_KEY = "sb_publishable_fX0uXrdAFLB3VtMGItkWrw_uZ1C40aK";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null; 
let activeRoomId = null; 
let localStream = null;
let peerConnection = null;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('usernameInput').value = "Guest" + Math.floor(1000 + Math.random() * 9000);
    loadChatHistory();
    listenForChanges();
});

// ==========================================
// PHASE 1: ACCOUNT MANAGEMENT & SECURITY ENGINE
// ==========================================
async function handleRegister() {
    const user = document.getElementById('authUser').value.trim();
    const pass = document.getElementById('authPass').value.trim();
    const status = document.getElementById('authStatus');

    if(!user || !pass) return status.innerText = "Provide complete parameters.";

    status.innerText = "Registering user record parameters...";
    const { data, error } = await _supabase
        .from('juicy_profiles')
        .insert([{ username: user, password: pass }])
        .select();

    if(error) {
        status.innerText = "Error: Username taken or invalid parameters.";
    } else {
        status.innerText = "Account generated successfully! Press Login.";
    }
}

async function handleLogin() {
    const user = document.getElementById('authUser').value.trim();
    const pass = document.getElementById('authPass').value.trim();
    const status = document.getElementById('authStatus');

    const { data, error } = await _supabase
        .from('juicy_profiles')
        .select('*')
        .eq('username', user)
        .eq('password', pass);

    if(error || !data || data.length === 0) {
        status.innerText = "Invalid security profile combination details.";
        return;
    }

    currentUser = data[0];
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    document.getElementById('myIdTag').innerText = `ID: ${currentUser.juicy_id}`;

    loadUserRoomsList();
    listenForGlobalRealtimeEvents();
}

// ==========================================
// PHASE 2: RELATIONSHIPS & FRIENDS LIST LOGIC
// ==========================================
async function addFriendById() {
    const targetId = parseInt(document.getElementById('friendIdInput').value.trim());
    if(!targetId) return alert("Enter a valid 9-digit identification ID.");

    const { data: profiles, error } = await _supabase
        .from('juicy_profiles')
        .select('*')
        .eq('juicy_id', targetId);

    if(error || !profiles || profiles.length === 0) return alert("User signature ID match profile not found.");
    const targetFriend = profiles[0];

    if(targetFriend.id === currentUser.id) return alert("Loop tracking failure: cannot register self.");

    const { data: newRoom } = await _supabase
        .from('juicy_rooms')
        .insert([{ room_name: `${currentUser.username} & ${targetFriend.username}`, is_group: false }])
        .select();

    const roomId = newRoom[0].id;

    await _supabase.from('juicy_room_members').insert([
        { room_id: roomId, user_uuid: currentUser.id },
        { room_id: roomId, user_uuid: targetFriend.id }
    ]);

    document.getElementById('friendIdInput').value = '';
    alert("Friend matched successfully! Private text routing open.");
    loadUserRoomsList();
}

async function createGroupChat() {
    const title = document.getElementById('groupNameInput').value.trim();
    if(!title) return alert("Provide group title labels.");

    const { data: groupRoom } = await _supabase
        .from('juicy_rooms')
        .insert([{ room_name: title, is_group: true }])
        .select();

    const roomId = groupRoom[0].id;
    await _supabase.from('juicy_room_members').insert([{ room_id: roomId, user_uuid: currentUser.id }]);

    document.getElementById('groupNameInput').value = '';
    alert("Group environment provisioned!");
    loadUserRoomsList();
}

// ==========================================
// PHASE 3: TEXT ROUTING ENGINE
// ==========================================
async function loadUserRoomsList() {
    const { data: memberships } = await _supabase
        .from('juicy_room_members')
        .select('room_id')
        .eq('user_uuid', currentUser.id);

    const container = document.getElementById('roomsContainer');
    container.innerHTML = '';

    if(!memberships || memberships.length === 0) return;
    const ids = memberships.map(m => m.room_id);

    const { data: rooms } = await _supabase.from('juicy_rooms').select('*').in('id', ids);

    rooms.forEach(room => {
        const btn = document.createElement('button');
        btn.innerText = room.is_group ? `👥 ${room.room_name}` : `💬 Private Chat`;
        btn.onclick = () => switchActiveChatRoom(room.id, room.room_name);
        if(room.id === activeRoomId) btn.className = 'active';
        container.appendChild(btn);
    });
}

async function switchActiveChatRoom(roomId, roomName) {
    activeRoomId = roomId;
    document.getElementById('activeChatHeader').innerText = roomName;
    document.getElementById('msgInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;

    loadUserRoomsList(); 

    const { data: messages } = await _supabase
        .from('juicy_messages')
        .select('*')
        .eq('room_id', activeRoomId)
        .order('created_at', { ascending: true });

    const stream = document.getElementById('messageStream');
    stream.innerHTML = '';
    if(messages) messages.forEach(msg => displayMessageItem(msg));
    stream.scrollTop = stream.scrollHeight;
}

async function sendTextMessage() {
    const input = document.getElementById('msgInput');
    const txt = input.value.trim();
    if(!txt || !activeRoomId) return;

    const { error } = await _supabase
        .from('juicy_messages')
        .insert([{ room_id: activeRoomId, sender_username: currentUser.username, message_text: txt }]);

    if(error) console.error("Transmission error details", error);
    input.value = '';
}

function handleKeyPress(e) { if(e.key === 'Enter') sendTextMessage(); }

function displayMessageItem(msg) {
    const stream = document.getElementById('messageStream');
    const item = document.createElement('div');
    const isMe = msg.sender_username === currentUser.username;
    item.className = `msg-item ${isMe ? 'me' : ''}`;
    item.innerHTML = `<div class="author">${isMe ? 'You' : msg.sender_username}</div><div class="content">${msg.message_text}</div>`;
    stream.appendChild(item);
}

// ==========================================
// PHASE 4: REALTIME PIPELINE SUBSCRIPTIONS
// ==========================================
function listenForGlobalRealtimeEvents() {
    _supabase
        .channel('juicy-realtime-cluster')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'juicy_messages' }, 
            payload => {
                if(payload.new.room_id === activeRoomId) {
                    displayMessageItem(payload.new);
                    const stream = document.getElementById('messageStream');
                    stream.scrollTop = stream.scrollHeight;
                }
            }
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'juicy_signaling' },
            payload => {
                if(payload.new.room_id === activeRoomId && payload.new.sender_uuid !== currentUser.id) {
                    processCallNegotiationHandshake(payload.new);
                }
            }
        )
        .subscribe();
}

// ==========================================
// PHASE 5: WEBRTC LIVE STREAM MEDIA ENGINE
// ==========================================
async function prepareDeviceMedia() {
    document.getElementById('videoGrid').classList.remove('hidden');
    document.getElementById('startCallBtn').classList.add('hidden');
    document.getElementById('hangupBtn').classList.remove('hidden');

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;

    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (e) => {
        document.getElementById('remoteVideo').srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = async (e) => {
        if(e.candidate) {
            await _supabase.from('juicy_signaling').insert([
                { room_id: activeRoomId, sender_uuid: currentUser.id, type: 'candidate', payload: JSON.parse(JSON.stringify(e.candidate)) }
            ]);
        }
    };
}

async function initiateVoiceVideoCall() {
    if(!activeRoomId) return alert("Select a room first.");
    await prepareDeviceMedia();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await _supabase.from('juicy_signaling').insert([
        { room_id: activeRoomId, sender_uuid: currentUser.id, type: 'offer', payload: JSON.parse(JSON.stringify(offer)) }
    ]);
}

async function processCallNegotiationHandshake(data) {
    if(!peerConnection && data.type === 'offer') await prepareDeviceMedia();

    if(data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await _supabase.from('juicy_signaling').insert([
            { room_id: activeRoomId, sender_uuid: currentUser.id, type: 'answer', payload: JSON.parse(JSON.stringify(answer)) }
        ]);
    } else if(data.type === 'answer' && peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
    } else if(data.type === 'candidate' && peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
    }
}

function terminateCall() {
    if(localStream) localStream.getTracks().forEach(t => t.stop());
    if(peerConnection) peerConnection.close();
    location.reload();
}
