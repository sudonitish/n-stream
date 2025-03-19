require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Server } = require("socket.io");
const http = require("http");
const router = require('./routes/webRoutes');
const { timeStamp } = require('console');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
}));

app.use('/', router);

const roomStates = {};
const playlist = [
    "https://youtu.be/y12BRDS1CHI",
    "https://youtu.be/2Vv-BfVoq4g",
    "https://youtu.be/2Vv-BfVoq4g",
    "https://youtu.be/2Vv-BfVoq4g",
];

io.on('connection', (socket) => {

    socket.on('join_room', ({ roomId }) => {
        socket.join(roomId);
        const room = roomStates[roomId] ||= {
            videoId: getYouTubeVideoId(playlist[0]),
            time: 0,
            timeStamp: Date.now(),
            action: 'pause',
            playlist: [...playlist],
            playlistIndex: 0,
        };


        socket.emit('sync_action', {
            action: room.action,
            time: room.time,
            timeStamp: room.timeStamp,
            videoId: room.videoId
        });


        socket.emit('sync_playlist', {
            playlist: room.playlist,
            playlistIndex: room.playlistIndex
        });
    });

    socket.on('leave_room', ({ roomId }) => {
        socket.leave(roomId);
    });

    socket.on('upload_media', ({ roomId, videoUrl }) => {
        if (roomStates[roomId] && videoUrl) {
            roomStates[roomId].playlist.push(videoUrl);
        }
    });

    socket.on('change_media', ({ action, roomId }) => {
        const room = roomStates[roomId];
        if (!room || room.playlist.length === 0) return;

        const { playlist, playlistIndex } = room;
        room.playlistIndex = action === 'next'
            ? (playlistIndex + 1) % playlist.length
            : (playlistIndex - 1 + playlist.length) % playlist.length;

        room.videoId = getYouTubeVideoId(room.playlist[room.playlistIndex]);
        Object.assign(room, { time: 0, timeStamp: Date.now(), action: 'play' });

        io.to(roomId).emit('change_media', { roomId, videoId: room.videoId });
        io.to(roomId).emit('sync_playlist', { playlist: room.playlist, playlistIndex: room.playlistIndex });
    });

    socket.on('sync_action', ({ action, time, roomId }) => {
        const room = roomStates[roomId] ||= {};
        Object.assign(room, { action, time, timeStamp: Date.now() });

        socket.broadcast.to(roomId).emit('sync_action', { action, time, timeStamp: room.timeStamp, videoId: room.videoId });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

try {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => console.log(`App running on port: ${PORT}`));
} catch (err) {
    console.error('Server failed to start:', err);
}

function getYouTubeVideoId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtu.be')) return urlObj.pathname.slice(1);
        if (urlObj.hostname.includes('youtube.com')) return urlObj.searchParams.get('v');
    } catch (err) {
        console.error("Invalid YouTube URL:", url);
    }
    return null;
}
