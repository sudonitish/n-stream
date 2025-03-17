let player;

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
    player.loadVideoById({
        videoId: 'RgKAFK5djSk',
        startSeconds: 0,
        suggestedQuality: 'hd720'
    });
}

function onPlayerStateChange(event) {

}
