"use client"

import { useState } from "react"
import type { Socket } from "socket.io-client"
import type { YouTubePlayer } from "react-youtube"
import { Button } from "./Button"
import { Input } from "./Input"
import Player from "./Player"

interface PlayerScreenProps {
  roomId: string
  socket: Socket
  currentVideoID: string
  myPlayList: string[]
  isProgrammatic: boolean
  loading: boolean
  handleLeave: () => void
  onPlayerReady: (player: YouTubePlayer) => void
  lastSyncActionRef: React.RefObject<{ action: string; time: number; videoId?: string; timestamp: number } | null>
}

export default function PlayerScreen({
  roomId,
  socket,
  handleLeave,
  currentVideoID,
  isProgrammatic,
  myPlayList,
  loading,
  onPlayerReady,
  lastSyncActionRef,
}: PlayerScreenProps) {
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const youtubeRegex =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/

  const isValidYouTubeURL = (url: string): boolean => {
    return youtubeRegex.test(url)
  }

  const handleAddMedia = () => {
    if (newVideoUrl && isValidYouTubeURL(newVideoUrl)) {
      socket.emit("upload_media", { videoUrl: newVideoUrl, roomId })
      setNewVideoUrl("")
    } else {
      alert("Please enter a valid YouTube URL")
    }
  }

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    alert("Room ID copied to clipboard!")
  }

  // Add these functions to the PlayerScreen component
  const handlePrevious = () => {
    if (socket) {
      socket.emit("change_media", { action: "prev", roomId })
    }
  }

  const handleNext = () => {
    if (socket) {
      socket.emit("change_media", { action: "next", roomId })
    }
  }

  return (
    <div
      className={`relative z-10 container mx-auto px-4 flex flex-col items-center justify-center min-h-screen py-8 ${roomId && !loading ? "" : "hidden"}`}
    >
      <div className="video-player w-full max-w-3xl flex flex-col items-center show">
        <div className="w-full flex justify-between items-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center gradient-text fade-in delay-300">Room: {roomId}</h2>
          <button onClick={handleCopyRoomId} className="text-white/70 hover:text-white text-sm underline">
            Copy Room ID
          </button>
        </div>

        <Player
          socket={socket}
          roomId={roomId}
          currentVideoID={currentVideoID}
          isProgrammatic={isProgrammatic}
          onPlayerReady={onPlayerReady}
          onPrevious={handlePrevious}
          onNext={handleNext}
          lastSyncActionRef={lastSyncActionRef}
        />

        <div className="w-full space-y-4 fade-in delay-400 mt-6">
          <div className="flex flex-col gap-2">
            <Input
              type="text"
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              placeholder="Enter a YouTube URL"
              className="w-full"
            />
            <Button
              onClick={handleAddMedia}
              label="Add"
              className="w-full px-4 flex-1"
              disabled={!newVideoUrl || !isValidYouTubeURL(newVideoUrl)}
            />
          </div>
          <Button onClick={handleLeave} label="Leave Room" />
        </div>
      </div>

      <Playlist myPlayList={myPlayList} />
    </div>
  )
}

const Playlist = ({ myPlayList }: { myPlayList: string[] }) => {
  const getVideoTitle = (url: string) => {
    // Extract video ID from URL
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^?&]+)/)
    const videoId = match && match[1]
    console.log(videoId)
    // For now, just show a shortened version of the URL
    // In a real app, you might want to fetch the actual title from YouTube API
    return url.length > 40 ? url.substring(0, 40) + "..." : url
  }

  return (
    <div className="mt-8 w-full max-w-3xl">
      {myPlayList.length > 0 && (
        <div className="glass-panel rounded-lg p-4">
          <h3 className="text-xl font-semibold mb-4 gradient-text">Playlist</h3>
          <div className="space-y-2">
            {myPlayList.map((videoUrl, index) => (
              <div key={index} className="p-3 bg-black/30 rounded-lg flex items-center">
                <div className="w-8 h-8 flex items-center justify-center bg-purple-800/50 rounded-full mr-3">
                  {index + 1}
                </div>
                <p className="flex-1 truncate">{getVideoTitle(videoUrl)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
