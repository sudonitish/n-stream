let player;
let isProgrammatic = false;
const socket = io();
let roomId = null;

const urlInput = document.getElementById('urlInput');
const roomInput = document.getElementById('roomInput');
const uploadMediaButton = document.getElementById('uploadMediaButton');
const joinButton = document.getElementById('joinButton');
const leaveButton = document.getElementById('leaveButton');
const nextButton = document.getElementById('nextButton');
const prevButton = document.getElementById('prevButton');
const createRoomDiv = document.getElementById('createRoomDiv');
const roomDiv = document.getElementById('roomDiv');
const playlistDiv = document.getElementById('playlistDiv');

const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;

// 🎯 Event Listeners
uploadMediaButton.onclick = () => {
    const videoUrl = urlInput.value.trim();
    if (!isValidYouTubeURL(videoUrl)) {
        return alert('Invalid YouTube URL');
    }
    if (roomId) {
        socket.emit('upload_media', { videoUrl, roomId });
    }
};

joinButton.onclick = () => {
    roomId = roomInput.value.trim();
    if (!roomId) return alert("Room ID cannot be empty!");

    socket.emit('join_room', { roomId });
    createRoomDiv.style.display = 'none';
    roomDiv.style.display = 'block';
};

leaveButton.onclick = () => {
    if (roomId) {
        socket.emit('leave_room', { roomId });
        roomId = null;
    }
    createRoomDiv.style.display = 'block';
    roomDiv.style.display = 'none';
};

nextButton.onclick = () => roomId && socket.emit('change_media', { action: 'next', roomId });
prevButton.onclick = () => roomId && socket.emit('change_media', { action: 'prev', roomId });

socket.on('change_media', ({ videoId }) => {
    if (player) {
        player.loadVideoById({ videoId, startSeconds: 0, suggestedQuality: 'hd720' });
    }
});

socket.on('sync_action', ({ action, time, videoId,strict}) => {
    if (!player) return;
    const currentVideoID = player.getVideoData().video_id || null;

    isProgrammatic = true;

    if (currentVideoID !== videoId) {
        player.loadVideoById({
            videoId,
            startSeconds: time || 0,
            suggestedQuality: 'hd720'
        });

        player.addEventListener('onStateChange', function onStateChange(event) {
            if (event.data === YT.PlayerState.CUED || event.data === YT.PlayerState.PLAYING) {
                isProgrammatic = false;
                player.removeEventListener('onStateChange', onStateChange);
            }
        });
    } else {
        if(action === 'play' && player.getPlayerState() == YT.PlayerState.PLAYING && strict){
            player.seekTo(player.getCurrentTime(), true);
            player.playVideo();
        }
        else if (action === 'play' && player.getPlayerState() !== YT.PlayerState.PLAYING) {
            player.seekTo(time, true);
            player.playVideo();
        } else if (action === 'pause' && player.getPlayerState() !== YT.PlayerState.PAUSED) {
            player.pauseVideo();
        } else if (action === 'seek' && Math.abs(player.getCurrentTime() - time) > 1) {
            player.seekTo(time, true);
        }

        isProgrammatic = false;
    }
});


socket.on('sync_playlist', ({ playlist, playlistIndex }) => {
    playlistDiv.innerHTML = '';
    playlist?.forEach((videoUrl, index) => {
        const div = document.createElement('div');
        div.innerHTML = `<a href="javascript:void(0)" onclick="playVideo(${index})">${videoUrl}</a>`;
        playlistDiv.appendChild(div);
    });
});

socket.on('disconnect', () => console.log('Disconnected from server'));
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '315',
        width: '560',
        videoId: null,
        playerVars: { 'playsinline': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function isValidYouTubeURL(url) {
    return youtubeRegex.test(url);
}

function onPlayerReady() {
    console.log('YouTube Player Ready');
}

function onPlayerStateChange(event) {
    console.log('Player State Changed', event.data);
    if (!roomId || isProgrammatic) return;

    const currentTime = player.getCurrentTime();
    const playerState = event.data;

    let action;
    if (playerState === YT.PlayerState.PLAYING) action = 'play';
    else if (playerState === YT.PlayerState.PAUSED) action = 'pause';
    else if (playerState === YT.PlayerState.BUFFERING) action = 'seek';

    if (action) {
        socket.emit('sync_action', { action, time: currentTime, roomId });
    }
}
