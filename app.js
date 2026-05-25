// JUICY BULLETPROOF REBUILD ENGINE - CREDENTIALS INJECTED
const SUPABASE_URL = "https://eajljmltosdxlruxwasr.supabase.co";
const SUPABASE_KEY = "sb_publishable_fX0uXrdAFLB3VtMGItkWrw_uZ1C40aK";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null; 
let activeRoomId = null; 
let localStream = null;
let peerConnection = null;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

document.addEventListener("DOMContentLoaded", () => {
    // Basic test to confirm the script is alive
    console.log("Juicy Core Engine Initialized.");
});

// ==========================================
// PHASE 1: SAFE REGISTRATION & LOGIN
// ==========================================
async function handleRegister() {
    const user = document.getElementById('authUser').value.trim();
    const pass = document.getElementById('authPass').value.trim();
    const status = document.getElementById('authStatus');

    if(!user || !pass) return status.innerText = "Please enter both fields.";

    status.innerText = "Connecting to database...";
    
    try {
        const { data, error } = await _supabase
            .from('juicy_profiles')
            .insert([{ username: user, password: pass }])
            .select();

        if(error) throw error;
        status.innerText = "Registration complete! You can now log in.";
    } catch (err) {
        console.error(err);
        status.innerText = "Username taken or system database connection busy.";
    }
}

async function handleLogin() {
    const user = document.getElementById('authUser').value.trim();
    const pass = document.getElementById('authPass').value.trim();
    const status = document.getElementById('authStatus');

    try {
        const { data, error } = await _supabase
            .from('juicy_profiles')
            .select('*')
            .eq('username', user)
            .eq('password', pass);

        if(error) throw error;
        
        if(!data || data.length === 0) {
            status.innerText = "Incorrect username or password.";
            return;
        }

        currentUser = data[0];
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        document.getElementById('myIdTag').innerText = `ID: ${currentUser.juicy_id}`;

        // Load structures safely
        loadUserRoomsList();
        listenForGlobalRealtimeEvents();
        
    } catch (err) {
        console.error(err);
        status.innerText = "Failed to communicate with Supabase database.";
    }
}

// ==========================================
// PHASE 2: RELATIONSHIPS & MATCHING Engine
// ==========================================
async function addFriendById() {
    const targetId = parseInt(document.getElementById('friendIdInput').value.trim());
    if(!targetId) return alert("Enter a 9-digit number ID.");

    try {
        const { data: profiles, error } = await _supabase
            .from('juicy_profiles')
            .select('*')
            .eq('juicy_id', targetId);

        if(error || !profiles || profiles.length === 0) return alert("No user matches that ID.");
        const targetFriend = profiles[0];

        if(targetFriend.id === currentUser.id) return alert("You cannot add your own ID.");

        const { data: newRoom, error: roomErr } = await _supabase
            .from('juicy_rooms')
            .insert([{ room_name: `${currentUser.username} & ${targetFriend.username}`, is_group: false }])
            .select();

        if(roomErr) throw roomErr;
        const roomId = newRoom[0].id;

        await _supabase.from('juicy_room_members').insert([
            { room_id: roomId, user_uuid: currentUser.id },
            { room_id: roomId, user_uuid: targetFriend.id }
        ]);

        document.getElementById('friendIdInput').value = '';
        alert("Friend added! Click on their chat name in your list.");
        loadUserRoomsList();
    } catch(err) {
        console.error(err);
        alert("Failed to build relation channel layout.");
    }
}

async function createGroupChat() {
    const title = document.getElementById('groupNameInput').value.trim();
    if(!title) return alert("Enter a group title.");

    try {
        const { data: groupRoom, error } = await _supabase
            .from('juicy_rooms')
            .insert([{ room_name: title, is_group: true }])
            .select();

        if(error) throw error;
        const roomId = groupRoom[0].id;
        
        await _supabase.from('juicy_room_members').insert([{ room_id: roomId, user_uuid: currentUser.id }]);

        document.getElementById('groupNameInput').value = '';
        alert("Group channel created!");
        loadUserRoomsList();
    } catch(err) {
        console.error(err);
        alert("Group creation error.");
    }
}

// ==========================================
// PHASE 3: SECURE TEXT TRANSPORTS
// ==========================================
async function loadUserRoomsList() {
    try {
        const { data: memberships, error } = await _supabase
            .from('juicy_room_members')
            .select('room_id')
            .eq('user_uuid', currentUser.id);

        const container = document.getElementById('roomsContainer');
        container.innerHTML = '';

        if(error || !memberships || memberships.length === 0) return;
        const ids = memberships.map(m => m.room_id);

        const { data: rooms } = await _supabase.from('juicy_rooms').select('*').in('id', ids);
        if(!rooms) return;

        rooms.forEach(room => {
            const btn = document.createElement('button');
            btn.innerText = room.is_group ? `👥 ${room.room_name}` : `💬 Private Chat`;
            if(room.id === activeRoomId) btn.className = 'active';
            btn.onclick = () => switchActiveChatRoom(room.id, room.room_name);
            container.appendChild(btn);
        });
    } catch(err) { console.error(err); }
}

async function switchActiveChatRoom(roomId, roomName) {
    activeRoomId = roomId;
    document.getElementById('activeChatHeader').innerText = roomName;
    document.getElementById('msgInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;

    // Highlight selected button
    const buttons = document.querySelectorAll('#roomsContainer button');
    buttons.forEach(b => b.classList.remove('active'));

    try {
        const { data: messages, error } = await _supabase
            .from('juicy_messages')
            .select('*')
            .eq('room_id', activeRoomId)
            .order('created_at', { ascending: true });

        if(error) throw error;

        const stream = document.getElementById('messageStream');
        stream.innerHTML = '';
        if(messages) messages.forEach(msg => displayMessageItem(msg));
        stream.scrollTop = stream.scrollHeight;
    } catch(err) { console.error(err); }
}

async function sendTextMessage() {
    const input = document.getElementById('msgInput');
    const txt = input.value.trim();
    if(!txt || !activeRoomId) return;

    try {
        await _supabase
            .from('juicy_messages')
            .insert([{ room_id: activeRoomId, sender_username: currentUser.username, message_text: txt }]);
        input.value = '';
    } catch(err) { console.error(err); }
}

function handleKeyPress(e) { if(e.key === 'Enter') sendTextMessage(); }

function displayMessageItem(msg) {
    const stream = document.getElementById('messageStream');
    const item = document.createElement('div');
    const isMe = msg.sender_username === currentUser.username;
    item.className = `msg-item ${isMe ? 'me' : ''}`;
    item.innerHTML = `<div class="author">${isMe ? 'You' : msg.sender_username}</div><div class="content">${msg.message_text}</div>`;
    stream.appendChild(item);
    stream.scrollTop = stream.scrollHeight;
}

// ==========================================
// PHASE 4: REALTIME PIPELINE SYNCS
// ==========================================
function listenForGlobalRealtimeEvents() {
    _supabase
        .channel('juicy-realtime-cluster')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'juicy_messages' }, 
            payload => {
                if(payload.new.room_id === activeRoomId) {
                    displayMessageItem(payload.new);
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
// PHASE 5: WEBRTC MEDIA EXCEPTION PROOFING
// ==========================================
async function prepareDeviceMedia() {
    try {
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
            if(e.candidate && activeRoomId) {
                await _supabase.from('juicy_signaling').insert([
                    { room_id: activeRoomId, sender_uuid: currentUser.id, type: 'candidate', payload: JSON.parse(JSON.stringify(e.candidate)) }
                ]);
            }
        };
    } catch (hardwareError) {
        console.error(hardwareError);
        alert("Camera Error: Please verify you are browsing via HTTPS and have allowed camera/mic hardware access privileges.");
        terminateCall();
    }
}

async function initiateVoiceVideoCall() {
    if(!activeRoomId) return alert("Please select a specific text channel room from the sidebar first before initiating a voice call link.");
    await prepareDeviceMedia();

    if(!peerConnection) return;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await _supabase.from('juicy_signaling').insert([
        { room_id: activeRoomId, sender_uuid: currentUser.id, type: 'offer', payload: JSON.parse(JSON.stringify(offer)) }
    ]);
}

async function processCallNegotiationHandshake(data) {
    if(!peerConnection && data.type === 'offer') await prepareDeviceMedia();
    if(!peerConnection) return;

    try {
        if(data.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await _supabase.from('juicy_signaling').insert([
                { room_id: activeRoomId, sender_uuid: currentUser.id, type: 'answer', payload: JSON.parse(JSON.stringify(answer)) }
            ]);
        } else if(data.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
        } else if(data.type === 'candidate') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
        }
    } catch(err) { console.error("Handshake routing slip skipped.", err); }
}

function terminateCall() {
    if(localStream) localStream.getTracks().forEach(t => t.stop());
    if(peerConnection) peerConnection.close();
    
    document.getElementById('videoGrid').classList.add('hidden');
    document.getElementById('startCallBtn').classList.remove('hidden');
    document.getElementById('hangupBtn').classList.add('hidden');
}
