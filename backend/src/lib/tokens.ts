import crypto from 'crypto'
import jwt, { SignOptions } from 'jsonwebtoken'
import { env } from '../config/env'
import { prisma } from './prisma'

export const signAccessToken = (userId: string): string =>
    jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY as SignOptions['expiresIn'] })

export const verifyAccessToken = (token: string): { userId: string } => {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId?: string }
    if (!payload.userId) throw new Error('Invalid access token')
    return { userId: payload.userId }
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

/** Opaque refresh token; only its hash is stored. */
export const issueRefreshToken = async (userId: string): Promise<string> => {
    const token = crypto.randomBytes(48).toString('base64url')
    await prisma.refreshToken.create({
        data: { tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000) },
    })
    return token
}

/** Validates and rotates a refresh token. Reuse of a spent token revokes every session of that user. */
export const rotateRefreshToken = async (token: string): Promise<{ userId: string; newToken: string } | null> => {
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } })
    if (!record) return null
    if (record.revokedAt) {
        await revokeAllRefreshTokens(record.userId)
        return null
    }
    if (record.expiresAt < new Date()) return null
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } })
    return { userId: record.userId, newToken: await issueRefreshToken(record.userId) }
}

export const revokeRefreshToken = async (token: string) => {
    await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } })
}

export const revokeAllRefreshTokens = async (userId: string) => {
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
}
