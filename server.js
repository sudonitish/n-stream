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

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('player', (control, roomId) => {
        socket.broadcast.to(roomId).emit('changing control', { control, email });
    });

    socket.on('room', (roomId) => {
        socket.join(roomId);
    })

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
