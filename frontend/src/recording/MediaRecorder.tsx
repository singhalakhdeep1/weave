import React, { useState, useRef, useEffect } from 'react';

interface MediaRecorderProps {
  onRecordingComplete?: (blob: Blob, type: 'video' | 'audio') => void;
  onError?: (error: Error) => void;
}

export function MediaRecorder({ onRecordingComplete, onError }: MediaRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'video' | 'audio' | null>(null);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async (type: 'video' | 'audio') => {
    try {
      let stream: MediaStream;

      if (type === 'video') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const mimeType = type === 'video' 
        ? 'video/webm;codecs=vp9' 
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        
        stream.getTracks().forEach(track => track.stop());
        
        onRecordingComplete?.(blob, type);
        setIsRecording(false);
        setRecordingType(null);
        setDuration(0);
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      recorder.onerror = (event) => {
        onError?.(new Error('Recording failed'));
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.start();
      
      setIsRecording(true);
      setRecordingType(type);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      onError?.(error as Error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording ? (
        <>
          <button
            onClick={() => startRecording('video')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Record Video
          </button>
          <button
            onClick={() => startRecording('audio')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
          >
            Record Audio
          </button>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono">{formatDuration(duration)}</span>
            <span className="text-sm text-gray-600 capitalize">{recordingType}</span>
          </div>
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
