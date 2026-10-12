import { prisma } from './prisma'
import { EMPTY_DOC, Node, stateFromJson, textFromJson } from './editor'

const welcome: Node = {
    type: 'doc',
    content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to Weave' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Everything here is edited together in real time. Open this page in a second browser to see live cursors.' }] },
        {
            type: 'taskList',
            content: ['Type / to see formatting options', 'Select text to add a comment', 'Open Share to invite people or publish a read-only link', 'Check Version history to go back in time'].map((t) => ({
                type: 'taskItem',
                attrs: { checked: false },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
            })),
        },
    ],
}

/** Creates a workspace owned by `userId`, with a welcome page. */
export async function createWorkspace(userId: string, name: string) {
    return prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({ data: { name, members: { create: { userId, role: 'OWNER' } } } })
        await tx.document.create({
            data: { workspaceId: workspace.id, title: 'Getting started', icon: '👋', createdById: userId, ydoc: stateFromJson(welcome), text: textFromJson(welcome) },
        })
        return workspace
    })
}

export const blankState = () => stateFromJson(EMPTY_DOC)
