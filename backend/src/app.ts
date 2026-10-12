import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import morgan from 'morgan'
import { env, isProd } from './config/env'
import { prisma } from './lib/prisma'
import { errorHandler, notFoundHandler } from './middleware/error'
import authRoutes from './routes/auth.routes'
import commentRoutes from './routes/comment.routes'
import documentRoutes from './routes/document.routes'
import publicRoutes from './routes/public.routes'
import workspaceRoutes from './routes/workspace.routes'

const app = express()
if (isProd) app.set('trust proxy', 1)

app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
if (env.NODE_ENV !== 'test') app.use(morgan(isProd ? 'combined' : 'dev'))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 1500, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, please slow down' } }))

app.get('/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`
        res.json({ status: 'ok' })
    } catch {
        res.status(503).json({ status: 'database unavailable' })
    }
})

app.use('/api/auth', authRoutes)
app.use('/api/workspaces', workspaceRoutes)
app.use('/api/public', publicRoutes)
app.use('/api', documentRoutes)
app.use('/api', commentRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
