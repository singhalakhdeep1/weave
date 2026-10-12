import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, FilePlus, LogOut, Moon, Plus, Search, Settings, Sun, Trash2 } from 'lucide-react'
import { api, type DocSummary, type Workspace } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Input, Modal, cx, errorMessage, useToast } from './ui'

function Tree({ docs, parentId, depth, activeId, onNavigate, onCreate, onDelete, onMove, dragRef, setDragId, expanded, toggle }: {
  docs: DocSummary[]; parentId: string | null; depth: number; activeId?: string; onNavigate: () => void
  onCreate: (parentId: string) => void; onDelete: (d: DocSummary) => void; onMove: (id: string, parentId: string | null) => void
  dragRef: React.MutableRefObject<string | null>; setDragId: (id: string | null) => void; expanded: Set<string>; toggle: (id: string) => void
}) {
  const items = docs.filter((d) => d.parentId === parentId)
  return (
    <ul>
      {items.map((d) => {
        const kids = docs.some((x) => x.parentId === d.id)
        const open = expanded.has(d.id)
        return (
          <li key={d.id}>
            <div
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); dragRef.current = d.id; setDragId(d.id) }}
              onDragEnd={() => { dragRef.current = null; setDragId(null) }}
              onDragOver={(e) => { if (dragRef.current && dragRef.current !== d.id) e.preventDefault() }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const id = dragRef.current; dragRef.current = null; setDragId(null); if (id && id !== d.id) onMove(id, d.id) }}
              className={cx('group flex items-center rounded-md pr-1 text-sm hover:bg-zinc-200/60 dark:hover:bg-zinc-800', activeId === d.id && 'bg-zinc-200 dark:bg-zinc-800')}
              style={{ paddingLeft: 4 + depth * 14 }}
            >
              <button onClick={() => toggle(d.id)} aria-label={open ? 'Collapse' : 'Expand'} className={cx('rounded p-0.5 text-zinc-400 hover:text-zinc-700', !kids && 'invisible')}>
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <NavLink to={`d/${d.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5">
                <span aria-hidden>{d.icon ?? '📄'}</span>
                <span className="truncate">{d.title || 'Untitled'}</span>
              </NavLink>
              <button onClick={() => onCreate(d.id)} aria-label={`Add a page inside ${d.title}`} className="hidden rounded p-1 text-zinc-500 hover:bg-zinc-300/60 group-hover:block dark:hover:bg-zinc-700"><Plus className="h-3.5 w-3.5" /></button>
              <button onClick={() => onDelete(d)} aria-label={`Move ${d.title} to trash`} className="hidden rounded p-1 text-zinc-500 hover:bg-zinc-300/60 group-hover:block dark:hover:bg-zinc-700"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {kids && open && (
              <Tree docs={docs} parentId={d.id} depth={depth + 1} activeId={activeId} onNavigate={onNavigate} onCreate={onCreate} onDelete={onDelete} onMove={onMove} dragRef={dragRef} setDragId={setDragId} expanded={expanded} toggle={toggle} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function SearchDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t) }, [q])
  const hits = useQuery({ queryKey: ['search', workspaceId, debounced], queryFn: () => api.search(workspaceId, debounced), enabled: debounced.length > 0 })

  return (
    <Modal title="Search" onClose={onClose} wide>
      <Input autoFocus placeholder="Search titles and content…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pages" />
      <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
        {hits.data?.map((h) => (
          <li key={h.id}>
            <button className="w-full rounded-md px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => { navigate(`d/${h.id}`); onClose() }}>
              <span className="text-sm font-medium">{h.icon ?? '📄'} {h.title}</span>
              {h.snippet && <span className="block truncate text-xs text-zinc-500">{h.snippet}</span>}
            </button>
          </li>
        ))}
        {debounced && hits.data?.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">No results for “{debounced}”.</li>}
      </ul>
    </Modal>
  )
}

export function Sidebar({ workspace, workspaces, onNavigate }: { workspace: Workspace; workspaces: Workspace[]; onNavigate: () => void }) {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { user, signOut } = useAuth()
  const [searching, setSearching] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const dragRef = useRef<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  const searchBtn = useRef<HTMLButtonElement>(null)

  const docs = useQuery({ queryKey: ['documents', workspace.id], queryFn: () => api.documents(workspace.id) })
  const list = useMemo(() => docs.data ?? [], [docs.data])
  const canEdit = workspace.role !== 'VIEWER'

  // Ctrl/Cmd+K opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching(true) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const refresh = () => qc.invalidateQueries({ queryKey: ['documents', workspace.id] })
  const onError = (e: unknown) => toast.show(errorMessage(e), true)

  const create = useMutation({
    mutationFn: (parentId: string | null) => api.createDocument(workspace.id, { parentId }),
    onSuccess: (doc) => {
      refresh()
      if (doc.parentId) setExpanded((s) => new Set(s).add(doc.parentId!))
      navigate(`d/${doc.id}`)
      onNavigate()
    },
    onError,
  })
  const trash = useMutation({
    mutationFn: (d: DocSummary) => api.trashDocument(d.id),
    onSuccess: (_r, d) => {
      refresh()
      qc.invalidateQueries({ queryKey: ['trash', workspace.id] })
      toast.show(`“${d.title}” moved to trash`)
      if (documentId === d.id) navigate('.', { relative: 'route' })
    },
    onError,
  })
  const move = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) => api.updateDocument(id, { parentId }),
    onSuccess: (_r, v) => { refresh(); if (v.parentId) setExpanded((s) => new Set(s).add(v.parentId!)) },
    onError,
  })

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTheme = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('weave_theme', next ? 'dark' : 'light') } catch { /* ignore */ }
    setDark(next)
  }

  const switchWorkspace = async (value: string) => {
    if (value === '__new') {
      const name = window.prompt('Name for the new workspace')?.trim()
      if (!name) return
      try {
        const ws = await api.createWorkspace(name)
        await qc.invalidateQueries({ queryKey: ['workspaces'] })
        navigate(`/w/${ws.id}`)
      } catch (e) { onError(e) }
      return
    }
    navigate(`/w/${value}`)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <select value={workspace.id} onChange={(e) => switchWorkspace(e.target.value)} aria-label="Workspace" className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900">
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          <option value="__new">+ New workspace…</option>
        </select>
      </div>

      <div className="space-y-0.5 px-2">
        <button ref={searchBtn} onClick={() => setSearching(true)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <Search className="h-4 w-4" />Search<kbd className="ml-auto text-xs text-zinc-400">Ctrl K</kbd>
        </button>
        <Link to="." onClick={onNavigate} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800">🏠 Home</Link>
      </div>

      <div className="mt-3 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Pages
        {canEdit && <button onClick={() => create.mutate(null)} aria-label="New page" className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800"><FilePlus className="h-4 w-4" /></button>}
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        aria-label="Pages"
        onDragOver={(e) => dragRef.current && e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const id = dragRef.current; dragRef.current = null; setDragId(null); if (id) move.mutate({ id, parentId: null }) }}
      >
        {docs.isLoading ? <p className="p-2 text-sm text-zinc-500">Loading…</p> : list.length === 0 ? (
          <p className="p-2 text-sm text-zinc-500">No pages yet.</p>
        ) : (
          <Tree
            docs={list} parentId={null} depth={0} activeId={documentId} onNavigate={onNavigate}
            onCreate={(pid) => canEdit && create.mutate(pid)} onDelete={(d) => canEdit && trash.mutate(d)}
            onMove={(id, parentId) => canEdit && move.mutate({ id, parentId })}
            dragRef={dragRef} setDragId={setDragId} expanded={expanded} toggle={toggle}
          />
        )}
        {dragId && <p className="mt-2 rounded border border-dashed p-2 text-center text-xs text-zinc-500">Drop here to move to the top level</p>}
      </nav>

      <div className="space-y-0.5 border-t border-zinc-200 p-2 dark:border-zinc-800">
        <NavLink to="trash" onClick={onNavigate} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"><Trash2 className="h-4 w-4" />Trash</NavLink>
        <NavLink to="settings" onClick={onNavigate} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"><Settings className="h-4 w-4" />Workspace &amp; account</NavLink>
        <div className="flex items-center gap-1 px-2 pt-1">
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-500" title={user?.email}>{user?.name}</span>
          <Button variant="ghost" small onClick={toggleTheme} aria-label="Toggle dark mode">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button variant="ghost" small onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>

      {searching && <SearchDialog workspaceId={workspace.id} onClose={() => setSearching(false)} />}
    </div>
  )
}
