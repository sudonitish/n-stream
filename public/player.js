
// State
const socket = io();
let isMuted = false;
let player;
let isProgrammatic = false;
let roomId = null;


// DOM Elements
const joinScreen = document.getElementById('join-screen');
const videoPlayer = document.getElementById('video-player');
const roomInput = document.getElementById('room-id');
const joinButton = document.getElementById('join-button');
const roomDisplay = document.getElementById('room-display');
const leaveButton = document.getElementById('leave-button');
const playButton = document.getElementById('play-button');
const muteButton = document.getElementById('mute-button');
const volumeSlider = document.getElementById('volume-slider');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const volumeIcon = document.getElementById('volume-icon');
const muteIcon = document.getElementById('mute-icon');
const animatedCircles = document.getElementById('animated-circles');
const animatedWaves = document.getElementById('animated-waves');



const urlInput = document.getElementById('url-id');
const uploadMediaButton = document.getElementById('upload-button');
const nextButton = document.getElementById('next-button');
const prevButton = document.getElementById('prev-button');
const playlistBox = document.getElementById('playlist');
const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;



// Create animated background elements
function createBackgroundElements() {
    // Create circles
    for (let i = 0; i < 30; i++) {
        const circle = document.createElement('div');
        circle.className = 'animated-circle';

        const size = Math.random() * 20 + 5;
        const r = Math.random() * 100 + 100;
        const g = Math.random() * 50;
        const b = Math.random() * 255;
        const opacity = Math.random() * 0.5 + 0.2;

        circle.style.width = `${size}px`;
        circle.style.height = `${size}px`;
        circle.style.top = `${Math.random() * 100}%`;
        circle.style.left = `${Math.random() * 100}%`;
        circle.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        circle.style.boxShadow = `0 0 ${Math.random() * 30 + 10}px rgba(${r}, ${g}, ${b}, ${opacity + 0.1})`;
        circle.style.animation = `float ${Math.random() * 15 + 10}s linear infinite, pulse ${Math.random() * 5 + 2}s ease-in-out infinite alternate`;
        circle.style.animationDelay = `${Math.random() * 5}s`;

        animatedCircles.appendChild(circle);
    }

    // Create waves
    for (let i = 0; i < 5; i++) {
        const wave = document.createElement('div');
        wave.className = 'animated-wave';

        const r = Math.random() * 100 + 100;
        const g = Math.random() * 100;
        const b = Math.random() * 255;

        wave.style.background = `rgba(${r}, ${g}, ${b}, 0.1)`;
        wave.style.animation = `wave ${10 + i * 3}s ease-in-out infinite alternate`;
        wave.style.animationDelay = `${i * 0.5}s`;
        wave.style.bottom = `${i * 10 - 40}px`;

        animatedWaves.appendChild(wave);
    }
}

// Join room handler
function handleJoin() {
    roomId = roomInput.value.trim();
    if (roomId) {
        socket.emit('join_room', { roomId });
        roomDisplay.textContent = `Room: ${roomId}`;
        joinScreen.classList.add('hide');
        setTimeout(() => {
            videoPlayer.classList.add('show');
        }, 500);
    }
}


// Leave room handler
function handleLeave() {
    videoPlayer.classList.remove('show');

    if (roomId) {
        socket.emit('leave_room', { roomId });
        roomId = null;
    }

    setTimeout(() => {
        joinScreen.classList.remove('hide');
    }, 500);
}

// Initialize
function init() {
    createBackgroundElements();
    joinButton.addEventListener('click', handleJoin);
    leaveButton.addEventListener('click', handleLeave);
    playButton.addEventListener('click', togglePlay);
    muteButton.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', handleVolumeChange);
    nextButton.onclick = () => roomId && socket.emit('change_media', { action: 'next', roomId });
    prevButton.onclick = () => roomId && socket.emit('change_media', { action: 'prev', roomId });
    uploadMediaButton.onclick = () => {
        const videoUrl = urlInput.value.trim();
        if (!isValidYouTubeURL(videoUrl)) {
            return alert('Invalid YouTube URL');
        }
        if (roomId) {
            socket.emit('upload_media', { videoUrl, roomId });
        }
    };
    socket.on('change_media', ({ videoId }) => {
        if (player) {
            player.loadVideoById({ videoId, startSeconds: 0, suggestedQuality: 'hd720' });
        }
    });
    socket.on('sync_action', ({ action, time, videoId, strict }) => {
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
            if (action === 'play' && player.getPlayerState() == YT.PlayerState.PLAYING && strict) {
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
        playlistBox.innerHTML = '';
        playlist?.forEach((videoUrl, index) => {
            const div = document.createElement('div');
            div.innerHTML = `<a href="javascript:void(0)" onclick="playVideo(${index})">${videoUrl}</a>`;
            playlistBox.appendChild(div);
        });
    });
    socket.on('disconnect', () => console.log('Disconnected from server'));

}

document.addEventListener('DOMContentLoaded', () => { });

socket.on('connect', socketOnConnect);
function socketOnConnect() {
    console.log('Connected to server')
};

function isValidYouTubeURL(url) {
    return youtubeRegex.test(url);
}
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: null,
        playerVars: {
            playsinline: 1,
            modestbranding: 1,
            controls: 1,
            volume: 30,
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
        }
    });
}

function onPlayerStateChange(event) {
    if (!roomId || isProgrammatic) return;
    const currentTime = player.getCurrentTime();
    const playerState = event.data;
    let action;
    if (playerState === YT.PlayerState.PLAYING) action = 'play';
    else if (playerState === YT.PlayerState.PAUSED) action = 'pause';
    else if (playerState === YT.PlayerState.BUFFERING) action = 'seek';
    else if (playerState === YT.PlayerState.ENDED) action = 'end';

    if (action) {
        socket.emit('sync_action', { action, time: currentTime, roomId });
    }
    if (action === 'pause') {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    } else if (action === 'play') {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    }
}
function onPlayerReady() {
    console.log('YouTube Player Ready');
    init();
}
function togglePlay() {
    const currentState = player.getPlayerState();
    if (currentState === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function toggleMute() {
    const isMuted = player.isMuted();
    player[isMuted ? 'unMute' : 'mute']();  // Toggle mute/unmute
    volumeIcon.classList.toggle('hidden', !isMuted);
    muteIcon.classList.toggle('hidden', isMuted);
}

function handleVolumeChange() {
    const volume = parseInt(volumeSlider.value, 10);
    player.setVolume(volume);

    const isMuted = volume === 0;
    player[isMuted ? 'mute' : 'unMute'](); // Mute if volume is 0, otherwise unmute

    volumeIcon.classList.toggle('hidden', isMuted);
    muteIcon.classList.toggle('hidden', !isMuted);
}
