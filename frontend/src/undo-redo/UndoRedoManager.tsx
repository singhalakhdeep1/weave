import React, { useCallback, useEffect, useState } from 'react';

interface HistoryState {
  elements: any[];
  timestamp: number;
}

interface UndoRedoManagerProps {
  elements: any[];
  onElementsChange: (elements: any[]) => void;
  maxHistory?: number;
}

export function UndoRedoManager({ 
  elements, 
  onElementsChange, 
  maxHistory = 50 
}: UndoRedoManagerProps) {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Add current state to history when elements change
  useEffect(() => {
    if (elements.length === 0) return;
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      const state = { elements: JSON.parse(JSON.stringify(elements)), timestamp: Date.now() };
      
      if (newHistory.length >= maxHistory) {
        newHistory.shift();
      }
      
      return [...newHistory, state];
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
  }, [elements]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onElementsChange(JSON.parse(JSON.stringify(history[newIndex].elements)));
    }
  }, [history, historyIndex, onElementsChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onElementsChange(JSON.parse(JSON.stringify(history[newIndex].elements)));
    }
  }, [history, historyIndex, onElementsChange]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const clearHistory = () => {
    setHistory([]);
    setHistoryIndex(-1);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={undo}
        disabled={!canUndo}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        title="Undo (Ctrl+Z)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
        </svg>
      </button>
      <div className="text-sm text-gray-500">
        {historyIndex + 1} / {history.length}
      </div>
      <button
        onClick={clearHistory}
        className="text-xs text-gray-400 hover:text-gray-600 transition"
        title="Clear history"
      >
        Clear
      </button>
    </div>
  );
}
