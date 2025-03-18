require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Server } = require("socket.io");
const http = require("http");
const router = require('./routes/webRoutes');

const app = express();
const server = http.createServer(app)
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
}))
app.use('/', router);

const roomStates = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('room', (event, roomId) => {
        if (event === 'join') {
            socket.join(roomId);

            // Send the current state of the room to the newly joined user
            if (roomStates[roomId]) {
                const currentState = roomStates[roomId];
                
                currentState.timestamp = Date.now(); // Add a timestamp
                socket.emit('sync_state', currentState);
            }
        }
        if (event === 'leave') {
            socket.leave(roomId);
        }
    });

    socket.on('change_media', ({ roomId, videoId }) => {
        if (!roomStates[roomId]) roomStates[roomId] = {};
        roomStates[roomId].videoId = videoId;
        roomStates[roomId].time = 0; // Reset time
        roomStates[roomId].action = 'pause'; // Default to paused
        roomStates[roomId].timestamp = Date.now(); // Update timestamp

        io.to(roomId).emit('change_media', { roomId, videoId });
    });

    socket.on('sync_action', ({ action, time, roomId }) => {
        if (!roomStates[roomId]) roomStates[roomId] = {};
        roomStates[roomId].action = action;
        roomStates[roomId].time = time;
        roomStates[roomId].timestamp = Date.now(); // Update timestamp

        io.to(roomId).emit('sync_action', { action, time });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

try {
    const PORT = process.env.PORT;
    server.listen(PORT, console.log(`App running on port:${PORT}`))
}
catch {
    console.log('Server failed to start')
}
