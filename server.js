// server.js
require('dotenv').config();
const express = require('express');
const { Server } = require("socket.io");
const http = require("http");
const next = require("next");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create a Next.js app instance
const nextApp = next({ dev: process.env.NODE_ENV !== 'production' });
const nextHandler = nextApp.getRequestHandler();

// Middleware to parse JSON and URL-encoded data
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Default routing to handle all Next.js requests
app.all('*', (req, res) => {
  return nextHandler(req, res);
});

// WebSocket Logic
const roomStates = {};
const playlist = [
  "https://youtu.be/2Vv-BfVoq4g",
  "https://youtu.be/y12BRDS1CHI",
];

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    const roomUsers = io.sockets.adapter.rooms.get(roomId);
    const usersArray = roomUsers ? Array.from(roomUsers) : [];

    const room = roomStates[roomId] ||= {
      videoId: getYouTubeVideoId(playlist[0]),
      time: 0,
      action: 'play',
      playlist: [...playlist],
      playlistIndex: 0,
    };

    if (usersArray.length > 1) {
      console.log('Syncing action');
      socket.broadcast.to(roomId).emit('sync_action', { action: room.action, time: room.time, timeStamp: room.timeStamp, videoId: room.videoId, strict: true });
    } else {
      socket.emit('sync_action', {
        action: room.action,
        time: room.time,
        videoId: room.videoId
      });
      socket.emit('sync_playlist', {
        playlist: room.playlist,
        playlistIndex: room.playlistIndex
      });
    }
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

const PORT = process.env.PORT || 3000;

nextApp.prepare().then(() => {
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`App running on port: ${PORT}`);
  });
});

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
