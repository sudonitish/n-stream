"use client"

import type React from "react"

import { forwardRef, useImperativeHandle, useState, useRef } from "react"
import YouTube, { type YouTubePlayer, type YouTubeEvent, type YouTubeProps } from "react-youtube"
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react"

interface PlayerProps {
  socket?: any
  roomId?: string
  currentVideoID?: string
  isProgrammatic?: boolean
}

const Player = forwardRef<YouTubePlayer, PlayerProps>(({ socket, roomId,currentVideoID ,isProgrammatic }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(30)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const youtubeRegex =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/

  // Expose the player instance to the parent component
  useImperativeHandle(ref, () => playerRef.current as YouTubePlayer)

  const onPlayerReady = (event: YouTubeEvent) => {
    console.log("YouTube Player Ready")
    playerRef.current = event.target
    playerRef.current.setVolume(volume)
  }

  const onPlayerStateChange = (event: YouTubeEvent) => {
    console.log(event)

    if (!roomId || isProgrammatic) return

    const currentTime = playerRef.current?.getCurrentTime() || 0
    const playerState = event.data
    let action: string | null = null

    if (playerState === 1) {
      action = "play"
      setIsPlaying(true)
    } else if (playerState === 2) {
      action = "pause"
      setIsPlaying(false)
    } else if (playerState === 3) {
      action = "seek"
    } else if (playerState === 0) {
      action = "end"
      setIsPlaying(false)
    }

    if (action && socket) {
      socket.emit("sync_action", {
        action,
        time: currentTime,
        roomId,
        videoId: playerRef.current?.getVideoData()?.video_id,
      })
    }
  }

  const togglePlay = () => {
    if (!playerRef.current) return

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

  const isValidYouTubeURL = (url: string): boolean => {
    return youtubeRegex.test(url)
  }

  const handlePrevious = () => {
    // Implement previous video functionality
    console.log("Previous video")
    if (socket && roomId) {
      socket.emit("previous_video", { roomId })
    }
  }

  const handleNext = () => {
    // Implement next video functionality
    console.log("Next video")
    if (socket && roomId) {
      socket.emit("next_video", { roomId })
    }
  }

  const opts: YouTubeProps["opts"] = {
    height: "100%",
    width: "100%",
    playerVars: {
      rel: 0,
      autoplay: 1,
      controls: 0,
      modestbranding: 1,
      disablekb: 1,
      enablejsapi: 1,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    },
  }

  return (
    <div>
      <div className="relative w-full max-w-3xl aspect-video mx-auto rounded-lg overflow-hidden shadow-[0_0_25px_rgba(123,104,238,0.4)] mb-8 fade-in delay-500">
        <YouTube
          videoId={currentVideoID}
          opts={opts}
          onReady={onPlayerReady}
          onStateChange={onPlayerStateChange}
          className="w-full h-full"
        />
      </div>

      <div className="bg-black/60 backdrop-blur-sm p-4 rounded-lg w-full max-w-md flex items-center gap-4 mt-4 mx-auto">
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
})

Player.displayName = "Player"

export default Player

