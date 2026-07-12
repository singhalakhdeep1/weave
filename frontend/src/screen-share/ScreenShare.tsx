import React, { useState, useEffect, useRef } from 'react';

interface ScreenShareProps {
  onStreamStart?: (stream: MediaStream) => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

export function ScreenShare({ onStreamStart, onStreamEnd, onError }: ScreenShareProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startSharing = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        },
        audio: true,
      });

      setStream(mediaStream);
      setIsSharing(true);
      onStreamStart?.(mediaStream);

      mediaStream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

    } catch (error) {
      onError?.(error as Error);
    }
  };

  const stopSharing = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsSharing(false);
      onStreamEnd?.();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!isSharing ? (
        <button
          onClick={startSharing}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Share Screen
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-auto max-h-96"
            />
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <span className="px-2 py-1 bg-red-500 text-white text-xs rounded animate-pulse">
                Live
              </span>
            </div>
          </div>
          <button
            onClick={stopSharing}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Stop Sharing
          </button>
        </div>
      )}
    </div>
  );
}
