"use client"

import type React from "react"
import type { Socket } from "socket.io-client"

import { useState, useRef, useEffect } from "react"
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
  lastSyncActionRef
}: PlayerProps) {
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

  useEffect(() => {
    if (isPlaying && playerRef.current) {
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

  const emitSyncAction = (action: string, time?: number) => {
    if (!socket || !roomId || syncInProgressRef.current || isProgrammatic) return

    const currentTime = time !== undefined ? time : playerRef.current?.getCurrentTime() || 0
    const videoId = playerRef.current?.getVideoData()?.video_id

    console.log(`Emitting ${action} action to server at time ${currentTime}`)
    socket.emit("sync_action", {
      action,
      time: currentTime,
      roomId,
      videoId,
    })
  }

  const handlePlayerReady = (event: YouTubeEvent) => {
    console.log("YouTube Player Ready")
    playerRef.current = event.target
    playerRef.current.setVolume(volume)

    setTimeout(() => {
      if (playerRef.current) {
        if(lastSyncActionRef?.current?.action === "play"){
          lastSyncActionRef.current.time +=1000;
        }
        if (currentVideoID) {
          console.log("Loading initial video:", currentVideoID)
          onPlayerReady(event.target)
        }
        try {
          const duration = playerRef.current.getDuration()
          if (duration && duration > 0) {
            setDuration(duration)
          }
        } catch {
          setDuration(0)
        }
      }

      isInitialLoadRef.current = false
    }, 1000)
  }

  const onPlayerStateChange = (event: YouTubeEvent) => {
    if (!playerRef.current) return

    const playerState = event.data
    const currentTime = playerRef.current.getCurrentTime() || 0

    console.log("Player state changed:", playerState)

    if (playerState === 3) {
      return
    }

    if (playerState === 1) {
      setIsPlaying(true)

      if (isUserActionRef.current) {
        emitSyncAction("play")
        isUserActionRef.current = false
      }

      if (seekingRef.current) {
        seekingRef.current = false
        emitSyncAction("play", currentTime)
      }
    } else if (playerState === 2) {
      setIsPlaying(false)

      if (isUserActionRef.current && !seekingRef.current) {
        emitSyncAction("pause")
        isUserActionRef.current = false
      }
    } else if (playerState === 0) {
      setIsPlaying(false)
      emitSyncAction("end")
    }
  }

  const togglePlay = () => {
    if (!playerRef.current) return

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

    wasPlayingBeforeSeekRef.current = isPlaying
    seekingRef.current = true
    isUserActionRef.current = true
    syncInProgressRef.current = true
    playerRef.current.seekTo(seekTime, true)
    setCurrentTime(seekTime)

    if (roomId && socket) {
      socket.emit("sync_action", {
        action: wasPlayingBeforeSeekRef.current ? "seek_playing" : "seek_paused",
        time: seekTime,
        roomId,
        videoId: playerRef.current.getVideoData()?.video_id,
      })
    }

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
    if (onPrevious) {
      onPrevious()
    }
  }

  const handleNext = () => {
    if (onNext) {
      onNext()
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
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      disablekb: 0,
      enablejsapi: 1,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    },
  }

  const videoId = currentVideoID;

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
