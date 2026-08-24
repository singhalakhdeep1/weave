import { useState } from 'react';

interface SlashMenuProps {
  position: { x: number; y: number };
  onSelect: (command: string) => void;
  onClose: () => void;
}

export default function SlashMenu({ position, onSelect, onClose }: SlashMenuProps) {
  const [filter, setFilter] = useState('');

  const commands = [
    { id: 'heading1', label: 'Heading 1', icon: 'H1' },
    { id: 'heading2', label: 'Heading 2', icon: 'H2' },
    { id: 'bulletList', label: 'Bullet List', icon: '•' },
    { id: 'orderedList', label: 'Ordered List', icon: '1.' },
    { id: 'codeBlock', label: 'Code Block', icon: '</>' },
    { id: 'quote', label: 'Quote', icon: '"' },
    { id: 'divider', label: 'Divider', icon: '—' },
    { id: 'table', label: 'Table', icon: '⊞' },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div
      className="slash-menu absolute bg-white border rounded-lg shadow-lg py-2 w-64 z-50"
      style={{ left: position.x, top: position.y }}
    >
      <input
        type="text"
        placeholder="Filter commands..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-2 border-b focus:outline-none"
        autoFocus
      />
      <ul className="max-h-64 overflow-y-auto">
        {filteredCommands.map(cmd => (
          <li
            key={cmd.id}
            onClick={() => {
              onSelect(cmd.id);
              onClose();
            }}
            className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-3"
          >
            <span className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm font-medium">
              {cmd.icon}
            </span>
            <span>{cmd.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
