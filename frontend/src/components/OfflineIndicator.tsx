import { useEffect, useState } from 'react';

interface OfflineIndicatorProps {
  provider: any;
}

export default function OfflineIndicator({ provider }: OfflineIndicatorProps) {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    if (!provider) return;

    const handleStatus = (event: any) => {
      setStatus(event.status);
    };

    provider.on('status', handleStatus);

    return () => {
      provider.off('status', handleStatus);
    };
  }, [provider]);

  if (status === 'connected') {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-400 text-yellow-800 px-4 py-2 z-50">
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">⚠️</span>
        <span className="font-medium">
          {status === 'connecting' ? 'Connecting...' : 'You are offline. Changes will be saved when you reconnect.'}
        </span>
      </div>
    </div>
  );
}
