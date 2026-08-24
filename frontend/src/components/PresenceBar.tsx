import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  color: string;
}

interface PresenceBarProps {
  provider: any;
}

export default function PresenceBar({ provider }: PresenceBarProps) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!provider) return;

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const uniqueUsers = states
        .filter((state: any) => state.user)
        .map((state: any) => state.user)
        .filter((user: User, index: number, self: User[]) => 
          index === self.findIndex(u => u.id === user.id)
        );
      setUsers(uniqueUsers);
    };

    updateUsers();
    provider.awareness.on('change', updateUsers);

    return () => {
      provider.awareness.off('change', updateUsers);
    };
  }, [provider]);

  return (
    <div className="presence-bar flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
      <span className="text-sm text-gray-600">Online:</span>
      <div className="flex -space-x-2">
        {users.map(user => (
          <div
            key={user.id}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      {users.length === 0 && (
        <span className="text-sm text-gray-400">Just you</span>
      )}
    </div>
  );
}
