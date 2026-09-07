import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

type WorkspaceDocument = {
    id: string;
    title: string;
    updatedAt: string;
};

const user = {
    id: 'user-1',
    name: 'Alex Morgan',
    color: '#4f46e5',
};

function App() {
    const [documents, setDocuments] = useState<WorkspaceDocument[]>([
        { id: 'doc-1', title: 'Product launch brief', updatedAt: '2026-08-24T09:00:00.000Z' },
        { id: 'doc-2', title: 'Sprint planning', updatedAt: '2026-08-23T14:30:00.000Z' },
        { id: 'doc-3', title: 'Customer interviews', updatedAt: '2026-08-21T11:00:00.000Z' },
    ]);
    const [activeDocumentId, setActiveDocumentId] = useState<string>('doc-1');

    const onCreateDocument = () => {
        const id = `doc-${Date.now()}`;
        const nextDoc = {
            id,
            title: `Untitled document ${documents.length + 1}`,
            updatedAt: new Date().toISOString(),
        };

        setDocuments((current) => [nextDoc, ...current]);
        setActiveDocumentId(id);
    };

    const currentDocument = documents.find((doc) => doc.id === activeDocumentId) ?? documents[0];

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <div className="flex h-screen bg-slate-50 text-slate-900">
                                <Sidebar
                                    onDocumentSelect={setActiveDocumentId}
                                    currentDocumentId={currentDocument?.id ?? ''}
                                    onCreateDocument={onCreateDocument}
                                />

                                <main className="flex-1 overflow-hidden">
                                    <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-600">
                                                Weave workspace
                                            </p>
                                            <h1 className="mt-1 text-2xl font-bold">{currentDocument?.title ?? 'Untitled document'}</h1>
                                        </div>
                                        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                                            3 collaborators online
                                        </div>
                                    </header>

                                    <div className="h-[calc(100vh-81px)] p-4">
                                        <Editor documentId={currentDocument?.id ?? 'doc-1'} token="local-dev-token" currentUser={user} />
                                    </div>
                                </main>
                            </div>
                        }
                    />
                </Routes>
                <Toaster position="top-right" richColors />
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
