'use client';
import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import JoinScreen from './JoinScreen';
import PlayerScreen from './PlayerScreen';
import Background from './Background';
import type { YouTubePlayer } from "react-youtube"

import './style.css'

export default function Container() {
    const [webSocket, setWebSocket] = useState<Socket | null>(null);
    const [roomId, setRoomId] = useState('');
    const playerRef = useRef<YouTubePlayer>(null)
    const [currentVideoID, setCurrentVideoId] = useState("")
    const [myPlayList, setMyPlayList] = useState<string[]>([])
    const [isProgrammatic, setIsProgrammatic] = useState(false)

    function socketOnConnect() {
        console.log('Connected to server')
    };
    const handleJoin = (roomId: string) => {
        if (roomId && webSocket) {
            webSocket?.emit('join_room', { roomId: roomId.trim() });
            setRoomId(roomId);
        }
    };
    function handleLeave() {

        if (roomId && webSocket) {
            webSocket?.emit('leave_room', { roomId });
            setRoomId('');
        }
    }

    function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value.trim()
        event.target.value = value
    }

    const changeMedia = ({ videoId }: { videoId: string }) => {
        if (playerRef.current) {
            playerRef.current.loadVideoById({ videoId, startSeconds: 0 })
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
        // if (!playerRef.current) return

        setIsProgrammatic(true)

        if (videoId && currentVideoID !== videoId) {
            setCurrentVideoId(videoId)
            playerRef?.current?.loadVideoById({
                videoId,
                startSeconds: time || 0,
            })

            playerRef?.current?.addEventListener("onStateChange", function onStateChange(event: any) {
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
        const socket = io('http://localhost:3000');

        socket.on("change_media", changeMedia)
        socket.on("sync_action", syncAction)
        socket.on("sync_playlist", syncPlaylist)
        socket.on("disconnect", disconnect)
        setWebSocket(socket);
        socket.on('connect', socketOnConnect);

        return () => {
            socket.off("change_media", changeMedia)
            socket.off("sync_action", syncAction)
            socket.off("sync_playlist", syncPlaylist)
            socket.off("disconnect", disconnect)
            socket.off('connect', socketOnConnect);
            socket.disconnect();
        }

    }, []);

    return (
        <>
            <Background />
            {roomId ? (
                <PlayerScreen 
                roomId={roomId} 
                socket={webSocket!} 
                handleLeave={handleLeave} 
                myPlayList={myPlayList}  
                currentVideoID={currentVideoID} 
                isProgrammatic={isProgrammatic}
                ref={playerRef} />
            ) : (
                <JoinScreen handleJoin={handleJoin} />
            )}
        </>
    );
}

// function createBackgroundElements() {
//     // Create circles
//     for (let i = 0; i < 30; i++) {
//         const circle = document.createElement('div');
//         circle.className = 'animated-circle';

//         const size = Math.random() * 20 + 5;
//         const r = Math.random() * 100 + 100;
//         const g = Math.random() * 50;
//         const b = Math.random() * 255;
//         const opacity = Math.random() * 0.5 + 0.2;

//         circle.style.width = `${size}px`;
//         circle.style.height = `${size}px`;
//         circle.style.top = `${Math.random() * 100}%`;
//         circle.style.left = `${Math.random() * 100}%`;
//         circle.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
//         circle.style.boxShadow = `0 0 ${Math.random() * 30 + 10}px rgba(${r}, ${g}, ${b}, ${opacity + 0.1})`;
//         circle.style.animation = `float ${Math.random() * 15 + 10}s linear infinite, pulse ${Math.random() * 5 + 2}s ease-in-out infinite alternate`;
//         circle.style.animationDelay = `${Math.random() * 5}s`;

//         animatedCircles.appendChild(circle);
//     }

//     // Create waves
//     for (let i = 0; i < 5; i++) {
//         const wave = document.createElement('div');
//         wave.className = 'animated-wave';

//         const r = Math.random() * 100 + 100;
//         const g = Math.random() * 100;
//         const b = Math.random() * 255;

//         wave.style.background = `rgba(${r}, ${g}, ${b}, 0.1)`;
//         wave.style.animation = `wave ${10 + i * 3}s ease-in-out infinite alternate`;
//         wave.style.animationDelay = `${i * 0.5}s`;
//         wave.style.bottom = `${i * 10 - 40}px`;

//         animatedWaves.appendChild(wave);
//     }
// }

// createBackgroundElements();
//     nextButton.onclick = () => roomId && socket.emit('change_media', { action: 'next', roomId });
//     prevButton.onclick = () => roomId && socket.emit('change_media', { action: 'prev', roomId });
//     uploadMediaButton.onclick = () => {
//         const videoUrl = urlInput.value.trim();
//         if (!isValidYouTubeURL(videoUrl)) {
//             return alert('Invalid YouTube URL');
//         }
//         if (roomId) {
//             socket.emit('upload_media', { videoUrl, roomId });
//         }
// };

