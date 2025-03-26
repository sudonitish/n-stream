import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Input } from "./Input";
import { Button } from "./Button";

interface ComponentTypes {
    handleJoin: (roomId:string) => void;
}
export default function JoinScreen({handleJoin}:ComponentTypes){
    const [newRoomId, setNewRoomId] = useState('');
  
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setNewRoomId(event.target.value.trim());
    };
    const handleButtonClick = (event: React.MouseEvent) => { 
      handleJoin(newRoomId);
    };
  
    return (
      <div id="join-screen" className="join-screen w-full max-w-md glass-panel p-8 rounded-2xl mx-auto relative">
        <h1 className="text-4xl font-bold mb-6 text-center gradient-text fade-in delay-200">Join Room</h1>
  
        <div className="space-y-4 fade-in delay-400">
          <Input
            type="text"
            value={newRoomId}
            onChange={handleInputChange}
            placeholder="Enter room code"
          />
          <Button
            className="btn-primary"
            onClick={handleButtonClick}
            disabled={!newRoomId.trim()}
            label="Join Room"
          /> 
        </div>
      </div>
    );
  };
  