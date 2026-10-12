import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { Bold, Code, Code2, Heading1, Heading2, Heading3, Highlighter, Italic, LinkIcon, List, ListChecks, ListOrdered, Minus, Quote, Strikethrough, Underline as UnderlineIcon, MessageSquare } from 'lucide-react'
import { collabUrl, getFreshToken, type User } from '../lib/api'
import { colorFor, cx } from './ui'

export type ConnectionStatus = 'connecting' | 'connected' | 'offline'
export interface Peer { clientId: number; name: string; color: string }

interface Props {
  documentId: string
  user: User
  readOnly: boolean
  onStatus: (s: ConnectionStatus) => void
  onPeers: (p: Peer[]) => void
  onComment: (quote: string) => void
  onEditor: (e: TiptapEditor | null) => void
}

interface Collab { ydoc: Y.Doc; provider: HocuspocusProvider; persistence: IndexeddbPersistence }

export function CollabEditor({ documentId, user, readOnly, onStatus, onPeers, onComment, onEditor }: Props) {
  const [collab, setCollab] = useState<Collab | null>(null)

  // Created in an effect (not during render) so React StrictMode cannot leak a second live connection
  useEffect(() => {
    const ydoc = new Y.Doc()
    let failed = false
    const persistence = new IndexeddbPersistence(`weave:${documentId}`, ydoc) // offline copy; edits made offline sync on reconnect
    const provider = new HocuspocusProvider({
      url: collabUrl(),
      name: documentId,
      document: ydoc,
      token: () => getFreshToken(), // re-evaluated on every (re)connect, so an expired access token never strands the editor
      onStatus: ({ status }) => {
        // After a failed connection stay "Offline" (not "Connecting…") until it really reconnects
        if (status === 'disconnected') failed = true
        if (status === 'connected') failed = false
        onStatus(status === 'connected' ? 'connected' : failed ? 'offline' : 'connecting')
      },
      onClose: () => { failed = true; onStatus('offline') }, // every failed or dropped attempt closes the socket
      onAuthenticationFailed: () => onStatus('offline'),
    })
    provider.awareness?.setLocalStateField('user', { name: user.name, color: colorFor(user.id) })

    const reportPeers = () => {
      const states = provider.awareness?.getStates() ?? new Map()
      const peers: Peer[] = []
      states.forEach((s, clientId) => {
        const u = (s as { user?: { name: string; color: string } }).user
        if (u && clientId !== provider.awareness?.clientID) peers.push({ clientId, name: u.name, color: u.color })
      })
      onPeers(peers)
    }
    provider.awareness?.on('change', reportPeers)

    setCollab({ ydoc, provider, persistence })
    return () => {
      provider.awareness?.off('change', reportPeers)
      provider.destroy()
      void persistence.destroy()
      ydoc.destroy()
      setCollab(null)
      onPeers([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, user.id, user.name])

  if (!collab) return null
  return <EditorSurface key={documentId} collab={collab} user={user} readOnly={readOnly} onComment={onComment} onEditor={onEditor} />
}

const COMMANDS = [
  { id: 'h1', label: 'Heading 1', hint: 'Big section title', run: (e: TiptapEditor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Heading 2', hint: 'Medium section title', run: (e: TiptapEditor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Heading 3', hint: 'Small section title', run: (e: TiptapEditor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'bullet', label: 'Bulleted list', hint: 'Simple list', run: (e: TiptapEditor) => e.chain().focus().toggleBulletList().run() },
  { id: 'number', label: 'Numbered list', hint: 'Ordered list', run: (e: TiptapEditor) => e.chain().focus().toggleOrderedList().run() },
  { id: 'todo', label: 'To-do list', hint: 'Track tasks', run: (e: TiptapEditor) => e.chain().focus().toggleTaskList().run() },
  { id: 'quote', label: 'Quote', hint: 'Highlight a quotation', run: (e: TiptapEditor) => e.chain().focus().toggleBlockquote().run() },
  { id: 'code', label: 'Code block', hint: 'Monospaced code', run: (e: TiptapEditor) => e.chain().focus().toggleCodeBlock().run() },
  { id: 'divider', label: 'Divider', hint: 'Horizontal line', run: (e: TiptapEditor) => e.chain().focus().setHorizontalRule().run() },
]

function EditorSurface({ collab, user, readOnly, onComment, onEditor }: { collab: Collab; user: User; readOnly: boolean; onComment: (q: string) => void; onEditor: (e: TiptapEditor | null) => void }) {
  const [menu, setMenu] = useState<{ query: string; x: number; y: number } | null>(null)
  const [index, setIndex] = useState(0)
  const menuRef = useRef<typeof menu>(null)
  const indexRef = useRef(0)
  const editorRef = useRef<TiptapEditor | null>(null)
  menuRef.current = menu
  indexRef.current = index

  const items = (query: string) => COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

  const choose = (editor: TiptapEditor, id: string) => {
    const cmd = COMMANDS.find((c) => c.id === id)
    if (!cmd) return
    const { $from } = editor.state.selection
    // Remove the "/query" text, then apply the command
    editor.chain().focus().deleteRange({ from: $from.start(), to: $from.pos }).run()
    cmd.run(editor)
    setMenu(null)
  }

  const editor = useEditor(
    {
      editable: !readOnly,
      extensions: [
        StarterKit.configure({ history: false }), // undo/redo comes from the collaboration extension
        Underline,
        Highlight,
        Link.configure({ openOnClick: false, autolink: true }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder: readOnly ? '' : "Type '/' for commands…" }),
        Collaboration.configure({ document: collab.ydoc }),
        CollaborationCursor.configure({ provider: collab.provider, user: { name: user.name, color: colorFor(user.id) } }),
      ],
      editorProps: {
        attributes: { class: 'prose-weave', 'aria-label': 'Document editor' },
        handleKeyDown: (_view, event) => {
          const m = menuRef.current
          if (!m) return false
          const list = items(m.query)
          if (event.key === 'ArrowDown') { setIndex((i) => (i + 1) % Math.max(list.length, 1)); return true }
          if (event.key === 'ArrowUp') { setIndex((i) => (i - 1 + list.length) % Math.max(list.length, 1)); return true }
          if (event.key === 'Escape') { setMenu(null); return true }
          if (event.key === 'Enter' && list.length) { const ed = editorRef.current; if (ed) choose(ed, list[indexRef.current % list.length].id); return true }
          return false
        },
      },
      // Open the slash menu when the current paragraph is just "/something"
      onTransaction: ({ editor }) => {
        if (!editor.isEditable) return
        const { $from, empty } = editor.state.selection
        const text = $from.parent.textContent
        if (empty && $from.parent.type.name === 'paragraph' && /^\/\w*$/.test(text) && $from.parentOffset === text.length) {
          const coords = editor.view.coordsAtPos($from.pos)
          setMenu((prev) => { if (!prev || prev.query !== text.slice(1)) setIndex(0); return { query: text.slice(1), x: coords.left, y: coords.bottom + 6 } })
        } else if (menuRef.current) {
          setMenu(null)
        }
      },
    },
    [collab],
  )

  editorRef.current = editor
  useEffect(() => { onEditor(editor); return () => onEditor(null) }, [editor, onEditor])
  useEffect(() => { editor?.setEditable(!readOnly) }, [editor, readOnly])

  if (!editor) return null
  const list = menu ? items(menu.query) : []

  return (
    <div>
      {!readOnly && <Toolbar editor={editor} onComment={onComment} />}
      <EditorContent editor={editor} className="mt-4" />
      {menu && list.length > 0 && (
        <ul role="listbox" aria-label="Commands" className="no-print fixed z-50 max-h-72 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800" style={{ left: menu.x, top: menu.y }}>
          {list.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === index % list.length}>
              <button
                onMouseDown={(e) => { e.preventDefault(); choose(editor, c.id) }}
                className={cx('w-full rounded-md px-2.5 py-1.5 text-left text-sm', i === index % list.length ? 'bg-zinc-100 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700')}
              >
                <span className="block font-medium">{c.label}</span>
                <span className="block text-xs text-zinc-500">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Toolbar({ editor, onComment }: { editor: TiptapEditor; onComment: (quote: string) => void }) {
  const btn = (label: string, active: boolean, run: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={run}
      className={cx('rounded p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700', active && 'bg-zinc-200 dark:bg-zinc-700')}
    >
      {icon}
    </button>
  )
  const sep = <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />
  const c = () => editor.chain().focus()
  const i = 'h-4 w-4'

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link address (leave empty to remove)', previous ?? 'https://')
    if (url === null) return
    if (url.trim() === '') return void c().unsetLink().run()
    if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) { window.alert('Links must start with http://, https:// or mailto:'); return }
    c().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const comment = () => {
    const { from, to } = editor.state.selection
    onComment(from === to ? '' : editor.state.doc.textBetween(from, to, ' ').slice(0, 300))
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-lg border border-zinc-200 bg-white/95 p-1 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      {btn('Bold', editor.isActive('bold'), () => c().toggleBold().run(), <Bold className={i} />)}
      {btn('Italic', editor.isActive('italic'), () => c().toggleItalic().run(), <Italic className={i} />)}
      {btn('Underline', editor.isActive('underline'), () => c().toggleUnderline().run(), <UnderlineIcon className={i} />)}
      {btn('Strikethrough', editor.isActive('strike'), () => c().toggleStrike().run(), <Strikethrough className={i} />)}
      {btn('Highlight', editor.isActive('highlight'), () => c().toggleHighlight().run(), <Highlighter className={i} />)}
      {btn('Inline code', editor.isActive('code'), () => c().toggleCode().run(), <Code className={i} />)}
      {btn('Link', editor.isActive('link'), setLink, <LinkIcon className={i} />)}
      {sep}
      {btn('Heading 1', editor.isActive('heading', { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), <Heading1 className={i} />)}
      {btn('Heading 2', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), <Heading2 className={i} />)}
      {btn('Heading 3', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), <Heading3 className={i} />)}
      {sep}
      {btn('Bulleted list', editor.isActive('bulletList'), () => c().toggleBulletList().run(), <List className={i} />)}
      {btn('Numbered list', editor.isActive('orderedList'), () => c().toggleOrderedList().run(), <ListOrdered className={i} />)}
      {btn('To-do list', editor.isActive('taskList'), () => c().toggleTaskList().run(), <ListChecks className={i} />)}
      {btn('Quote', editor.isActive('blockquote'), () => c().toggleBlockquote().run(), <Quote className={i} />)}
      {btn('Code block', editor.isActive('codeBlock'), () => c().toggleCodeBlock().run(), <Code2 className={i} />)}
      {btn('Divider', false, () => c().setHorizontalRule().run(), <Minus className={i} />)}
      {sep}
      {btn('Comment on selection', false, comment, <MessageSquare className={i} />)}
    </div>
  )
}
