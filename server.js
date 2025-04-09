require("dotenv").config()
const express = require("express")
const { Server } = require("socket.io")
const http = require("http")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
})

// Create a Next.js app instance
const nextApp = next({ dev })
const nextHandler = nextApp.getRequestHandler()

// Middleware to parse JSON and URL-encoded data
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// WebSocket Logic
const roomStates = {}
const playlist = [
  "https://youtu.be/2Vv-BfVoq4g", // Ed Sheeran - Shape of You
  "https://youtu.be/y12BRDS1CHI", // Adele - Hello
]

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id)

  socket.on("join_room", ({ roomId }) => {
    socket.join(roomId)
    const roomUsers = io.sockets.adapter.rooms.get(roomId)
    const usersArray = roomUsers ? Array.from(roomUsers) : []

    // Initialize room state if it doesn't exist
    if (!roomStates[roomId]) {
      roomStates[roomId] = {
        videoId: getYouTubeVideoId(playlist[0]),
        time: 0,
        action: "pause", // Start paused by default
        playlist: [...playlist],
        playlistIndex: 0,
        lastUpdateTime: Date.now(),
      }
    }

    const room = roomStates[roomId]

    console.log(`User ${socket.id} joined room: ${roomId}, Total users: ${usersArray.length}`)
    console.log(`Current room state:`, {
      videoId: room.videoId,
      action: room.action,
      time: room.time,
      playlistIndex: room.playlistIndex,
    })

    // If there are other users in the room, get the current state
    if (usersArray.length > 1) {
      console.log("Syncing with existing users")

      // Calculate current time based on elapsed time since last update
      let currentTime = room.time
      if (room.action === "play") {
        const elapsedSeconds = (Date.now() - room.lastUpdateTime) / 1000
        currentTime = Math.min(room.time + elapsedSeconds, 3600) // Cap at 1 hour to prevent extreme values
        console.log(`Calculated current time: ${currentTime} (elapsed: ${elapsedSeconds}s)`)
      }

      // Send the current state to the new user
      console.log(`Sending initial sync to new user: ${room.action} at ${currentTime}`)
      socket.emit("initial_sync", {
        action: room.action,
        time: currentTime,
        videoId: room.videoId,
      })
    } else {
      console.log("First user in room, initializing state")
      // First user gets the initial state
      socket.emit("initial_sync", {
        action: "pause", // Always start paused for first user
        time: 0,
        videoId: room.videoId,
      })
    }

    // Always send the playlist
    socket.emit("sync_playlist", {
      playlist: room.playlist,
      playlistIndex: room.playlistIndex,
    })
  })

  // Handle request for player state from new users
  socket.on("request_player_state", ({ roomId }) => {
    console.log(`User ${socket.id} requested player state for room ${roomId}`)

    const roomUsers = io.sockets.adapter.rooms.get(roomId)
    if (!roomUsers || roomUsers.size <= 1) {
      console.log("No other users in room to request state from")
      return
    }

    // Get all users in the room except the requester
    const otherUsers = Array.from(roomUsers).filter((id) => id !== socket.id)

    if (otherUsers.length > 0) {
      // Select a random user to respond
      const randomUserIndex = Math.floor(Math.random() * otherUsers.length)
      const randomUserId = otherUsers[randomUserIndex]

      console.log(`Requesting state from user ${randomUserId}`)
      io.to(randomUserId).emit("request_player_state")
    }
  })

  // Handle player state response from existing users
  socket.on("player_state_response", ({ roomId, state }) => {
    console.log(`Received player state from user ${socket.id} for room ${roomId}:`, state)

    // Forward the state to all other users in the room who joined recently
    socket.to(roomId).emit("player_state_response", { state })

    // Update room state
    if (roomStates[roomId] && state) {
      roomStates[roomId].action = state.isPlaying ? "play" : "pause"
      roomStates[roomId].time = state.currentTime
      roomStates[roomId].lastUpdateTime = Date.now()

      if (state.videoId) {
        roomStates[roomId].videoId = state.videoId
      }
    }
  })

  socket.on("leave_room", ({ roomId }) => {
    socket.leave(roomId)
    console.log(`User ${socket.id} left room: ${roomId}`)

    // Check if room is empty and clean up if needed
    const roomUsers = io.sockets.adapter.rooms.get(roomId)
    if (!roomUsers || roomUsers.size === 0) {
      console.log(`Room ${roomId} is empty, cleaning up`)
      delete roomStates[roomId]
    }
  })

  socket.on("upload_media", ({ roomId, videoUrl }) => {
    console.log(`Adding video to room ${roomId}: ${videoUrl}`)
    if (roomStates[roomId] && videoUrl) {
      roomStates[roomId].playlist.push(videoUrl)
      io.to(roomId).emit("sync_playlist", {
        playlist: roomStates[roomId].playlist,
        playlistIndex: roomStates[roomId].playlistIndex,
      })
    }
  })

  socket.on("change_media", ({ action, roomId }) => {
    console.log(`Changing media in room ${roomId}: ${action}`)
    const room = roomStates[roomId]
    if (!room || room.playlist.length === 0) return

    const { playlist, playlistIndex } = room
    room.playlistIndex =
      action === "next"
        ? (playlistIndex + 1) % playlist.length
        : (playlistIndex - 1 + playlist.length) % playlist.length

    room.videoId = getYouTubeVideoId(room.playlist[room.playlistIndex])

    // Update room state
    Object.assign(room, {
      time: 0,
      lastUpdateTime: Date.now(),
      action: "pause", // Start paused when changing media
    })

    io.to(roomId).emit("change_media", { videoId: room.videoId })
    io.to(roomId).emit("sync_playlist", { playlist: room.playlist, playlistIndex: room.playlistIndex })
  })

  socket.on("sync_action", ({ action, time, roomId, videoId }) => {
    console.log(`Sync action from ${socket.id} in room ${roomId}: ${action} at ${time}`)

    if (!roomStates[roomId]) {
      console.log(`Room ${roomId} not found, creating it`)
      roomStates[roomId] = {
        videoId: videoId || getYouTubeVideoId(playlist[0]),
        time: 0,
        action: "pause",
        playlist: [...playlist],
        playlistIndex: 0,
        lastUpdateTime: Date.now(),
      }
    }

    const room = roomStates[roomId]

    // Update room state
    Object.assign(room, {
      action,
      time,
      lastUpdateTime: Date.now(),
      videoId: videoId || room.videoId,
    })

    // Broadcast to ALL users in the room (including sender for consistency)
    io.to(roomId).emit("sync_action", {
      action,
      time,
      videoId: room.videoId,
    })
  })

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Clean up any rooms this user was the last member of
    for (const roomId in roomStates) {
      const roomUsers = io.sockets.adapter.rooms.get(roomId)
      if (!roomUsers || roomUsers.size === 0) {
        console.log(`Room ${roomId} is empty after disconnect, cleaning up`)
        delete roomStates[roomId]
      }
    }
  })
})

// Default routing to handle all Next.js requests
app.all("*", (req, res) => {
  return nextHandler(req, res)
})

const PORT = process.env.PORT || 3000

nextApp
  .prepare()
  .then(() => {
    server.listen(PORT, (err) => {
      if (err) throw err
      console.log(`App running on port: ${PORT}`)
    })
  })
  .catch((err) => {
    console.error("Error preparing Next.js app:", err)
    process.exit(1)
  })

function getYouTubeVideoId(url) {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname.includes("youtu.be")) return urlObj.pathname.slice(1)
    if (urlObj.hostname.includes("youtube.com")) return urlObj.searchParams.get("v")
  } catch (err) {
    console.error("Invalid YouTube URL:", url)
  }
  return null
}
