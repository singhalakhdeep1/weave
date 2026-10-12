import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env, isProd } from '../config/env'
import { conflict, handle, unauthorized } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { issueRefreshToken, revokeAllRefreshTokens, revokeRefreshToken, rotateRefreshToken, signAccessToken } from '../lib/tokens'
import { createWorkspace } from '../lib/workspaces'
import { protect } from '../middleware/auth'
import { validate } from '../middleware/validate'
import type { Response } from 'express'

const router = Router()

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
})

const COOKIE = 'weave_refresh'
const crossSite = env.CROSS_SITE_COOKIES === 'true'
const cookieOptions = {
    httpOnly: true,
    secure: isProd || crossSite,
    sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_DAYS * 86_400_000,
}

const publicUser = { id: true, email: true, name: true, createdAt: true } as const

const password = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number')

async function startSession(res: Response, userId: string) {
    res.cookie(COOKIE, await issueRefreshToken(userId), cookieOptions)
    return signAccessToken(userId)
}

router.post(
    '/register',
    authLimiter,
    validate(z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email(), password })),
    handle(async (req, res) => {
        const { name, email, password: plain } = req.body
        if (await prisma.user.findUnique({ where: { email } })) throw conflict('An account with this email already exists')

        const user = await prisma.user.create({ data: { name, email, password: await bcrypt.hash(plain, 12) }, select: publicUser })
        const workspace = await createWorkspace(user.id, `${name.split(' ')[0]}'s workspace`)

        res.status(201).json({ user, workspaceId: workspace.id, accessToken: await startSession(res, user.id) })
    })
)

router.post(
    '/login',
    authLimiter,
    validate(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })),
    handle(async (req, res) => {
        const user = await prisma.user.findUnique({ where: { email: req.body.email } })
        if (!user || !(await bcrypt.compare(req.body.password, user.password))) throw unauthorized('Invalid email or password')
        const { password: _p, ...safe } = user
        res.json({ user: { id: safe.id, email: safe.email, name: safe.name, createdAt: safe.createdAt }, accessToken: await startSession(res, user.id) })
    })
)

router.post(
    '/refresh',
    handle(async (req, res) => {
        const token = req.cookies?.[COOKIE]
        if (!token) throw unauthorized('No session')
        const rotated = await rotateRefreshToken(token)
        if (!rotated) {
            res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined })
            throw unauthorized('Session expired, please sign in again')
        }
        const user = await prisma.user.findUnique({ where: { id: rotated.userId }, select: publicUser })
        if (!user) throw unauthorized('Account no longer exists')
        res.cookie(COOKIE, rotated.newToken, cookieOptions)
        res.json({ user, accessToken: signAccessToken(user.id) })
    })
)

router.post(
    '/logout',
    handle(async (req, res) => {
        const token = req.cookies?.[COOKIE]
        if (token) await revokeRefreshToken(token)
        res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined })
        res.json({ message: 'Logged out' })
    })
)

router.get('/me', protect, handle(async (req, res) => res.json(await prisma.user.findUniqueOrThrow({ where: { id: req.user.id }, select: publicUser }))))

router.put(
    '/me',
    protect,
    validate(z.object({ name: z.string().trim().min(1).max(100) })),
    handle(async (req, res) => {
        res.json(await prisma.user.update({ where: { id: req.user.id }, data: { name: req.body.name }, select: publicUser }))
    })
)

router.post(
    '/change-password',
    protect,
    validate(z.object({ currentPassword: z.string().min(1), newPassword: password })),
    handle(async (req, res) => {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } })
        if (!(await bcrypt.compare(req.body.currentPassword, user.password))) throw unauthorized('Current password is incorrect')
        await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(req.body.newPassword, 12) } })
        await revokeAllRefreshTokens(user.id)
        res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined })
        res.json({ message: 'Password changed. Please sign in again.' })
    })
)

router.delete(
    '/me',
    protect,
    validate(z.object({ password: z.string().min(1) })),
    handle(async (req, res) => {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } })
        if (!(await bcrypt.compare(req.body.password, user.password))) throw unauthorized('Password is incorrect')

        // Workspaces where this user is the only owner but others remain would be orphaned
        const owned = await prisma.workspaceMember.findMany({ where: { userId: user.id, role: 'OWNER' }, select: { workspaceId: true } })
        for (const { workspaceId } of owned) {
            const [otherOwners, others] = await Promise.all([
                prisma.workspaceMember.count({ where: { workspaceId, role: 'OWNER', userId: { not: user.id } } }),
                prisma.workspaceMember.count({ where: { workspaceId, userId: { not: user.id } } }),
            ])
            if (otherOwners === 0 && others > 0) throw conflict('You are the only owner of a shared workspace. Transfer ownership or remove its members first.')
            if (otherOwners === 0) await prisma.workspace.delete({ where: { id: workspaceId } })
        }
        // Documents they created in other workspaces are reassigned so shared content survives
        const heir = (id: string) => prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: { not: user.id } }, orderBy: { role: 'desc' } })
        const created = await prisma.document.findMany({ where: { createdById: user.id }, select: { workspaceId: true }, distinct: ['workspaceId'] })
        for (const { workspaceId } of created) {
            const next = await heir(workspaceId)
            if (next) await prisma.document.updateMany({ where: { workspaceId, createdById: user.id }, data: { createdById: next.userId } })
        }
        await prisma.user.delete({ where: { id: user.id } })
        res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined })
        res.json({ message: 'Account deleted' })
    })
)

export default router
