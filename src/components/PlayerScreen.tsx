"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import type { YouTubePlayer } from "react-youtube"
import { Button } from "./Button"
import Player from "./Player"

// Define types at the top
type PlayerRef = React.RefObject<YouTubePlayer>

interface ComponentTypes {
    roomId: string
    socket: Socket
    handleLeave: () => void
}

export default function PlayerScreen({ roomId, socket, handleLeave }: ComponentTypes) {
    const [myPlayList, setMyPlayList] = useState<string[]>([])
    const playerRef = useRef<YouTubePlayer>(null)
    const [isProgrammatic, setIsProgrammatic] = useState(false)

    function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value.trim()
        event.target.value = value
    }

    const changeMedia = ({ videoId }: { videoId: string }) => {
        if (playerRef.current) {
            playerRef.current.loadVideoById({ videoId, startSeconds: 0 })
        }
    }
    const [currentVideoID, setCurrentVideoId] = useState("")

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
        if (!playerRef.current) return


        setIsProgrammatic(true)

        if (videoId && currentVideoID !== videoId) {
            setCurrentVideoId(videoId)
            playerRef.current.loadVideoById({
                videoId,
                startSeconds: time || 0,
            })

            playerRef.current.addEventListener("onStateChange", function onStateChange(event: any) {
                if (event.data === 1 || event.data === 5) {
                    setIsProgrammatic(false)
                    playerRef.current?.removeEventListener("onStateChange", onStateChange)
                }
            })
        } else {
            if (action === "play" && playerRef.current.getPlayerState() === 1 && strict) {
                // PLAYING
                playerRef.current.seekTo(playerRef.current.getCurrentTime(), true)
                playerRef.current.playVideo()
            } else if (action === "play" && playerRef.current.getPlayerState() !== 1) {
                playerRef.current.seekTo(time, true)
                playerRef.current.playVideo()
            } else if (action === "pause" && playerRef.current.getPlayerState() !== 2) {
                // PAUSED
                playerRef.current.pauseVideo()
            } else if (action === "seek" && Math.abs(playerRef.current.getCurrentTime() - time) > 1) {
                playerRef.current.seekTo(time, true)
            }

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
        setMyPlayList(playlist)
    }

    const disconnect = () => console.log("Disconnected from server")

    useEffect(() => {
        socket.on("change_media", changeMedia)
        socket.on("sync_action", syncAction)
        socket.on("sync_playlist", syncPlaylist)
        socket.on("disconnect", disconnect)

        return () => {
            socket.off("change_media", changeMedia)
            socket.off("sync_action", syncAction)
            socket.off("sync_playlist", syncPlaylist)
            socket.off("disconnect", disconnect)
        }
    }, [socket])

    const handleAddMedia = () => {
        // Implement add media functionality
        const input = document.getElementById("url-input") as HTMLInputElement
        if (input && input.value) {
            // Add implementation here
            console.log("Adding media:", input.value)
        }
    }

    return (
        <div className="relative z-10 container mx-auto px-4 flex flex-col items-center justify-center min-h-screen">
            <div className="video-player max-w-3xl flex flex-col items-center show">
                <h2
                    id="room-display"
                    className="text-2xl md:text-3xl font-bold mb-6 text-center gradient-text fade-in delay-300"
                >
                    Room: {roomId}
                </h2>

                <Player socket={socket} roomId={roomId} currentVideoID={currentVideoID} isProgrammatic={isProgrammatic} ref={playerRef} />

                <div className="space-y-4 fade-in delay-400">
                    <input
                        type="text"
                        id="url-input"
                        placeholder="Enter a YouTube URL"
                        onChange={handleInputChange}
                        className="input-field w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />

                    <Button onClick={handleAddMedia} label="Add Media" />
                    <Button onClick={handleLeave} label="Leave Room" />
                </div>
            </div>
            <Playlist myPlayList={myPlayList} />
        </div>
    )
}

const Playlist = ({ myPlayList }: { myPlayList: string[] }) => {
    return (
        <div className="mt-6 w-full max-w-3xl">
            {myPlayList.length > 0 && <h3 className="text-xl font-semibold mb-2">Playlist</h3>}
            {myPlayList.map((videoUrl, index) => (
                <p key={index} className="p-2 bg-black/20 rounded mb-1">
                    {videoUrl}
                </p>
            ))}
        </div>
    )
}

