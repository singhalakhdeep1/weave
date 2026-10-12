import { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { isProd } from '../config/env'
import { HttpError } from '../lib/errors'

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
    next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`))
}

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
        return res.status(err.statusCode).json({ error: err.message, ...(err.details ? { details: err.details } : {}) })
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Resource not found' })
        if (err.code === 'P2002') return res.status(409).json({ error: 'A record with these values already exists' })
        if (err.code === 'P2003') return res.status(400).json({ error: 'Related record does not exist' })
    }

    if ((err as { type?: string })?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Malformed JSON body' })
    }

    console.error(err)
    res.status(500).json({ error: isProd ? 'Internal server error' : String((err as Error)?.message ?? err) })
}
