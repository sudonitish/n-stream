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

// Debug logging helper
const logAction = (message, data) => {
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0]
  console.log(`[${timestamp}] SERVER: ${message}`, data || "")
}

// WebSocket Logic
const roomStates = {}
const playlist = [
  "https://youtu.be/2Vv-BfVoq4g", // Ed Sheeran - Shape of You
  "https://youtu.be/y12BRDS1CHI", // Adele - Hello
]

io.on("connection", (socket) => {
  logAction(`A user connected: ${socket.id}`)

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

    logAction(`User ${socket.id} joined room: ${roomId}, Total users: ${usersArray.length}`)
    logAction(`Current room state:`, {
      videoId: room.videoId,
      action: room.action,
      time: room.time,
      playlistIndex: room.playlistIndex,
    })

    // Calculate current time based on elapsed time since last update
    let currentTime = room.time
    if (room.action === "play" || room.action === "seek_playing") {
      const elapsedSeconds = (Date.now() - room.lastUpdateTime) / 1000
      currentTime = Math.min(room.time + elapsedSeconds, 3600) // Cap at 1 hour to prevent extreme values
      logAction(`Calculated current time: ${currentTime} (elapsed: ${elapsedSeconds}s)`)
    }

    // Send the current state to the new user with timestamp
    logAction(`Sending initial sync to new user: ${room.action} at ${currentTime}`)
    socket.emit("initial_sync", {
      action: room.action,
      time: currentTime,
      videoId: room.videoId,
      timestamp: Date.now(),
    })

    // Always send the playlist
    socket.emit("sync_playlist", {
      playlist: room.playlist,
      playlistIndex: room.playlistIndex,
    })
  })

  socket.on("leave_room", ({ roomId }) => {
    socket.leave(roomId)
    logAction(`User ${socket.id} left room: ${roomId}`)

    // Check if room is empty and clean up if needed
    const roomUsers = io.sockets.adapter.rooms.get(roomId)
    if (!roomUsers || roomUsers.size === 0) {
      logAction(`Room ${roomId} is empty, cleaning up`)
      delete roomStates[roomId]
    }
  })

  socket.on("upload_media", ({ roomId, videoUrl }) => {
    logAction(`Adding video to room ${roomId}: ${videoUrl}`)
    if (roomStates[roomId] && videoUrl) {
      roomStates[roomId].playlist.push(videoUrl)
      io.to(roomId).emit("sync_playlist", {
        playlist: roomStates[roomId].playlist,
        playlistIndex: roomStates[roomId].playlistIndex,
      })
    }
  })

  socket.on("change_media", ({ action, roomId }) => {
    logAction(`Changing media in room ${roomId}: ${action}`)
    const room = roomStates[roomId]
    if (!room || room.playlist.length === 0) {
      logAction(`Room ${roomId} not found or empty playlist`)
      return
    }

    const { playlist, playlistIndex } = room
    let newIndex

    if (action === "next") {
      newIndex = (playlistIndex + 1) % playlist.length
      logAction(`Moving to next video, new index: ${newIndex}`)
    } else if (action === "prev") {
      newIndex = (playlistIndex - 1 + playlist.length) % playlist.length
      logAction(`Moving to previous video, new index: ${newIndex}`)
    } else {
      logAction(`Unknown action: ${action}`)
      return
    }

    room.playlistIndex = newIndex
    const newVideoId = getYouTubeVideoId(room.playlist[newIndex])
    room.videoId = newVideoId

    // Update room state
    Object.assign(room, {
      time: 0,
      lastUpdateTime: Date.now(),
      action: "pause", // Start paused when changing media
    })

    logAction(`Changed media to index ${newIndex}, video ID: ${newVideoId}`)

    // Broadcast the change to all clients in the room
    io.to(roomId).emit("change_media", { videoId: newVideoId })
    io.to(roomId).emit("sync_playlist", {
      playlist: room.playlist,
      playlistIndex: newIndex,
    })
  })

  socket.on("sync_action", ({ action, time, roomId, videoId, timestamp = Date.now() }) => {
    logAction(`Sync action from ${socket.id} in room ${roomId}: ${action} at ${time}`)

    if (!roomStates[roomId]) {
      logAction(`Room ${roomId} not found, creating it`)
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
      lastUpdateTime: timestamp,
      videoId: videoId || room.videoId,
    })

    // Broadcast to ALL users in the room EXCEPT the sender
    socket.to(roomId).emit("sync_action", {
      action,
      time,
      videoId: room.videoId,
      timestamp,
    })
  })

  socket.on("get_current_state", ({ roomId }) => {
    logAction(`User ${socket.id} requested current state for room ${roomId}`)

    if (!roomStates[roomId]) {
      logAction(`Room ${roomId} not found, cannot provide state`)
      return
    }

    const room = roomStates[roomId]

    // Calculate current time based on elapsed time since last update
    let currentTime = room.time
    if (room.action === "play" || room.action === "seek_playing") {
      const elapsedSeconds = (Date.now() - room.lastUpdateTime) / 1000
      currentTime = Math.min(room.time + elapsedSeconds, 3600)
      logAction(`Calculated current time: ${currentTime} (elapsed: ${elapsedSeconds}s)`)
    }

    socket.emit("sync_action", {
      action: room.action,
      time: currentTime,
      videoId: room.videoId,
      timestamp: Date.now(),
    })
  })

  socket.on("disconnect", () => {
    logAction(`User disconnected: ${socket.id}`)

    // Clean up any rooms this user was the last member of
    for (const roomId in roomStates) {
      const roomUsers = io.sockets.adapter.rooms.get(roomId)
      if (!roomUsers || roomUsers.size === 0) {
        logAction(`Room ${roomId} is empty after disconnect, cleaning up`)
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
      logAction(`App running on port: ${PORT}`)
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
