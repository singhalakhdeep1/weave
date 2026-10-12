import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as Y from 'yjs'
import { hocuspocus } from '../collab'
import { htmlFromJson, jsonFromState } from '../lib/editor'
import { handle, notFound } from '../lib/errors'
import { prisma } from '../lib/prisma'

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } })

// GET /api/public/:token  - read-only rendering of a shared page (no login)
router.get(
    '/:token',
    limiter,
    handle(async (req, res) => {
        const doc = await prisma.document.findUnique({ where: { shareToken: req.params.token }, select: { id: true, title: true, icon: true, ydoc: true, updatedAt: true, deletedAt: true } })
        if (!doc || doc.deletedAt) throw notFound('Page')
        const live = hocuspocus.documents.get(doc.id)
        const state = live ? Y.encodeStateAsUpdate(live) : doc.ydoc
        res.json({ title: doc.title, icon: doc.icon, html: htmlFromJson(jsonFromState(state)), updatedAt: doc.updatedAt })
    })
)

export default router
