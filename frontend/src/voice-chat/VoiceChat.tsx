import React, { useState, useEffect, useRef } from 'react';

interface VoiceChatProps {
  socket: any;
  currentUserId: string;
  roomId: string;
}

export function VoiceChat({ socket, currentUserId, roomId }: VoiceChatProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    if (!socket) return;

    socket.on('voice:join', (userId: string) => {
      setParticipants(prev => [...prev, userId]);
      createPeerConnection(userId);
    });

    socket.on('voice:leave', (userId: string) => {
      setParticipants(prev => prev.filter(id => id !== userId));
      closePeerConnection(userId);
    });

    socket.on('voice:offer', async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:answer', { userId: data.userId, answer });
      }
    });

    socket.on('voice:answer', async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on('voice:ice-candidate', async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    return () => {
      socket.off('voice:join');
      socket.off('voice:leave');
      socket.off('voice:offer');
      socket.off('voice:answer');
      socket.off('voice:ice-candidate');
      leaveVoiceChat();
    };
  }, [socket]);

  const joinVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsConnected(true);

      socket.emit('voice:join-room', { roomId, userId: currentUserId });

      socket.emit('voice:get-participants', { roomId }, (existingParticipants: string[]) => {
        setParticipants(existingParticipants);
        existingParticipants.forEach(userId => {
          if (userId !== currentUserId) {
            createPeerConnection(userId, true);
          }
        });
      });

    } catch (error) {
      console.error('Failed to join voice chat:', error);
    }
  };

  const leaveVoiceChat = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    socket.emit('voice:leave-room', { roomId, userId: currentUserId });
    setIsConnected(false);
    setParticipants([]);
  };

  const createPeerConnection = async (userId: string, isInitiator = false) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice:ice-candidate', { userId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const audioElement = document.getElementById(`audio-${userId}`) as HTMLAudioElement;
      if (audioElement) {
        audioElement.srcObject = event.streams[0];
      }
    };

    peerConnectionsRef.current.set(userId, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice:offer', { userId, offer });
    }
  };

  const closePeerConnection = (userId: string) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isConnected ? (
        <button
          onClick={joinVoiceChat}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
        >
          Join Voice
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`p-2 rounded ${isMuted ? 'bg-red-500' : 'bg-gray-200'} text-white transition`}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          <span className="text-sm text-gray-600">{participants.length + 1} participants</span>
          <button
            onClick={leaveVoiceChat}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Leave
          </button>
        </div>
      )}
      {participants.map(userId => (
        <audio key={userId} id={`audio-${userId}`} autoPlay playsInline />
      ))}
    </div>
  );
}
