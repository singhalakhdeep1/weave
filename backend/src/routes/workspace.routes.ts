import { Router } from 'express'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { badRequest, conflict, forbidden, handle, notFound } from '../lib/errors'
import { requireWorkspaceRole } from '../lib/access'
import { prisma } from '../lib/prisma'
import { createWorkspace } from '../lib/workspaces'
import { protect } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()
router.use(protect)

const roleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER'])

// GET /api/workspaces  - the caller's workspaces
router.get(
    '/',
    handle(async (req, res) => {
        const rows = await prisma.workspaceMember.findMany({
            where: { userId: req.user.id },
            include: { workspace: { include: { _count: { select: { members: true } } } } },
            orderBy: { joinedAt: 'asc' },
        })
        res.json(rows.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role, members: m.workspace._count.members })))
    })
)

router.post(
    '/',
    validate(z.object({ name: z.string().trim().min(1).max(80) })),
    handle(async (req, res) => {
        const ws = await createWorkspace(req.user.id, req.body.name)
        res.status(201).json({ id: ws.id, name: ws.name, role: 'OWNER', members: 1 })
    })
)

// GET /api/workspaces/:id  - details with members
router.get(
    '/:id',
    handle(async (req, res) => {
        const role = await requireWorkspaceRole(req.user.id, req.params.id)
        const ws = await prisma.workspace.findUniqueOrThrow({
            where: { id: req.params.id },
            include: { members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { joinedAt: 'asc' } } },
        })
        res.json({ id: ws.id, name: ws.name, role, members: ws.members.map((m) => ({ ...m.user, role: m.role })) })
    })
)

router.patch(
    '/:id',
    validate(z.object({ name: z.string().trim().min(1).max(80) })),
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.id, 'OWNER')
        const ws = await prisma.workspace.update({ where: { id: req.params.id }, data: { name: req.body.name } })
        res.json({ id: ws.id, name: ws.name })
    })
)

router.delete(
    '/:id',
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.id, 'OWNER')
        const mine = await prisma.workspaceMember.count({ where: { userId: req.user.id } })
        if (mine <= 1) throw conflict('You cannot delete your only workspace')
        await prisma.workspace.delete({ where: { id: req.params.id } })
        res.json({ message: 'Workspace deleted' })
    })
)

// ----- Members -----

// Adds an existing Weave user by email
router.post(
    '/:id/members',
    validate(z.object({ email: z.string().trim().toLowerCase().email(), role: roleSchema.default('EDITOR') })),
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.id, 'OWNER')
        const user = await prisma.user.findUnique({ where: { email: req.body.email }, select: { id: true, name: true, email: true } })
        if (!user) throw notFound('No Weave account with that email. Ask them to sign up first. User')
        if (await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId: req.params.id } } })) {
            throw conflict('That person is already a member')
        }
        await prisma.workspaceMember.create({ data: { userId: user.id, workspaceId: req.params.id, role: req.body.role as Role } })
        res.status(201).json({ ...user, role: req.body.role })
    })
)

router.patch(
    '/:id/members/:userId',
    validate(z.object({ role: roleSchema })),
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.id, 'OWNER')
        const target = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } } })
        if (!target) throw notFound('Member')
        if (target.role === 'OWNER' && req.body.role !== 'OWNER') {
            const owners = await prisma.workspaceMember.count({ where: { workspaceId: req.params.id, role: 'OWNER' } })
            if (owners <= 1) throw badRequest('A workspace needs at least one owner')
        }
        await prisma.workspaceMember.update({ where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } }, data: { role: req.body.role as Role } })
        res.json({ userId: req.params.userId, role: req.body.role })
    })
)

// Owners remove anyone; members can remove themselves (leave)
router.delete(
    '/:id/members/:userId',
    handle(async (req, res) => {
        const self = req.params.userId === req.user.id
        if (!self) await requireWorkspaceRole(req.user.id, req.params.id, 'OWNER')
        else await requireWorkspaceRole(req.user.id, req.params.id)

        const target = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } } })
        if (!target) throw notFound('Member')
        if (target.role === 'OWNER') {
            const owners = await prisma.workspaceMember.count({ where: { workspaceId: req.params.id, role: 'OWNER' } })
            if (owners <= 1) throw forbidden('The last owner cannot leave. Delete the workspace or promote another owner first.')
        }
        await prisma.workspaceMember.delete({ where: { userId_workspaceId: { userId: req.params.userId, workspaceId: req.params.id } } })
        res.json({ message: self ? 'You left the workspace' : 'Member removed' })
    })
)

export default router
