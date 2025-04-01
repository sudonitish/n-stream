"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import YouTube, { type YouTubePlayer, type YouTubeEvent, type YouTubeProps } from "react-youtube"
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react"

interface PlayerProps {
  socket?: any
  roomId?: string
  currentVideoID?: string
  isProgrammatic?: boolean
  onPlayerReady: (player: YouTubePlayer) => void
}

export default function Player({ socket, roomId, currentVideoID, isProgrammatic, onPlayerReady }: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(50)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [playerInitialized, setPlayerInitialized] = useState(false)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playerReadyCallbackRef = useRef<boolean>(false)
  const isUserActionRef = useRef<boolean>(false)
  const lastActionRef = useRef<{ action: string; time: number; timestamp: number } | null>(null)

  // Start/stop progress tracking based on play state
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      // Update progress every second
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const time = playerRef.current.getCurrentTime() || 0
          setCurrentTime(time)
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
  }, [isPlaying])

  // When currentVideoID changes, update the player if it's already initialized
  useEffect(() => {
    if (playerInitialized && playerRef.current && currentVideoID) {
      console.log("Loading video from effect:", currentVideoID)
      // Use cueVideoById instead of loadVideoById to prevent auto-play
      isUserActionRef.current = false
      playerRef.current.cueVideoById({ videoId: currentVideoID, startSeconds: 0 })
      setIsPlaying(false)
    }
  }, [currentVideoID, playerInitialized])

  const handlePlayerReady = (event: YouTubeEvent) => {
    console.log("YouTube Player Ready")
    playerRef.current = event.target

    // Set initial volume
    playerRef.current.setVolume(volume)

    // Pause by default
    isUserActionRef.current = false
    event.target.pauseVideo()
    setIsPlaying(false)

    // Mark player as initialized
    setPlayerInitialized(true)

    // Notify parent component that player is ready
    // Only do this once to prevent multiple callbacks
    if (!playerReadyCallbackRef.current) {
      console.log("Calling onPlayerReady callback")
      onPlayerReady(event.target)
      playerReadyCallbackRef.current = true
    }

    // If we already have a video ID, load it
    if (currentVideoID) {
      console.log("Loading initial video:", currentVideoID)
      // Use cueVideoById instead of loadVideoById to prevent auto-play
      event.target.cueVideoById({ videoId: currentVideoID, startSeconds: 0 })
    }

    // Get video duration after player is ready
    setTimeout(() => {
      if (playerRef.current) {
        try {
          const duration = playerRef.current.getDuration()
          if (duration && duration > 0) {
            setDuration(duration)
          }
        } catch (e) {
          console.warn("Could not get duration yet")
        }
      }
    }, 500)
  }

  const onPlayerStateChange = (event: YouTubeEvent) => {
    if (!roomId || !playerRef.current) return

    const currentTime = playerRef.current.getCurrentTime() || 0
    const playerState = event.data

    // Update local state based on player state
    if (playerState === 1) {
      // Playing
      setIsPlaying(true)

      // Update duration when video starts playing
      try {
        const duration = playerRef.current.getDuration()
        if (duration && duration > 0) {
          setDuration(duration)
        }
      } catch (e) {
        console.warn("Could not get duration")
      }
    } else if (playerState === 2) {
      // Paused
      setIsPlaying(false)
    } else if (playerState === 0) {
      // Ended
      setIsPlaying(false)
    }

    // Only emit events if this was a user action and not programmatic
    if (isUserActionRef.current && !isProgrammatic) {
      let action: string | null = null

      if (playerState === 1) {
        action = "play"
      } else if (playerState === 2) {
        action = "pause"
      } else if (playerState === 0) {
        action = "end"
      }

      if (action && socket) {
        // Check if this is a duplicate action (prevent rapid fire events)
        const now = Date.now()
        const lastAction = lastActionRef.current

        if (
          !lastAction ||
          lastAction.action !== action ||
          Math.abs(lastAction.time - currentTime) > 1 ||
          now - lastAction.timestamp > 500
        ) {
          console.log(`Emitting ${action} at ${currentTime} to server (user action)`)
          socket.emit("sync_action", {
            action,
            time: currentTime,
            roomId,
            videoId: playerRef.current.getVideoData()?.video_id,
          })

          // Store this action to prevent duplicates
          lastActionRef.current = {
            action,
            time: currentTime,
            timestamp: now,
          }
        }
      }

      // Reset the user action flag
      isUserActionRef.current = false
    }
  }

  const togglePlay = () => {
    if (!playerRef.current) return

    // Mark this as a user action
    isUserActionRef.current = true

    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  const toggleMute = () => {
    if (!playerRef.current) return

    if (isMuted) {
      playerRef.current.unMute()
      playerRef.current.setVolume(volume)
    } else {
      playerRef.current.mute()
    }
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current) return

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
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current) return

    // Mark this as a user action
    isUserActionRef.current = true

    const seekTime = Number.parseFloat(e.target.value)
    playerRef.current.seekTo(seekTime, true)
    setCurrentTime(seekTime)

    // Emit seek event to sync with other users
    if (socket && roomId) {
      console.log(`Emitting seek to ${seekTime} to server (user action)`)
      socket.emit("sync_action", {
        action: "seek",
        time: seekTime,
        roomId,
        videoId: playerRef.current.getVideoData()?.video_id,
      })

      // Store this action to prevent duplicates
      lastActionRef.current = {
        action: "seek",
        time: seekTime,
        timestamp: Date.now(),
      }
    }
  }

  const handlePrevious = () => {
    if (socket && roomId) {
      socket.emit("change_media", { action: "prev", roomId })
    }
  }

  const handleNext = () => {
    if (socket && roomId) {
      socket.emit("change_media", { action: "next", roomId })
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

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

