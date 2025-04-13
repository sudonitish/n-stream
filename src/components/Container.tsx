"use client"

import { useState, useEffect, useRef } from "react"
import io, { type Socket } from "socket.io-client"
import JoinScreen from "./JoinScreen"
import PlayerScreen from "./PlayerScreen"
import Background from "./Background"
import type { YouTubePlayer } from "react-youtube"

export default function Container() {
  const [webSocket, setWebSocket] = useState<Socket | null>(null)
  const [roomId, setRoomId] = useState("")
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [currentVideoID, setCurrentVideoId] = useState("")
  const [myPlayList, setMyPlayList] = useState<string[]>([])
  const [isProgrammatic, setIsProgrammatic] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [playerReady, setPlayerReady] = useState(false)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncActionRef = useRef<{ action: string; time: number; videoId?: string; timestamp: number } | null>(null)
  const initialSyncRef = useRef<{ action: string; time: number; videoId?: string } | null>(null)

  const handleJoin = (roomId: string) => {
    if (roomId && webSocket) {
      console.log(`Joining room: ${roomId}`)
      webSocket?.emit("join_room", { roomId: roomId.trim() })
      setRoomId(roomId)
    }
  }

  const handleLeave = () => {
    if (roomId && webSocket) {
      console.log(`Leaving room: ${roomId}`)
      webSocket?.emit("leave_room", { roomId })
      setRoomId("")
      // Reset video state
      setCurrentVideoId("")
      setMyPlayList([])
      // Cancel any pending sync
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }

  const changeMedia = ({ videoId }: { videoId: string }) => {
    console.log("Changing media to:", videoId)
    setCurrentVideoId(videoId)
  }

  const syncAction = ({
    action,
    time,
    videoId,
    isInitialSync = false,
  }: {
    action: string
    time: number
    videoId?: string
    isInitialSync?: boolean
  }) => {
    console.log(
      `Received sync action: ${action} at ${time} for video ${videoId || currentVideoID}, isInitial: ${isInitialSync}`,
    )

    if (isInitialSync) {
      initialSyncRef.current = { action, time, videoId }

      if (videoId && videoId !== currentVideoID) {
        setCurrentVideoId(videoId)
      }

      // If player is already ready, apply the sync action immediately
      if (playerRef.current) {
        applySyncAction(action, time, videoId)
      }
      return
    }

    // For regular sync actions, add to queue
    lastSyncActionRef.current = {
      action,
      time,
      videoId,
      timestamp: Date.now(),
    }

    // If we have a sync timeout, clear it
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Apply the sync action immediately if player is ready
    if (playerRef.current) {
      applySyncAction(action, time, videoId)
    } else {
      // Otherwise, queue it for when the player is ready
      syncTimeoutRef.current = setTimeout(() => {
        if (playerRef.current) {
          applySyncAction(action, time, videoId)
        }
      }, 1000)
    }
  }

  // Function to apply a sync action
  const applySyncAction = (action: string, time: number, videoId?: string) => {
    if (!playerRef.current) return

    console.log(`Applying sync action: ${action} at ${time} for video ${videoId || currentVideoID}`)

    setIsProgrammatic(true)

    try {
      // If video ID is different, load the new video
      if (videoId && currentVideoID !== videoId) {
        setCurrentVideoId(videoId)

        // If action is play or seek_playing, load and play the video
        if (action === "play" || action === "seek_playing") {
          console.log(`Loading and playing video ${videoId} at ${time}`)
          playerRef.current.loadVideoById({ videoId, startSeconds: time || 0 })
        } else {
          // Otherwise just cue it
          console.log(`Cueing video ${videoId} at ${time}`)
          playerRef.current.cueVideoById({ videoId, startSeconds: time || 0 })
        }
      } else {
        // Handle actions for the current video
        if (action === "play" || action === "seek_playing") {
          console.log(`Seeking to ${time} and playing`)
          playerRef.current.seekTo(time, true)

          // Only play if player is ready
          if (playerReady) {
            playerRef.current.playVideo()
          }
        } else if (action === "pause" || action === "seek_paused") {
          console.log(`Seeking to ${time} and pausing`)
          playerRef.current.seekTo(time, true)
          playerRef.current.pauseVideo()
        } else if (action === "end") {
          console.log("Video ended, handling end action")
          // You might want to implement auto-next here
          playerRef.current.pauseVideo()
        }
      }

      // Reset programmatic flag after a delay
      setTimeout(() => setIsProgrammatic(false), 1000)
    } catch (error) {
      console.error("Error in applySyncAction:", error)
      setIsProgrammatic(false)
    }
  }

  const syncPlaylist = ({
    playlist,
    playlistIndex,
  }: {
    playlist: string[]
    playlistIndex?: number
  }) => {
    console.log("Syncing playlist:", playlist, "current index:", playlistIndex)
    setMyPlayList(playlist)
  }

  // Function to set the player reference from the child component
  const setPlayerReference = (player: YouTubePlayer) => {
    console.log("Player reference set")
    playerRef.current = player
    setPlayerReady(true)
    setLoading(false)

    // Apply initial sync if it exists
    if (initialSyncRef.current) {
      console.log("Applying initial sync after player is ready:", initialSyncRef.current)
      const { action, time, videoId } = initialSyncRef.current

      // Set a short timeout to ensure the player is fully ready
      setTimeout(() => {
        applySyncAction(action, time, videoId)
        initialSyncRef.current = null
      }, 500)
    }
  }

  useEffect(() => {
    let socket: Socket

    try {
      // Determine the socket URL based on environment
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" && window.location.origin) || "/"
      console.log("Connecting to socket URL:", socketUrl)

      socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      socket.io.on("reconnect_attempt", () => {
        console.log("Attempting to reconnect...")
      })

      socket.io.on("reconnect_failed", () => {
        setError("Failed to reconnect after multiple attempts. Please refresh the page.")
      })

      socket.on("connect", () => {
        console.log("Connected to server with ID:", socket.id)
        setWebSocket(socket)
        setIsConnecting(false)
      })

      socket.on("connect_error", (err) => {
        console.error("Connection error:", err)
        setError("Failed to connect to server. Please try again later.")
        setIsConnecting(false)
      })

      socket.on("change_media", changeMedia)
      socket.on("sync_action", syncAction)
      socket.on("initial_sync", (data) => syncAction({ ...data, isInitialSync: true }))
      socket.on("sync_playlist", syncPlaylist)
      socket.on("disconnect", () => console.log("Disconnected from server"))

      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current)
        }
        socket.off("change_media", changeMedia)
        socket.off("sync_action", syncAction)
        socket.off("initial_sync", syncAction)
        socket.off("sync_playlist", syncPlaylist)
        socket.disconnect()
      }
    } catch (err) {
      console.error("Socket initialization error:", err)
      setError("Failed to initialize connection. Please try again later.")
      setIsConnecting(false)
      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current)
        }
      }
    }
  }, [])

  // Effect to check loading state
  useEffect(() => {
    // If we're connected but player isn't ready after 10 seconds, stop showing loading
    if (!isConnecting && loading) {
      const timeout = setTimeout(() => {
        if (loading) {
          console.log("Timeout reached, forcing loading to false")
          setLoading(false)
        }
      }, 10000)

      return () => clearTimeout(timeout)
    }
  }, [isConnecting, loading])

  return (
    <>
      <Background />
      {error ? (
        <Error message={error} />
      ) : (
        <>
          {isConnecting && <Loading message="Connecting to server..." />}

          <PlayerScreen
            loading={loading}
            roomId={roomId}
            socket={webSocket!}
            handleLeave={handleLeave}
            myPlayList={myPlayList}
            currentVideoID={currentVideoID}
            isProgrammatic={isProgrammatic}
            onPlayerReady={setPlayerReference}
            lastSyncActionRef={lastSyncActionRef}
          />
          <JoinScreen loading={loading || isConnecting} roomId={roomId} handleJoin={handleJoin} />
        </>
      )}
    </>
  )
}

const Loading = ({ message = "Setting up your environment..." }: { message?: string }) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="relative z-10 text-center">
        <div className="glass-panel p-8 rounded-xl">
          <h2 className="text-2xl font-bold mb-4 gradient-text">{message}</h2>
          <div className="w-16 h-16 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    </div>
  )
}

const Error = ({ message }: { message: string }) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="relative z-10 text-center">
        <div className="glass-panel p-8 rounded-xl">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Connection Error</h2>
          <p className="mb-4">{message}</p>
          <button
            onClick={() => window.location.reload()}
            className="gradient-button py-2 px-4 rounded-lg text-white font-medium"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  )
}
