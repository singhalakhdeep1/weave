/**
 * The shared editor schema plus conversions between Yjs state and JSON / HTML /
 * Markdown / plain text. The frontend uses the same extensions, so a document
 * rendered here matches what users see in the editor.
 */
import { TiptapTransformer } from '@hocuspocus/transformer'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

export const FRAGMENT = 'default'

export const extensions = [
    StarterKit,
    Underline,
    Highlight,
    Link.configure({ openOnClick: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
]

export interface Node {
    type?: string
    text?: string
    attrs?: Record<string, unknown>
    marks?: { type: string; attrs?: Record<string, unknown> }[]
    content?: Node[]
}

export const EMPTY_DOC: Node = { type: 'doc', content: [{ type: 'paragraph' }] }

export function ydocFromState(state: Uint8Array | Buffer | null | undefined): Y.Doc {
    const doc = new Y.Doc()
    if (state && state.length) Y.applyUpdate(doc, new Uint8Array(state))
    return doc
}

export const stateFromJson = (json: Node): Buffer => Buffer.from(Y.encodeStateAsUpdate(TiptapTransformer.toYdoc(json, FRAGMENT, extensions)))

export const jsonFromState = (state: Uint8Array | Buffer | null | undefined): Node => {
    const json = TiptapTransformer.fromYdoc(ydocFromState(state), FRAGMENT) as Node
    return json?.content ? json : EMPTY_DOC
}

// A link mark's href is free text, so dangerous schemes are neutralised before HTML leaves the server
const UNSAFE_HREF = /href="\s*(?:javascript|data|vbscript):[^"]*"/gi

export const htmlFromJson = (json: Node): string => generateHTML(json as never, extensions).replace(UNSAFE_HREF, 'href="#"')

// ---------- plain text (search index) ----------

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock'])

export function textFromJson(node: Node): string {
    const parts: string[] = []
    const walk = (n: Node) => {
        if (n.text) parts.push(n.text)
        n.content?.forEach(walk)
        if (n.type && BLOCKS.has(n.type)) parts.push('\n')
    }
    walk(node)
    return parts.join('').replace(/\n{2,}/g, '\n').trim().slice(0, 200_000)
}

// ---------- Markdown export ----------

function inline(nodes: Node[] = []): string {
    return nodes
        .map((n) => {
            if (n.type === 'hardBreak') return '  \n'
            let text = n.text ?? ''
            for (const mark of n.marks ?? []) {
                if (mark.type === 'bold') text = `**${text}**`
                else if (mark.type === 'italic') text = `*${text}*`
                else if (mark.type === 'strike') text = `~~${text}~~`
                else if (mark.type === 'code') text = `\`${text}\``
                else if (mark.type === 'link') text = `[${text}](${String(mark.attrs?.href ?? '')})`
                else if (mark.type === 'highlight') text = `==${text}==`
            }
            return text
        })
        .join('')
}

function block(node: Node, indent = ''): string {
    const children = node.content ?? []
    switch (node.type) {
        case 'heading':
            return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inline(children)}`
        case 'paragraph':
            return indent + inline(children)
        case 'blockquote':
            return children.map((c) => block(c)).join('\n\n').split('\n').map((l) => `> ${l}`).join('\n')
        case 'codeBlock':
            return `\`\`\`${String(node.attrs?.language ?? '')}\n${children.map((c) => c.text ?? '').join('')}\n\`\`\``
        case 'horizontalRule':
            return '---'
        case 'bulletList':
            return children.map((li) => listItem(li, `${indent}- `, indent + '  ')).join('\n')
        case 'orderedList':
            return children.map((li, i) => listItem(li, `${indent}${i + 1}. `, indent + '   ')).join('\n')
        case 'taskList':
            return children.map((li) => listItem(li, `${indent}- [${li.attrs?.checked ? 'x' : ' '}] `, indent + '  ')).join('\n')
        default:
            return children.map((c) => block(c, indent)).join('\n\n')
    }
}

function listItem(li: Node, marker: string, childIndent: string): string {
    const [first, ...rest] = li.content ?? []
    const head = first ? block(first).replace(/^\s+/, '') : ''
    const tail = rest.map((c) => (c.type && /List$/.test(c.type) ? block(c, childIndent) : childIndent + block(c))).join('\n')
    return `${marker}${head}${tail ? `\n${tail}` : ''}`
}

export const markdownFromJson = (json: Node): string => (json.content ?? []).map((n) => block(n)).join('\n\n') + '\n'

// ---------- templates ----------

const p = (text: string): Node => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined })
const h = (level: number, text: string): Node => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const bullets = (...items: string[]): Node => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [p(t)] })) })
const tasks = (...items: string[]): Node => ({ type: 'taskList', content: items.map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(t)] })) })

export const TEMPLATES: { id: string; name: string; icon: string; doc: Node }[] = [
    { id: 'blank', name: 'Blank page', icon: '📄', doc: EMPTY_DOC },
    {
        id: 'meeting-notes',
        name: 'Meeting notes',
        icon: '🗒️',
        doc: { type: 'doc', content: [h(1, 'Meeting notes'), p('Date: '), p('Attendees: '), h(2, 'Agenda'), bullets('Topic one', 'Topic two'), h(2, 'Decisions'), p(''), h(2, 'Action items'), tasks('Owner: task', 'Owner: task')] },
    },
    {
        id: 'project-plan',
        name: 'Project plan',
        icon: '🗺️',
        doc: { type: 'doc', content: [h(1, 'Project plan'), h(2, 'Goal'), p('What are we trying to achieve and why?'), h(2, 'Milestones'), tasks('Milestone one', 'Milestone two', 'Launch'), h(2, 'Risks'), bullets('Risk and mitigation')] },
    },
    {
        id: 'weekly-todo',
        name: 'Weekly to-do',
        icon: '✅',
        doc: { type: 'doc', content: [h(1, 'This week'), h(2, 'Must do'), tasks('', ''), h(2, 'Nice to have'), tasks(''), h(2, 'Notes'), p('')] },
    },
]
