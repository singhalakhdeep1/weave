import { NextFunction, Request, Response } from 'express'
import { unauthorized } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { verifyAccessToken } from '../lib/tokens'

declare global {
    namespace Express {
        interface Request {
            user: { id: string; name: string; email: string }
        }
    }
}

export const protect = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const header = req.headers.authorization
        if (!header?.startsWith('Bearer ')) return next(unauthorized('Not authorized, no token'))
        const { userId } = verifyAccessToken(header.slice(7))
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } })
        if (!user) return next(unauthorized('Account no longer exists'))
        req.user = user
        next()
    } catch {
        next(unauthorized('Not authorized, token failed'))
    }
}
