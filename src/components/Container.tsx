'use client';
import { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import JoinScreen from './JoinScreen';
import PlayerScreen from './PlayerScreen';
import Background from './Background';
import './style.css'

export default function Container() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [roomId, setRoomId] = useState('');
    function socketOnConnect() {
        console.log('Connected to server')
    };
    const handleJoin = (roomId: string) => {
        if (roomId && socket) {
            socket.emit('join_room', { roomId: roomId.trim() });
            setRoomId(roomId);
        }
    };
    function handleLeave() {

        if (roomId && socket) {
            socket.emit('leave_room', { roomId });
            setRoomId('');
        }
    }

    useEffect(() => {
        const newSocket = io();
        setSocket(newSocket);
        newSocket.on('connect', socketOnConnect);

        return () => {
            newSocket.off('connect', socketOnConnect);
            newSocket.disconnect();
        };
    }, []);

    return (
        <>
            <Background />
            {roomId ? (
                <PlayerScreen roomId={roomId} socket={socket!} handleLeave={handleLeave} />
            ) : (
                <JoinScreen handleJoin={handleJoin} />
            )}
        </>
    );
}

function createBackgroundElements() {
    // Create circles
    for (let i = 0; i < 30; i++) {
        const circle = document.createElement('div');
        circle.className = 'animated-circle';

        const size = Math.random() * 20 + 5;
        const r = Math.random() * 100 + 100;
        const g = Math.random() * 50;
        const b = Math.random() * 255;
        const opacity = Math.random() * 0.5 + 0.2;

        circle.style.width = `${size}px`;
        circle.style.height = `${size}px`;
        circle.style.top = `${Math.random() * 100}%`;
        circle.style.left = `${Math.random() * 100}%`;
        circle.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        circle.style.boxShadow = `0 0 ${Math.random() * 30 + 10}px rgba(${r}, ${g}, ${b}, ${opacity + 0.1})`;
        circle.style.animation = `float ${Math.random() * 15 + 10}s linear infinite, pulse ${Math.random() * 5 + 2}s ease-in-out infinite alternate`;
        circle.style.animationDelay = `${Math.random() * 5}s`;

        animatedCircles.appendChild(circle);
    }

    // Create waves
    for (let i = 0; i < 5; i++) {
        const wave = document.createElement('div');
        wave.className = 'animated-wave';

        const r = Math.random() * 100 + 100;
        const g = Math.random() * 100;
        const b = Math.random() * 255;

        wave.style.background = `rgba(${r}, ${g}, ${b}, 0.1)`;
        wave.style.animation = `wave ${10 + i * 3}s ease-in-out infinite alternate`;
        wave.style.animationDelay = `${i * 0.5}s`;
        wave.style.bottom = `${i * 10 - 40}px`;

        animatedWaves.appendChild(wave);
    }
}


function init() {
    createBackgroundElements();
    leaveButton.addEventListener('click', handleLeave);
    playButton.addEventListener('click', togglePlay);
    muteButton.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', handleVolumeChange);
    nextButton.onclick = () => roomId && socket.emit('change_media', { action: 'next', roomId });
    prevButton.onclick = () => roomId && socket.emit('change_media', { action: 'prev', roomId });
    uploadMediaButton.onclick = () => {
        const videoUrl = urlInput.value.trim();
        if (!isValidYouTubeURL(videoUrl)) {
            return alert('Invalid YouTube URL');
        }
        if (roomId) {
            socket.emit('upload_media', { videoUrl, roomId });
        }
    };

}
