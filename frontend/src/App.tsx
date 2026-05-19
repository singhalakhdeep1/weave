import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<div className="flex h-screen items-center justify-center">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold mb-4">
                                🚀 Real-Time Collaborative Workspace
                            </h1>
                            <p className="text-lg text-muted-foreground mb-8">
                                Your project is ready! Start building amazing features.
                            </p>
                            <div className="space-y-2">
                                <p className="text-sm">✅ React + TypeScript + Vite</p>
                                <p className="text-sm">✅ Tailwind CSS + Radix UI</p>
                                <p className="text-sm">✅ Zustand + React Query</p>
                                <p className="text-sm">✅ Ready for Yjs + Socket.io</p>
                            </div>
                            <div className="mt-8">
                                <a
                                    href="/docs/ROADMAP.md"
                                    className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                                >
                                    View Roadmap
                                </a>
                            </div>
                        </div>
                    </div>} />
                </Routes>
                <Toaster position="top-right" richColors />
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
