import React, { useEffect, useState } from 'react';

interface CursorPosition {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

interface CollaborativeCursorsProps {
  socket: any;
  currentUserId: string;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'
];

export function CollaborativeCursors({ socket, currentUserId }: CollaborativeCursorsProps) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());

  useEffect(() => {
    if (!socket) return;

    // Handle cursor updates from other users
    socket.on('cursor:update', (data: CursorPosition) => {
      if (data.userId !== currentUserId) {
        setCursors(prev => new Map(prev).set(data.userId, data));
      }
    });

    // Handle user leaving
    socket.on('user:left', (userId: string) => {
      setCursors(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    });

    return () => {
      socket off('cursor:update');
      socket off('user:left');
    };
  }, [socket, currentUserId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!socket) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    socket.emit('cursor:update', {
      userId: currentUserId,
      x,
      y,
    });
  };

  const getUserColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  };

  return (
    <div 
      className="relative w-full h-full"
      onMouseMove={handleMouseMove}
    >
      {Array.from(cursors.values()).map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none transition-all duration-100 ease-out"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(0, -100%)',
          }}
        >
          {/* Cursor arrow */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={cursor.color}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
          >
            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.85 2.85a.5.5 0 0 0-.35.36Z" />
          </svg>
          
          {/* Name label */}
          <div
            className="px-2 py-1 rounded text-xs text-white font-medium whitespace-nowrap"
            style={{
              backgroundColor: cursor.color,
              marginTop: '4px',
            }}
          >
            {cursor.userName}
          </div>
        </div>
      ))}
    </div>
  );
}
