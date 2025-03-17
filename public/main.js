let player;
const urlInput = document.getElementById('urlInput');
const playButton = document.getElementById('playButton');
const socket = io(); // Connect to the server
const roomId = 'chillzone';
socket.on('connect', () => {
    console.log('Connected to server');
    joinRoom(roomId);
});

function joinRoom(roomId) {
    socket.emit('room', roomId);
}


socket.on('change_media', ({roomId, videoId}) => {
    player.loadVideoById({
        videoId: videoId,
        startSeconds: 0,
        suggestedQuality: 'hd720'
    });
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

playButton.onclick = () => {
    const videoUrl = urlInput.value;
    const videoId = getYouTubeVideoId(videoUrl);
    if (videoId) {
        socket.emit('change_media', {videoId: videoId, roomId: roomId });
    } else {
        console.error('Invalid YouTube URL');
    }
}

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
        videoId: null,
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
    console.log(event.data);
    console.log(event.target);
    console.log("+++++++")
}

