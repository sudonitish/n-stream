"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import io, { type Socket } from "socket.io-client"
import JoinScreen from "./JoinScreen"
import PlayerScreen from "./PlayerScreen"
import Background from "./Background"
import type { YouTubePlayer } from "react-youtube"

// Create a single socket instance outside the component to prevent reconnections
let socketInstance: Socket | null = null

interface ChangeMediaData {
  videoId: string
}

interface SyncActionData {
  action: string
  time: number
  videoId?: string
  timestamp: number
  isInitialSync?: boolean
}

interface SyncPlaylistData {
  playlist: string[]
  playlistIndex?: number
}

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

  // Use refs for values that need to persist between renders and don't trigger re-renders
  const playerReadyRef = useRef(false)
  const lastSyncActionRef = useRef<{
    action: string
    time: number
    videoId?: string
    timestamp: number
  } | null>(null)
  const syncInProgressRef = useRef(false)
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialSyncAppliedRef = useRef(false)

  // Debug logging helper
  const logAction = useCallback((message: string, data?: unknown) => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0]
    console.log(`[${timestamp}] ${message}`, data || "")
  }, [])

  const handleJoin = useCallback(
    (roomId: string) => {
      if (roomId && webSocket) {
        logAction(`Joining room: ${roomId}`)
        webSocket.emit("join_room", { roomId: roomId.trim() })
        setRoomId(roomId)

        // Reset sync flags when joining a new room
        initialSyncAppliedRef.current = false
        lastSyncActionRef.current = null
      }
    },
    [webSocket, logAction],
  )

  const handleLeave = useCallback(() => {
    if (roomId && webSocket) {
      logAction(`Leaving room: ${roomId}`)
      webSocket.emit("leave_room", { roomId })
      setRoomId("")
      setCurrentVideoId("")
      setMyPlayList([])

      // Reset all refs
      playerReadyRef.current = false
      lastSyncActionRef.current = null
      syncInProgressRef.current = false
      initialSyncAppliedRef.current = false

      // Clear any pending timers
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [roomId, webSocket, logAction])

  const changeMedia = useCallback(
    (data: ChangeMediaData) => {
      logAction(`Changing media to: ${data.videoId}`)
      setCurrentVideoId(data.videoId)
    },
    [logAction],
  )

  // Apply a sync action to the player
  const applySyncAction = useCallback(
    (action: string, time: number, videoId?: string, timestamp: number = Date.now()) => {
      if (!playerRef.current || !playerReadyRef.current) {
        logAction("Player not ready, cannot apply sync action")
        return false
      }

      if (syncInProgressRef.current) {
        logAction("Sync already in progress, skipping")
        return false
      }

      syncInProgressRef.current = true
      logAction(`Applying sync action: ${action} at ${time} for video ${videoId || currentVideoID}`)
      setIsProgrammatic(true)

      try {
        // Calculate elapsed time for play actions
        let adjustedTime = time
        if (action === "play" || action === "seek_playing") {
          const elapsedSeconds = (Date.now() - timestamp) / 1000
          adjustedTime = Math.max(0, Math.min(time + elapsedSeconds, 3600)) // Cap between 0 and 1 hour
          logAction(`Adjusting time for ${action}: ${time} + ${elapsedSeconds}s = ${adjustedTime}`)
        }

        // If video ID is different, load the new video
        if (videoId && currentVideoID !== videoId) {
          logAction(`Video ID changed, setting to: ${videoId}`)
          setCurrentVideoId(videoId)

          // If action is play or seek_playing, load and play the video
          if (action === "play" || action === "seek_playing") {
            logAction(`Loading and playing video ${videoId} at ${adjustedTime}`)

            // First load the video with the adjusted time
            playerRef.current.loadVideoById({ videoId, startSeconds: adjustedTime })

            // Force play after a short delay to ensure it actually plays
            setTimeout(() => {
              if (playerRef.current) {
                logAction("Forcing play after video load")
                playerRef.current.playVideo()

                // Double-check that it's playing
                setTimeout(() => {
                  if (playerRef.current && playerRef.current.getPlayerState() !== 1) {
                    logAction("Video still not playing, forcing play again")
                    playerRef.current.playVideo()
                  }
                }, 500)
              }
            }, 300)
          } else {
            // Otherwise just cue it
            logAction(`Cueing video ${videoId} at ${adjustedTime}`)
            playerRef.current.cueVideoById({ videoId, startSeconds: adjustedTime })

            // For pause actions, ensure we're actually paused
            if (action === "pause" || action === "seek_paused") {
              setTimeout(() => {
                if (playerRef.current) {
                  playerRef.current.pauseVideo()
                }
              }, 300)
            }
          }
        } else {
          // Handle actions for the current video
          if (action === "play" || action === "seek_playing") {
            logAction(`Seeking to ${adjustedTime} and playing`)

            // First seek to the time
            playerRef.current.seekTo(adjustedTime, true)

            // Then play with multiple attempts to ensure it works
            const playAttempt = (attempt = 1) => {
              logAction(`Play attempt ${attempt}`)
              playerRef.current?.playVideo()

              // Check if it's actually playing after a short delay
              if (attempt < 3) {
                setTimeout(() => {
                  if (playerRef.current && playerRef.current.getPlayerState() !== 1) {
                    logAction(`Play didn't take effect, retrying (attempt ${attempt + 1})`)
                    playAttempt(attempt + 1)
                  }
                }, 300)
              }
            }

            playAttempt()
          } else if (action === "pause" || action === "seek_paused") {
            logAction(`Seeking to ${adjustedTime} and pausing`)
            playerRef.current.seekTo(adjustedTime, true)
            playerRef.current.pauseVideo()
          } else if (action === "end") {
            logAction("Video ended, handling end action")
            playerRef.current.pauseVideo()
          }
        }

        // Reset flags after a delay
        setTimeout(() => {
          syncInProgressRef.current = false
          setIsProgrammatic(false)
        }, 1000)

        return true
      } catch (error) {
        logAction(`Error in applySyncAction: ${error}`)
        syncInProgressRef.current = false
        setIsProgrammatic(false)
        return false
      }
    },
    [currentVideoID, logAction],
  )

  // Handle sync action from server
  const syncAction = useCallback(
    (data: SyncActionData) => {
      const { action, time, videoId, timestamp = Date.now(), isInitialSync = false } = data

      logAction(
        `Received sync action: ${action} at ${time} for video ${videoId || currentVideoID}, isInitial: ${isInitialSync}`,
      )

      // Store the action for later reference
      lastSyncActionRef.current = {
        action,
        time,
        videoId,
        timestamp,
      }

      // If this is an initial sync, set the video ID first
      if (isInitialSync && videoId && videoId !== currentVideoID) {
        logAction(`Setting initial video ID to: ${videoId}`)
        setCurrentVideoId(videoId)
      }

      // If player is ready, apply immediately
      if (playerReadyRef.current && playerRef.current) {
        logAction("Player ready, applying sync action immediately")

        // For initial sync, give a short delay to ensure video ID is set
        if (isInitialSync) {
          setTimeout(() => {
            applySyncAction(action, time, videoId, timestamp)
            initialSyncAppliedRef.current = true
          }, 500)
        } else {
          applySyncAction(action, time, videoId, timestamp)
        }
      } else {
        // Otherwise, schedule a retry
        logAction("Player not ready, scheduling retry")

        // Clear any existing retry timer
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current)
        }

        // Set up a new retry with exponential backoff
        const retrySync = (attempt = 1) => {
          if (playerReadyRef.current && playerRef.current) {
            logAction(`Applying sync action on retry attempt ${attempt}`)
            applySyncAction(action, time, videoId, timestamp)

            if (isInitialSync) {
              initialSyncAppliedRef.current = true
            }
          } else if (attempt < 5) {
            // Retry with exponential backoff
            const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000)
            logAction(`Player still not ready, retry attempt ${attempt + 1} in ${delay}ms`)

            retryTimerRef.current = setTimeout(() => {
              retrySync(attempt + 1)
            }, delay)
          } else {
            logAction("Max retry attempts reached, giving up")
          }
        }

        // Start retry process
        retryTimerRef.current = setTimeout(() => {
          retrySync()
        }, 1000)
      }
    },
    [currentVideoID, applySyncAction, logAction],
  )

  // Handle playlist sync from server
  const syncPlaylist = useCallback(
    (data: SyncPlaylistData) => {
      const { playlist, playlistIndex } = data
      logAction(`Syncing playlist: ${playlist.length} items, current index: ${playlistIndex}`)
      setMyPlayList(playlist)
    },
    [logAction],
  )

  // Set player reference when YouTube player is ready
  const setPlayerReference = useCallback(
    (player: YouTubePlayer) => {
      logAction("Player reference set")
      playerRef.current = player
      playerReadyRef.current = true
      setLoading(false)

      // If we have a pending sync action, apply it now
      if (lastSyncActionRef.current && !initialSyncAppliedRef.current) {
        const { action, time, videoId, timestamp } = lastSyncActionRef.current
        logAction("Applying pending sync action now that player is ready")

        // Give a short delay to ensure player is fully initialized
        setTimeout(() => {
          applySyncAction(action, time, videoId, timestamp)
          initialSyncAppliedRef.current = true
        }, 500)
      } else if (roomId && webSocket) {
        // If we don't have a pending action but we're in a room, request the current state
        logAction("No pending sync action, requesting current state from server")
        webSocket.emit("get_current_state", { roomId })
      }
    },
    [applySyncAction, roomId, webSocket, logAction],
  )

  // Handle next/previous video
  const handlePrevious = useCallback(() => {
    if (webSocket && roomId) {
      logAction("Sending previous video request")
      webSocket.emit("change_media", { action: "prev", roomId })
    }
  }, [webSocket, roomId, logAction])

  const handleNext = useCallback(() => {
    if (webSocket && roomId) {
      logAction("Sending next video request")
      webSocket.emit("change_media", { action: "next", roomId })
    }
  }, [webSocket, roomId, logAction])

  // Initialize socket connection
  useEffect(() => {
    try {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" && window.location.origin) || "/"

      logAction(`Connecting to socket URL: ${socketUrl}`)

      // Reuse existing socket if available
      if (!socketInstance) {
        socketInstance = io(socketUrl, {
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        })
      }

      const socket = socketInstance

      // Clean up previous listeners to avoid duplicates
      socket.off("change_media")
      socket.off("sync_action")
      socket.off("initial_sync")
      socket.off("sync_playlist")
      socket.off("disconnect")

      socket.io.on("reconnect_attempt", () => {
        logAction("Attempting to reconnect...")
      })

      socket.io.on("reconnect_failed", () => {
        setError("Failed to reconnect after multiple attempts. Please refresh the page.")
      })

      socket.on("connect", () => {
        logAction(`Connected to server with ID: ${socket.id}`)
        setWebSocket(socket)
        setIsConnecting(false)
      })

      socket.on("connect_error", (err) => {
        logAction(`Connection error: ${err.message}`)
        setError("Failed to connect to server. Please try again later.")
        setIsConnecting(false)
      })

      // Set up event listeners
      const onChangeMedia = (data: ChangeMediaData) => {
        logAction(`Received change_media event:`, data)
        changeMedia(data)
      }
      const onSyncAction = (data: SyncActionData) => {
        logAction(`Received sync_action event:`, data)
        syncAction(data)
      }
      const onInitialSync = (data: SyncActionData) => {
        logAction(`Received initial_sync event:`, data)
        syncAction({ ...data, isInitialSync: true })
      }
      const onSyncPlaylist = (data: SyncPlaylistData) => {
        logAction(`Received sync_playlist event:`, data)
        syncPlaylist(data)
      }
      const onDisconnect = () => logAction("Disconnected from server")

      socket.on("change_media", onChangeMedia)
      socket.on("sync_action", onSyncAction)
      socket.on("initial_sync", onInitialSync)
      socket.on("sync_playlist", onSyncPlaylist)
      socket.on("disconnect", onDisconnect)

      // Set the socket state
      setWebSocket(socket)

      return () => {
        // Clean up timers
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current)
        }

        // Clean up socket listeners but don't disconnect
        socket.off("change_media", onChangeMedia)
        socket.off("sync_action", onSyncAction)
        socket.off("initial_sync", onInitialSync)
        socket.off("sync_playlist", onSyncPlaylist)
        socket.off("disconnect", onDisconnect)
      }
    } catch (err) {
      logAction(`Socket initialization error: ${err}`)
      setError("Failed to initialize connection. Please try again later.")
      setIsConnecting(false)

      return () => {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current)
        }
      }
    }
  }, [changeMedia, syncAction, syncPlaylist, logAction])

  // Effect to check loading state
  useEffect(() => {
    if (!isConnecting && loading) {
      const timeout = setTimeout(() => {
        if (loading) {
          logAction("Timeout reached, forcing loading to false")
          setLoading(false)
        }
      }, 10000)

      return () => clearTimeout(timeout)
    }
  }, [isConnecting, loading, logAction])

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
            onPrevious={handlePrevious}
            onNext={handleNext}
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
