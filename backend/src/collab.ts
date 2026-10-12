/**
 * Realtime collaboration (Yjs over WebSocket via Hocuspocus).
 * Every connection must present a valid access token for a user who belongs to the
 * document's workspace; viewers get a read-only connection.
 */
import { Hocuspocus } from '@hocuspocus/server'
import * as Y from 'yjs'
import { prisma } from './lib/prisma'
import { verifyAccessToken } from './lib/tokens'
import { jsonFromState, textFromJson } from './lib/editor'

const AUTO_VERSION_EVERY_MS = 10 * 60_000
const MAX_AUTO_VERSIONS = 50

export const hocuspocus = new Hocuspocus({
    name: 'weave',
    debounce: 2000,
    maxDebounce: 10_000,

    async onAuthenticate({ token, documentName, connection }) {
        let userId: string
        try {
            userId = verifyAccessToken(token).userId
        } catch {
            throw new Error('Unauthorized')
        }

        const doc = await prisma.document.findUnique({ where: { id: documentName }, select: { workspaceId: true, deletedAt: true } })
        if (!doc || doc.deletedAt) throw new Error('Document not found')

        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId: doc.workspaceId } },
            include: { user: { select: { id: true, name: true } } },
        })
        if (!member) throw new Error('Forbidden')

        connection.readOnly = member.role === 'VIEWER'
        return { user: { id: member.user.id, name: member.user.name }, role: member.role }
    },

    async onLoadDocument({ documentName, document }) {
        const row = await prisma.document.findUnique({ where: { id: documentName }, select: { ydoc: true } })
        if (row?.ydoc?.length) Y.applyUpdate(document, new Uint8Array(row.ydoc))
        return document
    },

    async onStoreDocument({ documentName, document }) {
        const state = Buffer.from(Y.encodeStateAsUpdate(document))
        const existing = await prisma.document.findUnique({ where: { id: documentName }, select: { ydoc: true, deletedAt: true } })
        if (!existing || existing.deletedAt) return // deleted while connected: do not resurrect
        if (existing.ydoc && Buffer.compare(Buffer.from(existing.ydoc), state) === 0) return // nothing changed

        const text = textFromJson(jsonFromState(state))
        await prisma.document.update({ where: { id: documentName }, data: { ydoc: state, text } })

        // Automatic history: one snapshot per 10 minutes of activity, newest 50 kept
        const last = await prisma.documentVersion.findFirst({ where: { documentId: documentName }, orderBy: { createdAt: 'desc' } })
        if (!last || Date.now() - last.createdAt.getTime() > AUTO_VERSION_EVERY_MS) {
            await prisma.documentVersion.create({ data: { documentId: documentName, ydoc: state } })
            const old = await prisma.documentVersion.findMany({
                where: { documentId: documentName, label: null },
                orderBy: { createdAt: 'desc' },
                skip: MAX_AUTO_VERSIONS,
                select: { id: true },
            })
            if (old.length) await prisma.documentVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } })
        }
    },
})
