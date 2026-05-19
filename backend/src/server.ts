import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
    },
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api', (req, res) => {
    res.json({
        message: '🚀 Real-Time Collaborative Workspace API',
        version: '1.0.0',
        status: 'ready'
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    // Document room management
    socket.on('document:join', (documentId: string) => {
        socket.join(`document:${documentId}`);
        console.log(`Client ${socket.id} joined document ${documentId}`);
    });

    socket.on('document:leave', (documentId: string) => {
        socket.leave(`document:${documentId}`);
        console.log(`Client ${socket.id} left document ${documentId}`);
    });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            status: err.status || 500,
        },
    });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`
🚀 Server is running!
📡 API: http://localhost:${PORT}
🔌 WebSocket: ws://localhost:${PORT}
📊 Health: http://localhost:${PORT}/health
  `);
});

export { app, server, io };
