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
  const pendingSyncRef = useRef<any>(null)
  const lastReceivedActionRef = useRef<{ action: string; time: number; videoId?: string; timestamp: number } | null>(
    null,
  )

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

    // Store this as the pending sync to ensure it's applied
    pendingSyncRef.current = { action: "pause", time: 0, videoId }

    // If player reference exists, apply immediately
    if (playerRef.current) {
      console.log("Player reference exists, cueing video immediately")
      // Use cueVideoById instead of loadVideoById to prevent auto-play
      setIsProgrammatic(true)
      playerRef.current.cueVideoById({ videoId, startSeconds: 0 })

      // Reset programmatic flag after a short delay
      setTimeout(() => {
        setIsProgrammatic(false)
      }, 500)
    } else {
      console.warn("Player reference doesn't exist yet, will apply when ready")
    }
  }

  const syncAction = ({
    action,
    time,
    videoId,
    strict,
  }: {
    action: string
    time: number
    videoId?: string
    strict?: boolean
  }) => {
    // Check if this is a duplicate action we just received
    const now = Date.now()
    const lastAction = lastReceivedActionRef.current

    if (
      lastAction &&
      lastAction.action === action &&
      Math.abs(lastAction.time - time) < 1 &&
      lastAction.videoId === videoId &&
      now - lastAction.timestamp < 500
    ) {
      console.log("Ignoring duplicate sync action")
      return
    }

    // Store this action to prevent duplicates
    lastReceivedActionRef.current = {
      action,
      time,
      videoId,
      timestamp: now,
    }

    console.log(`Sync action received: ${action} at ${time} for video ${videoId || currentVideoID}`)

    // Cancel any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Store this as the pending sync
    pendingSyncRef.current = { action, time, videoId, strict }

    // If player reference exists, apply immediately
    if (playerRef.current) {
      console.log("Player reference exists, applying sync immediately")
      applySyncAction()
    } else {
      console.warn("Player reference doesn't exist yet, will apply when ready")
    }
  }

  // Function to apply the pending sync action
  const applySyncAction = () => {
    if (!pendingSyncRef.current || !playerRef.current) return

    const { action, time, videoId, strict } = pendingSyncRef.current

    setIsProgrammatic(true)

    try {
      if (videoId && currentVideoID !== videoId) {
        console.log("Loading new video:", videoId)
        setCurrentVideoId(videoId)

        if (action === "play") {
          // If we need to play, load the video at the specified time
          playerRef.current.loadVideoById({
            videoId,
            startSeconds: time || 0,
          })
        } else {
          // Otherwise, just cue it
          playerRef.current.cueVideoById({
            videoId,
            startSeconds: time || 0,
          })
        }

        // Handle the action after video loads
        const onStateChange = (event: any) => {
          if (event.data === 1 || event.data === 5) {
            // Video started playing or is cued
            if (action === "pause") {
              console.log("Pausing video after load")
              playerRef.current?.pauseVideo()
            } else if (action === "play") {
              console.log("Ensuring video plays after load")
              playerRef.current?.playVideo()
            }

            // Reset programmatic flag after a short delay
            setTimeout(() => {
              setIsProgrammatic(false)
            }, 500)

            playerRef.current?.removeEventListener("onStateChange", onStateChange)
          }
        }

        playerRef.current.addEventListener("onStateChange", onStateChange)
      } else {
        // Same video, just sync state
        if (action === "play") {
          console.log(`Playing video at ${time}`)
          playerRef.current.seekTo(time, true)
          playerRef.current.playVideo()
        } else if (action === "pause") {
          console.log(`Pausing video at ${time}`)
          playerRef.current.seekTo(time, true)
          playerRef.current.pauseVideo()
        } else if (action === "seek") {
          console.log(`Seeking to ${time}`)
          playerRef.current.seekTo(time, true)
        }

        // Reset programmatic flag after a short delay
        setTimeout(() => {
          setIsProgrammatic(false)
        }, 500)
      }

      // Clear the pending sync
      pendingSyncRef.current = null
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

    // Apply any pending sync action after a short delay
    // to ensure the player is fully initialized
    if (pendingSyncRef.current) {
      console.log("Applying pending sync action after player is ready")
      syncTimeoutRef.current = setTimeout(() => {
        if (playerRef.current) {
          applySyncAction()
        }
      }, 500)
    }
  }

  // Effect to handle player readiness changes
  useEffect(() => {
    if (playerReady && pendingSyncRef.current) {
      console.log("Player is now ready, applying pending sync")
      syncTimeoutRef.current = setTimeout(() => {
        if (playerRef.current) {
          applySyncAction()
        }
      }, 500)
    }
  }, [playerReady])

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
      socket.on("sync_playlist", syncPlaylist)
      socket.on("disconnect", () => console.log("Disconnected from server"))

      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current)
        }
        socket.off("change_media", changeMedia)
        socket.off("sync_action", syncAction)
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

  // Debug logging for player readiness
  useEffect(() => {
    console.log("Player ready state changed:", playerReady)
  }, [playerReady])

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

