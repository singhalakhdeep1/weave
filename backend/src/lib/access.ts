import { Role } from '@prisma/client'
import { forbidden, notFound } from './errors'
import { prisma } from './prisma'

const RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 }

/** Throws unless the user belongs to the workspace with at least `min` role. */
export async function requireWorkspaceRole(userId: string, workspaceId: string, min: Role = 'VIEWER'): Promise<Role> {
    const member = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } })
    // 404 (not 403) so non-members cannot probe which workspaces exist
    if (!member) throw notFound('Workspace')
    if (RANK[member.role] < RANK[min]) throw forbidden(min === 'OWNER' ? 'Only workspace owners can do this' : 'You have read-only access')
    return member.role
}

/** Loads a (non-deleted unless allowed) document and checks the caller's role in its workspace. */
export async function requireDocumentRole(userId: string, documentId: string, min: Role = 'VIEWER', opts: { allowDeleted?: boolean } = {}) {
    const doc = await prisma.document.findUnique({ where: { id: documentId } })
    if (!doc || (doc.deletedAt && !opts.allowDeleted)) throw notFound('Document')
    const role = await requireWorkspaceRole(userId, doc.workspaceId, min)
    return { doc, role }
}

/** True when `candidateId` is `documentId` itself or one of its descendants (prevents tree cycles). */
export async function isSelfOrDescendant(documentId: string, candidateId: string): Promise<boolean> {
    let current: string | null = candidateId
    const seen = new Set<string>()
    while (current && !seen.has(current)) {
        if (current === documentId) return true
        seen.add(current)
        const parent: { parentId: string | null } | null = await prisma.document.findUnique({ where: { id: current }, select: { parentId: true } })
        current = parent?.parentId ?? null
    }
    return false
}
