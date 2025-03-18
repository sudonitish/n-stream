let player;
const urlInput = document.getElementById('urlInput');
const playButton = document.getElementById('playButton');
const roomInput = document.getElementById('roomInput');
const joinButton = document.getElementById('joinButton');
const createRoomDiv = document.getElementById('createRoomDiv');
const roomDiv = document.getElementById('roomDiv');
const socket = io(); // Connect to the server
let roomId = null;
const playlist = [
    "https://youtu.be/y12BRDS1CHI",
    "https://youtu.be/2Vv-BfVoq4g",
    "https://youtu.be/2Vv-BfVoq4g",
    "https://youtu.be/2Vv-BfVoq4g",
]
let playing = null;

playButton.onclick = () => {
    const videoUrl = urlInput.value;
    const videoId = getYouTubeVideoId(videoUrl);
    if (videoId) {
        playlist.push(videoId);
    } else {
        console.error('Invalid YouTube URL');
    }
}

joinButton.onclick = () => {
    const room = roomInput.value;
    roomId = room;
    socket.emit('room', 'join', roomId);
    createRoomDiv.style.display = 'block';
    roomDiv.style.display = 'none';
}
leaveButton.onclick = () => {
    socket.emit('room', 'leave', roomId);
    roomId = null;
    createRoomDiv.style.display = 'none';
    roomDiv.style.display = 'block';
}

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('change_media', ({ roomId, videoId }) => {
    player.loadVideoById({
        videoId: videoId,
        startSeconds: 0,
        suggestedQuality: 'hd720'
    });
});

socket.on('sync_action', ({ action, time }) => {
    if (action === 'play') {
        player.seekTo(time, true);
        player.playVideo();
    } else if (action === 'pause') {
        player.pauseVideo();
    } else if (action === 'seek') {
        player.seekTo(time, true);
    }
});

socket.on('sync_state', ({ videoId, time, action, timestamp }) => {
    const now = Date.now();
    const stateAge = now - timestamp;

    // Only sync if the state is recent (e.g., within the last 10 seconds)
    if (stateAge <= 10000 && videoId) {
        player.loadVideoById({
            videoId: videoId,
            startSeconds: time || 0,
            suggestedQuality: 'hd720'
        });

        if (action === 'play') {
            player.playVideo();
        } else if (action === 'pause') {
            player.pauseVideo();
        }
    } else {
        console.warn('State is outdated, not syncing.');
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

function getYouTubeVideoId(url) {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.slice(1);
    } else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
        return urlObj.searchParams.get('v');
    }
    return null;
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '315',
        width: '560',
        videoId: playing,
        playerVars: { 'playsinline': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
}

function onPlayerStateChange(event) {
    const playerState = event.data;
    const currentTime = player.getCurrentTime();

    if (playerState === YT.PlayerState.PLAYING) {
        socket.emit('sync_action', { action: 'play', time: currentTime, roomId });
    } else if (playerState === YT.PlayerState.PAUSED) {
        socket.emit('sync_action', { action: 'pause', time: currentTime, roomId });
    } else if (playerState === YT.PlayerState.BUFFERING) {
        socket.emit('sync_action', { action: 'seek', time: currentTime, roomId });
    }
}

