import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import app from './app'
import { hocuspocus } from './collab'
import { env } from './config/env'
import { prisma } from './lib/prisma'

const server = createServer(app)

// Realtime collaboration endpoint: ws://host/collab (authentication happens in the first message)
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 })
wss.on('connection', (socket, request) => hocuspocus.handleConnection(socket, request))

server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    if (pathname !== '/collab') return socket.destroy()
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request))
})

server.listen(env.PORT, () => console.log(`Weave API listening on http://localhost:${env.PORT} (collab at /collab)`))

const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`)
    server.close(async () => {
        await hocuspocus.destroy() // flushes pending document saves
        await prisma.$disconnect()
        process.exit(0)
    })
    setTimeout(() => process.exit(1), 15_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
