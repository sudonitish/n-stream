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
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserActionRef = useRef<boolean>(false)
  const isInitialLoadRef = useRef<boolean>(true)
  const syncInProgressRef = useRef<boolean>(false)
  const seekingRef = useRef<boolean>(false)
  const wasPlayingBeforeSeekRef = useRef<boolean>(false)

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

  // When currentVideoID changes, update the player
  useEffect(() => {
    if (playerRef.current && currentVideoID) {
      console.log("Loading new video:", currentVideoID)
      syncInProgressRef.current = true

      // Always cue the video (don't autoplay)
      playerRef.current.cueVideoById({ videoId: currentVideoID, startSeconds: 0 })
      setIsPlaying(false)

      // Reset sync flag after a delay
      setTimeout(() => {
        syncInProgressRef.current = false
      }, 1000)
    }
  }, [currentVideoID])

  const handlePlayerReady = (event: YouTubeEvent) => {
    console.log("YouTube Player Ready")
    playerRef.current = event.target

    // Set initial volume
    playerRef.current.setVolume(volume)

    // Mark player as ready
    onPlayerReady(event.target)

    // If we already have a video ID, load it
    if (currentVideoID) {
      console.log("Loading initial video:", currentVideoID)
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

      // Mark initial load as complete
      isInitialLoadRef.current = false
    }, 1000)
  }

  const onPlayerStateChange = (event: YouTubeEvent) => {
    if (!playerRef.current) return

    const playerState = event.data
    const currentTime = playerRef.current.getCurrentTime() || 0

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

      // If this is a user action and not a sync in progress, emit to server
      if (isUserActionRef.current && !syncInProgressRef.current && !isProgrammatic && roomId && socket) {
        console.log("Emitting play action to server")
        socket.emit("sync_action", {
          action: "play",
          time: currentTime,
          roomId,
          videoId: playerRef.current.getVideoData()?.video_id,
        })
        isUserActionRef.current = false
      }

      // If we were seeking and the video was playing before, we don't need to do anything
      if (seekingRef.current) {
        seekingRef.current = false
      }
    } else if (playerState === 2) {
      // Paused
      setIsPlaying(false)

      // If this is a user action and not a sync in progress or seeking, emit to server
      if (
        isUserActionRef.current &&
        !syncInProgressRef.current &&
        !seekingRef.current &&
        !isProgrammatic &&
        roomId &&
        socket
      ) {
        console.log("Emitting pause action to server")
        socket.emit("sync_action", {
          action: "pause",
          time: currentTime,
          roomId,
          videoId: playerRef.current.getVideoData()?.video_id,
        })
        isUserActionRef.current = false
      }
    } else if (playerState === 0) {
      // Ended
      setIsPlaying(false)

      // If this is a user action and not a sync in progress, emit to server
      if (!syncInProgressRef.current && !isProgrammatic && roomId && socket) {
        console.log("Emitting end action to server")
        socket.emit("sync_action", {
          action: "end",
          time: currentTime,
          roomId,
          videoId: playerRef.current.getVideoData()?.video_id,
        })
      }
    }

    // Reset user action flag if it's still set
    isUserActionRef.current = false
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
    if (!playerRef.current || syncInProgressRef.current) return

    const seekTime = Number.parseFloat(e.target.value)

    // Remember if the video was playing before seeking
    wasPlayingBeforeSeekRef.current = isPlaying

    // Mark as seeking to prevent unwanted pause events
    seekingRef.current = true

    // Mark as sync in progress to prevent event loops
    syncInProgressRef.current = true

    // Seek to the new time
    playerRef.current.seekTo(seekTime, true)
    setCurrentTime(seekTime)

    // Emit seek event to sync with other users
    if (roomId && socket) {
      console.log(`Emitting seek to ${seekTime} to server (playing: ${wasPlayingBeforeSeekRef.current})`)
      socket.emit("sync_action", {
        action: wasPlayingBeforeSeekRef.current ? "seek_playing" : "seek_paused",
        time: seekTime,
        roomId,
        videoId: playerRef.current.getVideoData()?.video_id,
      })
    }

    // Reset sync flag after a delay
    setTimeout(() => {
      syncInProgressRef.current = false
      seekingRef.current = false

      // If it was playing before, ensure it's still playing
      if (wasPlayingBeforeSeekRef.current && playerRef.current) {
        playerRef.current.playVideo()
      }
    }, 500)
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

