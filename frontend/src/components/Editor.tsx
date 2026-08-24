import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { useEffect, useState } from 'react';

interface EditorProps {
  documentId: string;
  token: string;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
}

export default function Editor({ documentId, token, currentUser }: EditorProps) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = process.env.VITE_WS_URL || 'ws://localhost:3001';
    
    const newProvider = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: ydoc,
      token: token,
      onConnect: () => {
        setConnectionStatus('connected');
        console.log('Connected to Hocuspocus');
      },
      onDisconnect: () => {
        setConnectionStatus('disconnected');
        console.log('Disconnected from Hocuspocus');
      },
      onStatus: (status: any) => {
        console.log('Provider status:', status);
      },
    });

    setProvider(newProvider);

    return () => {
      newProvider.destroy();
    };
  }, [documentId, token]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ 
        history: false // Yjs handles history
      }),
      Collaboration.configure({
        document: provider?.document,
      }),
      CollaborationCursor.configure({
        provider: provider!,
        user: currentUser,
      }),
    ],
    editable: true,
    content: '<p>Start typing...</p>',
  }, [provider, currentUser]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="editor-container">
      {/* Connection Status Banner */}
      {connectionStatus === 'disconnected' && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <p className="font-bold">Disconnected</p>
          <p className="text-sm">Attempting to reconnect...</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar flex gap-2 p-2 border-b bg-gray-50">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1 rounded ${editor.isActive('bold') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1 rounded ${editor.isActive('italic') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-3 py-1 rounded ${editor.isActive('strike') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Strike
        </button>
        <div className="w-px bg-gray-300 mx-2" />
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1 rounded ${editor.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Bullet List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-3 py-1 rounded ${editor.isActive('codeBlock') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
        >
          Code Block
        </button>
      </div>

      {/* Editor Content */}
      <div className="editor-content p-4 min-h-[500px]">
        <EditorContent editor={editor} />
      </div>

      {/* Status Bar */}
      <div className="status-bar flex justify-between items-center p-2 border-t bg-gray-50 text-sm text-gray-600">
        <div>
          Status: <span className={connectionStatus === 'connected' ? 'text-green-600' : 'text-yellow-600'}>
            {connectionStatus}
          </span>
        </div>
        <div>
          Characters: {editor.storage.characterCount?.characters() || 0} | 
          Words: {editor.storage.characterCount?.words() || 0}
        </div>
      </div>
    </div>
  );
}
