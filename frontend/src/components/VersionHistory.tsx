import { useState, useEffect } from 'react';

interface Snapshot {
  id: string;
  version: number;
  content: any;
  createdAt: string;
  createdBy: string;
}

interface VersionHistoryProps {
  documentId: string;
  onRestore: (snapshotId: string) => void;
}

export default function VersionHistory({ documentId, onRestore }: VersionHistoryProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSnapshots();
  }, [documentId]);

  const fetchSnapshots = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/documents/${documentId}/snapshots`);
      // const data = await response.json();
      // setSnapshots(data);
      
      // Mock data for now
      setSnapshots([
        {
          id: '1',
          version: 1,
          content: {},
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'John Doe',
        },
        {
          id: '2',
          version: 2,
          content: {},
          createdAt: '2024-01-15T11:00:00Z',
          createdBy: 'Jane Smith',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to restore this version? Current changes will be lost.')) {
      return;
    }

    try {
      // TODO: Replace with actual API call
      // await fetch(`/documents/${documentId}/snapshots/${snapshotId}/restore`, {
      //   method: 'POST',
      // });
      onRestore(snapshotId);
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
    }
  };

  return (
    <div className="version-history w-80 border-l bg-gray-50 flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Version History</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="text-gray-500">Loading versions...</div>
        ) : snapshots.length === 0 ? (
          <div className="text-gray-500">No versions saved</div>
        ) : (
          snapshots.map(snapshot => (
            <div
              key={snapshot.id}
              className="p-3 bg-white border rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Version {snapshot.version}</span>
                <span className="text-xs text-gray-500">
                  {new Date(snapshot.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                by {snapshot.createdBy}
              </div>
              <button
                onClick={() => handleRestore(snapshot.id)}
                className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition-colors"
              >
                Restore
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t">
        <button
          onClick={async () => {
            try {
              // TODO: Replace with actual API call
              // await fetch(`/documents/${documentId}/snapshots`, { method: 'POST' });
              fetchSnapshots();
            } catch (error) {
              console.error('Failed to create snapshot:', error);
            }
          }}
          className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 transition-colors"
        >
          Save Current Version
        </button>
      </div>
    </div>
  );
}
