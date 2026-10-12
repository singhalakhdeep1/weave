/**
 * Demo data: two users sharing a workspace.
 *   alice@weave.dev (owner)   bob@weave.dev (editor)    password: Password123
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { stateFromJson, textFromJson, TEMPLATES } from '../src/lib/editor'

config()
const prisma = new PrismaClient()

async function main() {
    const password = await bcrypt.hash('Password123', 12)
    const alice = await prisma.user.upsert({ where: { email: 'alice@weave.dev' }, update: {}, create: { email: 'alice@weave.dev', name: 'Alice Rivera', password } })
    const bob = await prisma.user.upsert({ where: { email: 'bob@weave.dev' }, update: {}, create: { email: 'bob@weave.dev', name: 'Bob Chen', password } })

    if (await prisma.workspace.findFirst({ where: { name: 'Demo team', members: { some: { userId: alice.id } } } })) {
        console.log('Demo data already present')
        return
    }

    const ws = await prisma.workspace.create({
        data: { name: 'Demo team', members: { create: [{ userId: alice.id, role: 'OWNER' }, { userId: bob.id, role: 'EDITOR' }] } },
    })
    for (const [i, id] of ['meeting-notes', 'project-plan', 'weekly-todo'].entries()) {
        const t = TEMPLATES.find((x) => x.id === id)!
        await prisma.document.create({
            data: { workspaceId: ws.id, title: t.name, icon: t.icon, position: i, createdById: alice.id, ydoc: stateFromJson(t.doc), text: textFromJson(t.doc) },
        })
    }
    console.log('Seeded demo team. Logins: alice@weave.dev / bob@weave.dev (password: Password123)')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
