import crypto from 'crypto'
import { Router } from 'express'
import * as Y from 'yjs'
import { z } from 'zod'
import { hocuspocus } from '../collab'
import { isSelfOrDescendant, requireDocumentRole, requireWorkspaceRole } from '../lib/access'
import { EMPTY_DOC, FRAGMENT, TEMPLATES, htmlFromJson, jsonFromState, markdownFromJson, stateFromJson, textFromJson, ydocFromState } from '../lib/editor'
import { badRequest, handle, notFound } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { protect } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()
router.use(protect)

const summary = { id: true, title: true, icon: true, parentId: true, position: true, updatedAt: true } as const

/** The freshest state: the live in-memory document if someone has it open, otherwise the database copy. */
async function currentState(documentId: string): Promise<Uint8Array | null> {
    const live = hocuspocus.documents.get(documentId)
    if (live) return Y.encodeStateAsUpdate(live)
    const row = await prisma.document.findUnique({ where: { id: documentId }, select: { ydoc: true } })
    return row?.ydoc ?? null
}

async function descendantIds(id: string): Promise<string[]> {
    const ids: string[] = []
    let frontier = [id]
    while (frontier.length) {
        const kids = await prisma.document.findMany({ where: { parentId: { in: frontier } }, select: { id: true } })
        frontier = kids.map((k) => k.id)
        ids.push(...frontier)
    }
    return ids
}

// ---------- Workspace-level ----------

router.get('/templates', (_req, res) => {
    res.json(TEMPLATES.map(({ id, name, icon }) => ({ id, name, icon })))
})

router.get(
    '/workspaces/:wid/documents',
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.wid)
        res.json(await prisma.document.findMany({ where: { workspaceId: req.params.wid, deletedAt: null }, select: summary, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }))
    })
)

router.get(
    '/workspaces/:wid/trash',
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.wid)
        res.json(await prisma.document.findMany({ where: { workspaceId: req.params.wid, deletedAt: { not: null } }, select: { ...summary, deletedAt: true }, orderBy: { deletedAt: 'desc' }, take: 100 }))
    })
)

router.get(
    '/workspaces/:wid/search',
    validate(z.object({ q: z.string().trim().min(1).max(100) }), 'query'),
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.wid)
        const q = (req.query as unknown as { q: string }).q
        const docs = await prisma.document.findMany({
            where: { workspaceId: req.params.wid, deletedAt: null, OR: [{ title: { contains: q, mode: 'insensitive' } }, { text: { contains: q, mode: 'insensitive' } }] },
            select: { ...summary, text: true },
            orderBy: { updatedAt: 'desc' },
            take: 30,
        })
        const lower = q.toLowerCase()
        res.json(
            docs.map(({ text, ...d }) => {
                const at = text.toLowerCase().indexOf(lower)
                const snippet = at < 0 ? '' : `${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + q.length + 80).replace(/\s+/g, ' ')}…`
                return { ...d, snippet }
            })
        )
    })
)

router.post(
    '/workspaces/:wid/documents',
    validate(z.object({ title: z.string().trim().max(200).optional(), parentId: z.string().uuid().nullable().optional(), templateId: z.string().optional() })),
    handle(async (req, res) => {
        await requireWorkspaceRole(req.user.id, req.params.wid, 'EDITOR')
        const { title, parentId, templateId } = req.body as { title?: string; parentId?: string | null; templateId?: string }

        if (parentId) {
            const parent = await prisma.document.findFirst({ where: { id: parentId, workspaceId: req.params.wid, deletedAt: null }, select: { id: true } })
            if (!parent) throw notFound('Parent page')
        }
        const template = templateId ? TEMPLATES.find((t) => t.id === templateId) : undefined
        if (templateId && !template) throw badRequest('Unknown template')
        const content = template?.doc ?? EMPTY_DOC

        const last = await prisma.document.aggregate({ where: { workspaceId: req.params.wid, parentId: parentId ?? null, deletedAt: null }, _max: { position: true } })
        const doc = await prisma.document.create({
            data: {
                workspaceId: req.params.wid,
                parentId: parentId ?? null,
                title: title || (template && template.id !== 'blank' ? template.name : 'Untitled'),
                icon: template && template.id !== 'blank' ? template.icon : null,
                position: (last._max.position ?? -1) + 1,
                createdById: req.user.id,
                ydoc: stateFromJson(content),
                text: textFromJson(content),
            },
            select: summary,
        })
        res.status(201).json(doc)
    })
)

// ---------- Single document ----------

router.get(
    '/documents/:id',
    handle(async (req, res) => {
        const { doc, role } = await requireDocumentRole(req.user.id, req.params.id, 'VIEWER', { allowDeleted: true })
        // Breadcrumb trail
        const trail: { id: string; title: string; icon: string | null }[] = []
        let parentId = doc.parentId
        while (parentId && trail.length < 20) {
            const p: { id: string; title: string; icon: string | null; parentId: string | null } | null = await prisma.document.findUnique({ where: { id: parentId }, select: { id: true, title: true, icon: true, parentId: true } })
            if (!p) break
            trail.unshift({ id: p.id, title: p.title, icon: p.icon })
            parentId = p.parentId
        }
        res.json({
            id: doc.id,
            workspaceId: doc.workspaceId,
            title: doc.title,
            icon: doc.icon,
            parentId: doc.parentId,
            deleted: Boolean(doc.deletedAt),
            shareToken: role === 'VIEWER' ? null : doc.shareToken,
            role,
            trail,
            updatedAt: doc.updatedAt,
        })
    })
)

router.patch(
    '/documents/:id',
    validate(
        z.object({
            title: z.string().trim().max(200),
            icon: z.string().max(8).nullable(),
            parentId: z.string().uuid().nullable(),
            position: z.number().int().min(0),
        }).partial()
    ),
    handle(async (req, res) => {
        const { doc } = await requireDocumentRole(req.user.id, req.params.id, 'EDITOR')
        const data = req.body as { title?: string; icon?: string | null; parentId?: string | null; position?: number }

        if (data.parentId !== undefined && data.parentId !== doc.parentId) {
            if (data.parentId) {
                const parent = await prisma.document.findFirst({ where: { id: data.parentId, workspaceId: doc.workspaceId, deletedAt: null } })
                if (!parent) throw notFound('Parent page')
                if (await isSelfOrDescendant(doc.id, data.parentId)) throw badRequest('A page cannot be moved inside itself')
            }
            if (data.position === undefined) {
                const last = await prisma.document.aggregate({ where: { workspaceId: doc.workspaceId, parentId: data.parentId, deletedAt: null }, _max: { position: true } })
                data.position = (last._max.position ?? -1) + 1
            }
        }
        const updated = await prisma.document.update({ where: { id: doc.id }, data: { ...data, ...(data.title === '' ? { title: 'Untitled' } : {}) }, select: summary })
        res.json(updated)
    })
)

// Soft delete: the page and everything under it go to the trash together
router.delete(
    '/documents/:id',
    handle(async (req, res) => {
        const { doc } = await requireDocumentRole(req.user.id, req.params.id, 'EDITOR')
        const ids = [doc.id, ...(await descendantIds(doc.id))]
        await prisma.document.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), shareToken: null } })
        res.json({ message: 'Moved to trash', count: ids.length })
    })
)

router.post(
    '/documents/:id/restore',
    handle(async (req, res) => {
        const { doc } = await requireDocumentRole(req.user.id, req.params.id, 'EDITOR', { allowDeleted: true })
        const ids = [doc.id, ...(await descendantIds(doc.id))]
        await prisma.document.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } })
        // If the parent is still in the trash the page comes back at the top level
        if (doc.parentId) {
            const parent = await prisma.document.findUnique({ where: { id: doc.parentId }, select: { deletedAt: true } })
            if (!parent || parent.deletedAt) await prisma.document.update({ where: { id: doc.id }, data: { parentId: null } })
        }
        res.json({ message: 'Restored' })
    })
)

router.delete(
    '/documents/:id/permanent',
    handle(async (req, res) => {
        const { doc } = await requireDocumentRole(req.user.id, req.params.id, 'EDITOR', { allowDeleted: true })
        if (!doc.deletedAt) throw badRequest('Move the page to the trash first')
        await prisma.document.delete({ where: { id: doc.id } }) // children, versions and comments cascade
        res.json({ message: 'Deleted permanently' })
    })
)

// ---------- Version history ----------

router.get(
    '/documents/:id/versions',
    handle(async (req, res) => {
        await requireDocumentRole(req.user.id, req.params.id)
        res.json(await prisma.documentVersion.findMany({ where: { documentId: req.params.id }, select: { id: true, label: true, createdAt: true, createdById: true }, orderBy: { createdAt: 'desc' }, take: 100 }))
    })
)

router.post(
    '/documents/:id/versions',
    validate(z.object({ label: z.string().trim().min(1).max(100).default('Snapshot') })),
    handle(async (req, res) => {
        await requireDocumentRole(req.user.id, req.params.id, 'EDITOR')
        const state = await currentState(req.params.id)
        const version = await prisma.documentVersion.create({
            data: { documentId: req.params.id, ydoc: Buffer.from(state ?? new Uint8Array()), label: req.body.label, createdById: req.user.id },
            select: { id: true, label: true, createdAt: true },
        })
        res.status(201).json(version)
    })
)

router.get(
    '/documents/:id/versions/:versionId',
    handle(async (req, res) => {
        await requireDocumentRole(req.user.id, req.params.id)
        const v = await prisma.documentVersion.findFirst({ where: { id: req.params.versionId, documentId: req.params.id } })
        if (!v) throw notFound('Version')
        res.json({ id: v.id, label: v.label, createdAt: v.createdAt, html: htmlFromJson(jsonFromState(v.ydoc)) })
    })
)

// Restores a version into the live document, so everyone connected sees it immediately.
// The current content is saved first, so a restore can itself be undone.
router.post(
    '/documents/:id/versions/:versionId/restore',
    handle(async (req, res) => {
        await requireDocumentRole(req.user.id, req.params.id, 'EDITOR')
        const v = await prisma.documentVersion.findFirst({ where: { id: req.params.versionId, documentId: req.params.id } })
        if (!v) throw notFound('Version')

        const before = await currentState(req.params.id)
        if (before) await prisma.documentVersion.create({ data: { documentId: req.params.id, ydoc: Buffer.from(before), label: 'Before restore', createdById: req.user.id } })

        const connection = await hocuspocus.openDirectConnection(req.params.id, { restore: true })
        try {
            await connection.transact((doc) => {
                const target = doc.getXmlFragment(FRAGMENT)
                const source = ydocFromState(v.ydoc).getXmlFragment(FRAGMENT)
                target.delete(0, target.length)
                target.insert(0, source.toArray().map((node) => node.clone() as Y.XmlElement | Y.XmlText))
            })
        } finally {
            await connection.disconnect()
        }
        res.json({ message: 'Version restored' })
    })
)

// ---------- Export ----------

router.get(
    '/documents/:id/export',
    validate(z.object({ format: z.enum(['md', 'html']).default('md') }), 'query'),
    handle(async (req, res) => {
        const { doc } = await requireDocumentRole(req.user.id, req.params.id)
        const format = (req.query as unknown as { format: 'md' | 'html' }).format
        const json = jsonFromState(await currentState(doc.id))
        const safeName = doc.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'document'

        if (format === 'md') {
            res.type('text/markdown; charset=utf-8')
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}.md"`)
            return res.send(`# ${doc.title}\n\n${markdownFromJson(json)}`)
        }
        const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
        res.type('text/html; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.html"`)
        res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:3rem auto;padding:0 1rem;line-height:1.6}pre{background:#f4f4f5;padding:1rem;border-radius:6px;overflow:auto}blockquote{border-left:4px solid #ddd;margin-left:0;padding-left:1rem;color:#555}</style></head><body><h1>${esc(doc.title)}</h1>${htmlFromJson(json)}</body></html>`)
    })
)

// ---------- Public share link ----------

router.post(
    '/documents/:id/share',
    handle(async (req, res) => {
        const { doc } = await requireDocumentRole(req.user.id, req.params.id, 'EDITOR')
        const shareToken = doc.shareToken ?? crypto.randomBytes(24).toString('base64url')
        if (!doc.shareToken) await prisma.document.update({ where: { id: doc.id }, data: { shareToken } })
        res.json({ shareToken })
    })
)

router.delete(
    '/documents/:id/share',
    handle(async (req, res) => {
        await requireDocumentRole(req.user.id, req.params.id, 'EDITOR')
        await prisma.document.update({ where: { id: req.params.id }, data: { shareToken: null } })
        res.json({ shareToken: null })
    })
)

export default router
