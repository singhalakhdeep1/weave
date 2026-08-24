import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Throttle } from '@hocuspocus/extension-throttle';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Express app for REST API
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
        message: '🚀 Weave Collaborative Editor API',
        version: '1.0.0',
        status: 'ready'
    });
});

// Document routes
import documentsRouter from './routes/documents';
app.use('/documents', documentsRouter);

// Hocuspocus Collaboration Server
const server = Server.configure({
    port: parseInt(process.env.PORT || '3001'),
    extensions: [
        new Throttle({ 
            throttle: 15, 
            banTime: 5 
        }),
        new Database({
            fetch: async ({ documentName }) => {
                try {
                    const doc = await prisma.document.findUnique({ 
                        where: { id: documentName } 
                    });
                    return doc?.content ? Buffer.from(JSON.stringify(doc.content)) : null;
                } catch (error) {
                    console.error('Error fetching document:', error);
                    return null;
                }
            },
            store: async ({ documentName, state }) => {
                try {
                    const content = JSON.parse(Buffer.from(state).toString());
                    await prisma.document.upsert({
                        where: { id: documentName },
                        update: { 
                            content: content,
                            updatedAt: new Date() 
                        },
                        create: { 
                            id: documentName, 
                            content: content,
                            title: 'Untitled Document',
                            workspaceId: 'default',
                            createdById: 'system'
                        }
                    });
                } catch (error) {
                    console.error('Error storing document:', error);
                }
            },
        }),
    ],
    onAuthenticate: async ({ token, documentName }) => {
        try {
            // TODO: Verify JWT token and return user data
            // For now, allow all connections
            return {
                user: {
                    id: 'user-id',
                    name: 'Anonymous',
                    color: '#' + Math.floor(Math.random()*16777215).toString(16)
                }
            };
        } catch (error) {
            throw new Error('Authentication failed');
        }
    },
    onConnect: (data) => {
        console.log(`User connected to document: ${data.documentName}`);
    },
    onDisconnect: (data) => {
        console.log(`User disconnected from document: ${data.documentName}`);
    },
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
server.listen().then(() => {
    console.log(`
🚀 Weave Server is running!
📡 Hocuspocus WebSocket: ws://localhost:${process.env.PORT || 3001}
📊 Health: http://localhost:${process.env.PORT || 3001}/health
  `);
});

export { app, server };
