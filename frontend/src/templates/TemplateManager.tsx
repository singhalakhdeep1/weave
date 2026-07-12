import React, { useState } from 'react';

interface WhiteboardTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  elements: any[];
}

const DEFAULT_TEMPLATES: WhiteboardTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start with a clean slate',
    elements: [],
  },
  {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'Classic kanban layout with columns',
    elements: [
      { type: 'rectangle', x: 50, y: 100, width: 200, height: 400, fill: '#f3f4f6' },
      { type: 'rectangle', x: 300, y: 100, width: 200, height: 400, fill: '#f3f4f6' },
      { type: 'rectangle', x: 550, y: 100, width: 200, height: 400, fill: '#f3f4f6' },
      { type: 'text', x: 50, y: 70, content: 'To Do' },
      { type: 'text', x: 300, y: 70, content: 'In Progress' },
      { type: 'text', x: 550, y: 70, content: 'Done' },
    ],
  },
  {
    id: 'mindmap',
    name: 'Mind Map',
    description: 'Central idea with branches',
    elements: [
      { type: 'circle', x: 400, y: 300, radius: 50, fill: '#dbeafe' },
      { type: 'text', x: 400, y: 300, content: 'Central Idea' },
      { type: 'line', x1: 400, y1: 250, x2: 250, y2: 150 },
      { type: 'line', x1: 400, y1: 250, x2: 550, y2: 150 },
      { type: 'line', x1: 400, y1: 350, x2: 250, y2: 450 },
      { type: 'line', x1: 400, y1: 350, x2: 550, y2: 450 },
    ],
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Process flow diagram',
    elements: [
      { type: 'rectangle', x: 350, y: 50, width: 100, height: 50, fill: '#d1fae5' },
      { type: 'rectangle', x: 350, y: 150, width: 100, height: 50, fill: '#fef3c7' },
      { type: 'diamond', x: 350, y: 250, width: 100, height: 100, fill: '#fee2e2' },
      { type: 'rectangle', x: 350, y: 400, width: 100, height: 50, fill: '#dbeafe' },
      { type: 'line', x1: 400, y1: 100, x2: 400, y2: 150 },
      { type: 'line', x1: 400, y1: 200, x2: 400, y2: 250 },
      { type: 'line', x1: 400, y1: 350, x2: 400, y2: 400 },
    ],
  },
  {
    id: 'wireframe',
    name: 'Wireframe',
    description: 'Basic website wireframe',
    elements: [
      { type: 'rectangle', x: 50, y: 50, width: 700, height: 60, fill: '#1f2937' },
      { type: 'rectangle', x: 50, y: 130, width: 200, height: 400, fill: '#f3f4f6' },
      { type: 'rectangle', x: 280, y: 130, width: 470, height: 200, fill: '#e5e7eb' },
      { type: 'rectangle', x: 280, y: 350, width: 220, height: 180, fill: '#e5e7eb' },
      { type: 'rectangle', x: 530, y: 350, width: 220, height: 180, fill: '#e5e7eb' },
    ],
  },
];

interface TemplateManagerProps {
  onSelectTemplate: (template: WhiteboardTemplate) => void;
  onSaveAsTemplate?: (name: string, description: string) => void;
}

export function TemplateManager({ onSelectTemplate, onSaveAsTemplate }: TemplateManagerProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const handleSaveAsTemplate = () => {
    if (templateName.trim()) {
      onSaveAsTemplate?.(templateName, templateDescription);
      setShowSaveDialog(false);
      setTemplateName('');
      setTemplateDescription('');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Templates</h3>
        {onSaveAsTemplate && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
          >
            Save as Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {DEFAULT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className="p-3 border rounded-lg hover:bg-gray-50 transition text-left"
          >
            <div className="aspect-video bg-gray-100 rounded mb-2 flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <div className="font-medium text-sm">{template.name}</div>
            <div className="text-xs text-gray-500">{template.description}</div>
          </button>
        ))}
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Save as Template</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="px-3 py-2 border rounded"
              />
              <textarea
                placeholder="Description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                className="px-3 py-2 border rounded resize-none"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsTemplate}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
