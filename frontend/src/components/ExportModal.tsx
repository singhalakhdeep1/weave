import { useState } from 'react';

interface ExportModalProps {
  editor: any;
  onClose: () => void;
}

export default function ExportModal({ editor, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'markdown' | 'html' | 'json'>('markdown');

  const handleExport = () => {
    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'markdown':
        content = editor.storage.markdown?.getMarkdown() || editor.getText();
        filename = 'document.md';
        mimeType = 'text/markdown';
        break;
      case 'html':
        content = editor.getHTML();
        filename = 'document.html';
        mimeType = 'text/html';
        break;
      case 'json':
        content = JSON.stringify(editor.getJSON(), null, 2);
        filename = 'document.json';
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Export Document</h3>
        
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              value="markdown"
              checked={format === 'markdown'}
              onChange={(e) => setFormat(e.target.value as any)}
              className="w-4 h-4"
            />
            <span>Markdown (.md)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              value="html"
              checked={format === 'html'}
              onChange={(e) => setFormat(e.target.value as any)}
              className="w-4 h-4"
            />
            <span>HTML (.html)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              value="json"
              checked={format === 'json'}
              onChange={(e) => setFormat(e.target.value as any)}
              className="w-4 h-4"
            />
            <span>JSON (.json)</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
