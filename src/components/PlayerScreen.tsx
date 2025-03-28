"use client"

import type React from "react"

import { forwardRef, useEffect, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import type { YouTubePlayer } from "react-youtube"
import { Button } from "./Button"
import Player from "./Player"

// Define types at the top

interface ComponentTypes {
    roomId: string;
    socket: Socket;
    currentVideoID: string;
    myPlayList: string[];
    isProgrammatic: boolean;
    handleLeave: () => void;
}
const PlayerScreen= forwardRef<YouTubePlayer, ComponentTypes>(({ roomId, socket, handleLeave , currentVideoID , isProgrammatic , myPlayList}, ref) => {


    const handleAddMedia = () => {
        const input = document.getElementById("url-input") as HTMLInputElement
        if (input && input.value) {
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

                <Player socket={socket} roomId={roomId} currentVideoID={currentVideoID} isProgrammatic={isProgrammatic} ref={ref} />

                <div className="space-y-4 fade-in delay-400">
                    <input
                        type="text"
                        id="url-input"
                        placeholder="Enter a YouTube URL"
                        // onChange={handleInputChange}
                        className="input-field w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />

                    <Button onClick={handleAddMedia} label="Add Media" />
                    <Button onClick={handleLeave} label="Leave Room" />
                </div>
            </div>
            <Playlist myPlayList={myPlayList} />
        </div>
    )
})

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

export default PlayerScreen;