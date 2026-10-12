import { Router } from 'express'
import { z } from 'zod'
import { requireDocumentRole } from '../lib/access'
import { badRequest, forbidden, handle, notFound } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { protect } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()
router.use(protect)

const author = { select: { id: true, name: true } }

// GET /api/documents/:id/comments  - top-level threads with their replies
router.get(
    '/documents/:id/comments',
    handle(async (req, res) => {
        await requireDocumentRole(req.user.id, req.params.id)
        res.json(
            await prisma.comment.findMany({
                where: { documentId: req.params.id, parentId: null },
                orderBy: { createdAt: 'asc' },
                include: { user: author, replies: { orderBy: { createdAt: 'asc' }, include: { user: author } } },
            })
        )
    })
)

// Viewers may comment too
router.post(
    '/documents/:id/comments',
    validate(z.object({ content: z.string().trim().min(1, 'Comment cannot be empty').max(2000), quote: z.string().trim().max(500).optional(), parentId: z.string().uuid().optional() })),
    handle(async (req, res) => {
        await requireDocumentRole(req.user.id, req.params.id)
        const { content, quote, parentId } = req.body as { content: string; quote?: string; parentId?: string }

        if (parentId) {
            const parent = await prisma.comment.findFirst({ where: { id: parentId, documentId: req.params.id } })
            if (!parent) throw notFound('Comment')
            if (parent.parentId) throw badRequest('Replies cannot be nested further')
        }
        const comment = await prisma.comment.create({
            data: { documentId: req.params.id, userId: req.user.id, content, quote: parentId ? null : quote, parentId },
            include: { user: author, replies: { include: { user: author } } },
        })
        res.status(201).json(comment)
    })
)

router.patch(
    '/comments/:id',
    validate(z.object({ content: z.string().trim().min(1).max(2000), resolved: z.boolean() }).partial()),
    handle(async (req, res) => {
        const comment = await prisma.comment.findUnique({ where: { id: req.params.id } })
        if (!comment) throw notFound('Comment')
        const { role } = await requireDocumentRole(req.user.id, comment.documentId)

        const { content, resolved } = req.body as { content?: string; resolved?: boolean }
        if (content !== undefined && comment.userId !== req.user.id) throw forbidden('You can only edit your own comments')
        if (resolved !== undefined && role === 'VIEWER' && comment.userId !== req.user.id) throw forbidden('Only editors can resolve other people’s comments')

        res.json(await prisma.comment.update({ where: { id: comment.id }, data: { content, resolved }, include: { user: author, replies: { include: { user: author } } } }))
    })
)

router.delete(
    '/comments/:id',
    handle(async (req, res) => {
        const comment = await prisma.comment.findUnique({ where: { id: req.params.id } })
        if (!comment) throw notFound('Comment')
        const { role } = await requireDocumentRole(req.user.id, comment.documentId)
        if (comment.userId !== req.user.id && role !== 'OWNER') throw forbidden('Only the author or a workspace owner can delete this comment')
        await prisma.comment.delete({ where: { id: comment.id } })
        res.json({ message: 'Comment deleted' })
    })
)

export default router
