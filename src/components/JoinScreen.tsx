"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "./Input"
import { Button } from "./Button"

interface JoinScreenProps {
  roomId: string
  loading: boolean
  handleJoin: (roomId: string) => void
}

export default function JoinScreen({ handleJoin, roomId, loading }: JoinScreenProps) {
  const [newRoomId, setNewRoomId] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewRoomId(event.target.value.trim())
  }

  const handleJoinClick = () => {
    if (newRoomId) {
      handleJoin(newRoomId)
    }
  }

  const handleCreateClick = () => {
    // Generate a random room ID
    const randomRoomId = Math.random().toString(36).substring(2, 8)
    setNewRoomId(randomRoomId)
    setIsCreating(true)
  }

  if (roomId || loading) {
    return null
  }

  return (
    <div className="relative z-10 container mx-auto px-4 flex flex-col items-center justify-center min-h-screen">
      <div id="join-screen" className="join-screen w-full max-w-md glass-panel p-8 rounded-2xl mx-auto relative">
        <h1 className="text-4xl font-bold mb-6 text-center gradient-text fade-in delay-200">
          {isCreating ? "Create Room" : "Join Room"}
        </h1>

        <div className="space-y-4 fade-in delay-400">
          <Input type="text" value={newRoomId} onChange={handleInputChange} placeholder="Enter room code" />
          <Button
            onClick={handleJoinClick}
            disabled={!newRoomId.trim()}
            label={isCreating ? "Create & Join" : "Join Room"}
          />

          {!isCreating && (
            <div className="text-center mt-4">
              <button onClick={handleCreateClick} className="text-purple-300 hover:text-purple-200 underline text-sm">
                Or create a new room
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

