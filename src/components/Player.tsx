"use client"

import type React from "react"
import type { Socket } from "socket.io-client"

import { useState, useRef, useEffect, useCallback } from "react"
import YouTube, { type YouTubePlayer, type YouTubeEvent, type YouTubeProps } from "react-youtube"
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react"

interface PlayerProps {
  socket?: Socket
  roomId?: string
  currentVideoID?: string
  isProgrammatic?: boolean
  onPlayerReady: (player: YouTubePlayer) => void
  onPrevious?: () => void
  onNext?: () => void
  lastSyncActionRef?: React.RefObject<{ action: string; time: number; videoId?: string; timestamp: number } | null>
}

export default function Player({
  socket,
  roomId,
  currentVideoID,
  isProgrammatic,
  onPlayerReady,
  onPrevious,
  onNext,
  lastSyncActionRef,
}: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(50)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserActionRef = useRef<boolean>(false)
  const syncInProgressRef = useRef<boolean>(false)
  const seekingRef = useRef<boolean>(false)
  const wasPlayingBeforeSeekRef = useRef<boolean>(false)
  const playerReadyRef = useRef<boolean>(false)
  const initialLoadRef = useRef<boolean>(true)
  const videoIdRef = useRef<string | null>(null)
  const pendingVideoChangeRef = useRef<{ videoId: string; action?: string; time?: number } | null>(null)
  const videoChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debug logging helper
  const logAction = useCallback((message: string, data?: unknown) => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0]
    console.log(`[${timestamp}] PLAYER: ${message}`, data || "")
  }, [])

  // Start/stop progress tracking based on play state
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      // Update progress every second
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          try {
            const time = playerRef.current.getCurrentTime() || 0
            setCurrentTime(time)
          } catch (err) {
            logAction("Error getting current time", err)
          }
        }
      }, 1000)
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [isPlaying, logAction])

  // Safe method to cue or load a video
  const safeLoadVideo = useCallback(
    (videoId: string, action?: string, time = 0) => {
      if (!playerRef.current || !playerReadyRef.current) {
        logAction("Player not ready for video change, storing as pending", { videoId, action, time })
        pendingVideoChangeRef.current = { videoId, action, time }
        return false
      }

      try {
        syncInProgressRef.current = true
        logAction(`Safely loading video ${videoId} with action ${action} at time ${time}`)

        if (action === "play" || action === "seek_playing") {
          logAction(`Loading and playing video ${videoId} at ${time}`)
          playerRef.current.loadVideoById({ videoId, startSeconds: time })

          // Force play after a short delay to ensure it actually plays
          setTimeout(() => {
            if (playerRef.current) {
              try {
                logAction("Forcing play after video load")
                playerRef.current.playVideo()
              } catch (err) {
                logAction("Error forcing play", err)
              }
            }
          }, 500)
        } else {
          logAction(`Cueing video ${videoId} at ${time}`)
          playerRef.current.cueVideoById({ videoId, startSeconds: time })

          // For pause actions, ensure we're actually paused
          if (action === "pause" || action === "seek_paused") {
            setTimeout(() => {
              if (playerRef.current) {
                try {
                  playerRef.current.pauseVideo()
                } catch (err) {
                  logAction("Error pausing video", err)
                }
              }
            }, 500)
          }
        }

        // Reset sync flag after a delay
        setTimeout(() => {
          syncInProgressRef.current = false
        }, 1000)

        return true
      } catch (err) {
        logAction(`Error loading video: ${err}`)
        syncInProgressRef.current = false

        // Store as pending to retry
        pendingVideoChangeRef.current = { videoId, action, time }

        // Schedule a retry
        if (videoChangeTimeoutRef.current) {
          clearTimeout(videoChangeTimeoutRef.current)
        }

        videoChangeTimeoutRef.current = setTimeout(() => {
          if (pendingVideoChangeRef.current) {
            const { videoId, action, time } = pendingVideoChangeRef.current
            logAction("Retrying video change", { videoId, action, time })
            safeLoadVideo(videoId, action, time || 0)
            pendingVideoChangeRef.current = null
          }
        }, 1000)

        return false
      }
    },
    [logAction],
  )

  // When currentVideoID changes, update the player
  useEffect(() => {
    if (currentVideoID && currentVideoID !== videoIdRef.current) {
      logAction(`Video ID changed to: ${currentVideoID}`)
      videoIdRef.current = currentVideoID

      // Clear any pending video change timeout
      if (videoChangeTimeoutRef.current) {
        clearTimeout(videoChangeTimeoutRef.current)
        videoChangeTimeoutRef.current = null
      }

      // Check if we have a lastSyncAction with this videoId
      if (lastSyncActionRef?.current?.videoId === currentVideoID) {
        const { action, time } = lastSyncActionRef.current
        logAction(`Using last sync action for new video: ${action} at ${time}`)
        safeLoadVideo(currentVideoID, action, time || 0)
      } else {
        // Default to cue (don't autoplay)
        safeLoadVideo(currentVideoID, "pause", 0)
      }
    }
  }, [currentVideoID, lastSyncActionRef, safeLoadVideo, logAction])

  // Check for pending video changes when player becomes ready
  useEffect(() => {
    if (playerReadyRef.current && pendingVideoChangeRef.current) {
      const { videoId, action, time } = pendingVideoChangeRef.current
      logAction("Applying pending video change now that player is ready", { videoId, action, time })
      safeLoadVideo(videoId, action, time || 0)
      pendingVideoChangeRef.current = null
    }
  }, [playerReadyRef.current, safeLoadVideo, logAction])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      if (videoChangeTimeoutRef.current) {
        clearTimeout(videoChangeTimeoutRef.current)
      }
    }
  }, [])

  // Function to emit sync actions to the server
  const emitSyncAction = useCallback(
    (action: string, time?: number) => {
      if (!socket || !roomId || syncInProgressRef.current || isProgrammatic) {
        logAction(`Not emitting ${action} - conditions not met`, {
          noSocket: !socket,
          noRoomId: !roomId,
          syncInProgress: syncInProgressRef.current,
          isProgrammatic,
        })
        return
      }

      const currentTime = time !== undefined ? time : playerRef.current?.getCurrentTime() || 0
      let videoId: string | undefined

      try {
        videoId = playerRef.current?.getVideoData()?.video_id
      } catch (err) {
        logAction("Error getting video data", err)
        videoId = currentVideoID
      }

      logAction(`Emitting ${action} action to server at time ${currentTime}`)
      socket.emit("sync_action", {
        action,
        time: currentTime,
        roomId,
        videoId,
        timestamp: Date.now(),
      })
    },
    [socket, roomId, isProgrammatic, currentVideoID, logAction],
  )

  const handlePlayerReady = useCallback(
    (event: YouTubeEvent) => {
      logAction("YouTube Player Ready")
      playerRef.current = event.target
      playerReadyRef.current = true

      try {
        // Set initial volume
        playerRef.current.setVolume(volume)

        // Mark player as ready
        onPlayerReady(event.target)

        // If we already have a video ID, load it
        if (currentVideoID) {
          logAction(`Loading initial video: ${currentVideoID}`)
          videoIdRef.current = currentVideoID

          // If we have a lastSyncAction with a time, use it
          if (lastSyncActionRef?.current) {
            const { time, action } = lastSyncActionRef.current
            logAction(`Using last sync action time: ${time}, action: ${action}`)
            safeLoadVideo(currentVideoID, action, time || 0)
          } else {
            safeLoadVideo(currentVideoID, "pause", 0)
          }
        }

        // Check for any pending video changes
        if (pendingVideoChangeRef.current) {
          const { videoId, action, time } = pendingVideoChangeRef.current
          logAction("Applying pending video change now that player is ready", { videoId, action, time })
          safeLoadVideo(videoId, action, time || 0)
          pendingVideoChangeRef.current = null
        }

        // Get video duration after player is ready
        setTimeout(() => {
          if (playerRef.current) {
            try {
              const duration = playerRef.current.getDuration()
              if (duration && duration > 0) {
                setDuration(duration)
              }
            } catch (err) {
              logAction("Could not get duration yet", err)
            }
          }

          // Mark initial load as complete
          initialLoadRef.current = false
        }, 1000)
      } catch (err) {
        logAction("Error in handlePlayerReady", err)
      }
    },
    [currentVideoID, volume, onPlayerReady, lastSyncActionRef, safeLoadVideo, logAction],
  )

  const onPlayerStateChange = useCallback(
    (event: YouTubeEvent) => {
      if (!playerRef.current) return

      try {
        const playerState = event.data
        const currentTime = playerRef.current.getCurrentTime() || 0

        logAction(`Player state changed: ${playerState}`)

        // Ignore buffering state
        if (playerState === 3) {
          logAction("Ignoring buffering state")
          return
        }

        if (playerState === 1) {
          // Playing
          setIsPlaying(true)

          // Emit play action if this is a user action
          if (isUserActionRef.current) {
            logAction(`User initiated play at ${currentTime}`)
            emitSyncAction("play", currentTime)
            isUserActionRef.current = false
          }

          // If we were seeking and now playing, emit a play action
          if (seekingRef.current) {
            seekingRef.current = false

            // Only emit if it was a user-initiated seek  {
            seekingRef.current = false

            // Only emit if it was a user-initiated seek
            if (wasPlayingBeforeSeekRef.current) {
              logAction(`Emitting play after seek at ${currentTime}`)
              emitSyncAction("play", currentTime)
            }
          }
        } else if (playerState === 2) {
          // Paused
          setIsPlaying(false)

          // Emit pause action if this is a user action
          if (isUserActionRef.current && !seekingRef.current) {
            logAction(`User initiated pause at ${currentTime}`)
            emitSyncAction("pause", currentTime)
            isUserActionRef.current = false
          }
        } else if (playerState === 0) {
          // Ended
          setIsPlaying(false)
          if (!isProgrammatic) {
            logAction("Video ended, emitting end action")
            emitSyncAction("end")
          }
        } else if (playerState === 5) {
          // Video cued
          setIsPlaying(false)

          // If we have a lastSyncAction that says we should be playing, play it
          if (lastSyncActionRef?.current?.action === "play" || lastSyncActionRef?.current?.action === "seek_playing") {
            logAction("Video cued, but last sync action was play, so playing")
            setTimeout(() => {
              if (playerRef.current) {
                try {
                  playerRef.current.playVideo()
                } catch (err) {
                  logAction("Error playing video after cue", err)
                }
              }
            }, 500)
          }
        }
      } catch (err) {
        logAction("Error in onPlayerStateChange", err)
      }
    },
    [emitSyncAction, isProgrammatic, lastSyncActionRef, logAction],
  )

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return

    try {
      // Mark this as a user action BEFORE calling the YouTube API
      isUserActionRef.current = true
      logAction(`User clicked ${isPlaying ? "pause" : "play"} button`)

      if (isPlaying) {
        playerRef.current.pauseVideo()
      } else {
        playerRef.current.playVideo()
      }
    } catch (err) {
      logAction("Error in togglePlay", err)
    }
  }, [isPlaying, logAction])

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return

    try {
      if (isMuted) {
        playerRef.current.unMute()
        playerRef.current.setVolume(volume)
      } else {
        playerRef.current.mute()
      }
      setIsMuted(!isMuted)
    } catch (err) {
      logAction("Error in toggleMute", err)
    }
  }, [isMuted, volume, logAction])

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!playerRef.current) return

      try {
        const newVolume = Number.parseInt(e.target.value, 10)
        setVolume(newVolume)
        playerRef.current.setVolume(newVolume)

        // If volume is 0, mute the player, otherwise ensure it's unmuted
        if (newVolume === 0 && !isMuted) {
          playerRef.current.mute()
          setIsMuted(true)
        } else if (newVolume > 0 && isMuted) {
          playerRef.current.unMute()
          setIsMuted(false)
        }
      } catch (err) {
        logAction("Error in handleVolumeChange", err)
      }
    },
    [isMuted, logAction],
  )

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!playerRef.current || syncInProgressRef.current) return

      try {
        const seekTime = Number.parseFloat(e.target.value)
        logAction(`User seeking to ${seekTime}`)

        // Remember if the video was playing before seeking
        wasPlayingBeforeSeekRef.current = isPlaying

        // Mark as seeking to prevent unwanted pause events
        seekingRef.current = true

        // Mark as user action to ensure we emit events
        isUserActionRef.current = true

        // Mark as sync in progress to prevent event loops
        syncInProgressRef.current = true

        // Seek to the new time
        playerRef.current.seekTo(seekTime, true)
        setCurrentTime(seekTime)

        // Emit seek event to sync with other users
        if (roomId && socket) {
          logAction(`Emitting seek to ${seekTime} to server (playing: ${wasPlayingBeforeSeekRef.current})`)
          socket.emit("sync_action", {
            action: wasPlayingBeforeSeekRef.current ? "seek_playing" : "seek_paused",
            time: seekTime,
            roomId,
            videoId: currentVideoID,
            timestamp: Date.now(),
          })
        }

        // Reset sync flag after a delay
        setTimeout(() => {
          syncInProgressRef.current = false

          // If it was playing before, ensure it's still playing
          if (wasPlayingBeforeSeekRef.current && playerRef.current) {
            playerRef.current.playVideo()
          }
        }, 500)
      } catch (err) {
        logAction("Error in handleSeek", err)
        syncInProgressRef.current = false
      }
    },
    [isPlaying, roomId, socket, currentVideoID, logAction],
  )

  const handlePrevious = useCallback(() => {
    if (onPrevious) {
      logAction("User clicked previous button")
      // Add a visual feedback that the button was clicked
      const prevButton = document.querySelector('[aria-label="Previous video"]')
      if (prevButton) {
        prevButton.classList.add("bg-white/20")
        setTimeout(() => {
          prevButton.classList.remove("bg-white/20")
        }, 200)
      }
      onPrevious()
    }
  }, [onPrevious, logAction])

  const handleNext = useCallback(() => {
    if (onNext) {
      logAction("User clicked next button")
      // Add a visual feedback that the button was clicked
      const nextButton = document.querySelector('[aria-label="Next video"]')
      if (nextButton) {
        nextButton.classList.add("bg-white/20")
        setTimeout(() => {
          nextButton.classList.remove("bg-white/20")
        }, 200)
      }
      onNext()
    }
  }, [onNext, logAction])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }, [])

  const opts: YouTubeProps["opts"] = {
    height: "100%",
    width: "100%",
    playerVars: {
      rel: 0,
      autoplay: 0, // Start paused
      controls: 0, // Hide YouTube controls
      modestbranding: 1,
      disablekb: 0, // Enable keyboard controls
      enablejsapi: 1,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    },
  }

  // Use a default video ID if none is provided
  const videoId = currentVideoID || "2Vv-BfVoq4g" // Default to Ed Sheeran - Shape of You

  return (
    <div className="w-full">
      <div className="relative w-full max-w-3xl aspect-video mx-auto rounded-lg overflow-hidden shadow-[0_0_25px_rgba(123,104,238,0.4)] mb-4 fade-in delay-500">
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={handlePlayerReady}
          onStateChange={onPlayerStateChange}
          className="w-full h-full"
        />
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-3xl mx-auto mb-4">
        <div className="flex items-center justify-between text-xs text-white/70 mb-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Controls */}
      <div className="bg-black/60 backdrop-blur-sm p-4 rounded-lg w-full max-w-3xl flex items-center gap-4 mx-auto">
        <button
          onClick={togglePlay}
          className="text-white hover:bg-white/10 p-2 rounded-full"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>

        <div className="flex-1 flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-white hover:bg-white/10 p-2 rounded-full"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <button
          onClick={handlePrevious}
          className="text-white hover:bg-white/10 p-2 rounded-full"
          aria-label="Previous video"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button onClick={handleNext} className="text-white hover:bg-white/10 p-2 rounded-full" aria-label="Next video">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
