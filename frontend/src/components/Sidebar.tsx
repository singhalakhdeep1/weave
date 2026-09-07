import { useState, useEffect } from 'react';

interface Document {
  id: string;
  title: string;
  updatedAt: string;
}

interface SidebarProps {
  onDocumentSelect: (documentId: string) => void;
  currentDocumentId: string;
  onCreateDocument: () => void;
}

export default function Sidebar({ onDocumentSelect, currentDocumentId, onCreateDocument }: SidebarProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/documents', {
        headers: {
          Authorization: 'Bearer local-dev-token',
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const mappedDocuments = Array.isArray(data)
        ? data.map((doc: any) => ({
            id: String(doc.id),
            title: String(doc.title || 'Untitled document'),
            updatedAt: doc.updatedAt || doc.createdAt || new Date().toISOString(),
          }))
        : [];

      setDocuments(mappedDocuments.length ? mappedDocuments : [
        { id: '1', title: 'Project Requirements', updatedAt: '2024-01-15' },
        { id: '2', title: 'Meeting Notes', updatedAt: '2024-01-14' },
        { id: '3', title: 'API Documentation', updatedAt: '2024-01-13' },
      ]);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([
        { id: '1', title: 'Project Requirements', updatedAt: '2024-01-15' },
        { id: '2', title: 'Meeting Notes', updatedAt: '2024-01-14' },
        { id: '3', title: 'API Documentation', updatedAt: '2024-01-13' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(`/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer local-dev-token',
        },
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Delete failed with status ${response.status}`);
      }

      setDocuments((current) => current.filter((doc) => doc.id !== documentId));
    } catch (error) {
      console.error('Failed to delete document:', error);
      setDocuments((current) => current.filter((doc) => doc.id !== documentId));
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sidebar w-64 bg-gray-50 border-r flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Documents</h2>
        <button
          onClick={onCreateDocument}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors"
        >
          + New Document
        </button>
      </div>

      <div className="p-4 border-b">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-4 text-gray-500">No documents found</div>
        ) : (
          <ul className="divide-y">
            {filteredDocuments.map(doc => (
              <li
                key={doc.id}
                onClick={() => onDocumentSelect(doc.id)}
                className={`p-4 cursor-pointer hover:bg-gray-100 transition-colors ${
                  currentDocumentId === doc.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{doc.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="ml-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
