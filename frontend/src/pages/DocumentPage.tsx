import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { Download, History, MessageSquare, Printer, Share2, Wifi, WifiOff } from 'lucide-react'
import { api, downloadExport } from '../lib/api'
import { useAuth } from '../lib/auth'
import { CollabEditor, type ConnectionStatus, type Peer } from '../components/Editor'
import { CommentsPanel, HistoryPanel, ShareModal } from '../components/Panels'
import { Button, ErrorBox, Spinner, cx, errorMessage, useToast } from '../components/ui'

const EMOJIS = ['📄', '📝', '📌', '💡', '🚀', '🎯', '📊', '🗓️', '✅', '📚', '🧪', '🔒', '🎨', '🛠️', '❤️', '⭐']

export function DocumentPage() {
  const { workspaceId = '', documentId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [peers, setPeers] = useState<Peer[]>([])
  const [panel, setPanel] = useState<'comments' | 'history' | null>(null)
  const [quote, setQuote] = useState('')
  const [sharing, setSharing] = useState(false)
  const [menu, setMenu] = useState<'export' | 'icon' | null>(null)
  const [title, setTitle] = useState('')
  const editorRef = useRef<TiptapEditor | null>(null)
  const setEditor = useCallback((e: TiptapEditor | null) => { editorRef.current = e }, [])

  const doc = useQuery({ queryKey: ['document', documentId], queryFn: () => api.document(documentId) })
  useEffect(() => { if (doc.data) setTitle(doc.data.title) }, [doc.data?.id, doc.data?.title]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPanel(null); setQuote(''); setStatus('connecting'); setMenu(null) }, [documentId])

  const refreshTree = () => qc.invalidateQueries({ queryKey: ['documents', workspaceId] })
  const rename = useMutation({
    mutationFn: (v: { title?: string; icon?: string | null }) => api.updateDocument(documentId, v),
    onSuccess: () => { refreshTree(); qc.invalidateQueries({ queryKey: ['document', documentId] }) },
    onError: (e) => toast.show(errorMessage(e), true),
  })
  const restoreFromTrash = useMutation({
    mutationFn: () => api.restoreDocument(documentId),
    onSuccess: () => { refreshTree(); qc.invalidateQueries({ queryKey: ['document', documentId] }); qc.invalidateQueries({ queryKey: ['trash', workspaceId] }); toast.show('Page restored') },
    onError: (e) => toast.show(errorMessage(e), true),
  })

  // Save the title shortly after the user stops typing
  const titleTimer = useRef<ReturnType<typeof setTimeout>>()
  const onTitle = (value: string) => {
    setTitle(value)
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => rename.mutate({ title: value }), 600)
  }

  if (doc.isLoading) return <Spinner />
  if (doc.isError || !doc.data) return <ErrorBox error={doc.error} retry={() => doc.refetch()} />
  const d = doc.data
  const canEdit = d.role !== 'VIEWER' && !d.deleted
  const openPanel = (p: 'comments' | 'history') => setPanel((cur) => (cur === p ? null : p))

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm text-zinc-500">
            {d.trail.map((t) => (
              <span key={t.id} className="flex items-center gap-1">
                <Link to={`/w/${workspaceId}/d/${t.id}`} className="hover:underline">{t.icon ?? '📄'} {t.title}</Link><span>/</span>
              </span>
            ))}
            <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">{d.icon ?? '📄'} {title || 'Untitled'}</span>
          </nav>

          <span className={cx('flex items-center gap-1 text-xs', status === 'connected' ? 'text-green-600' : 'text-amber-600')} role="status" title={status === 'connected' ? 'All changes are saved' : 'Offline: changes are kept on this device and sync when you reconnect'}>
            {status === 'connected' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline'}
          </span>

          <div className="flex -space-x-2" aria-label={`${peers.length} other ${peers.length === 1 ? 'person' : 'people'} here`}>
            {peers.slice(0, 5).map((p) => (
              <span key={p.clientId} title={p.name} style={{ backgroundColor: p.color }} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white dark:border-zinc-900">{p.name[0]?.toUpperCase()}</span>
            ))}
            {peers.length > 5 && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-xs">+{peers.length - 5}</span>}
          </div>

          <Button variant="ghost" small onClick={() => openPanel('comments')} aria-pressed={panel === 'comments'}><MessageSquare className="h-4 w-4" />Comments</Button>
          <Button variant="ghost" small onClick={() => openPanel('history')} aria-pressed={panel === 'history'}><History className="h-4 w-4" />History</Button>
          <div className="relative">
            <Button variant="ghost" small onClick={() => setMenu(menu === 'export' ? null : 'export')} aria-haspopup="menu" aria-expanded={menu === 'export'}><Download className="h-4 w-4" />Export</Button>
            {menu === 'export' && (
              <div role="menu" className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {([['Markdown (.md)', () => downloadExport(d.id, 'md', d.title)], ['HTML (.html)', () => downloadExport(d.id, 'html', d.title)]] as const).map(([label, run]) => (
                  <button key={label} role="menuitem" onClick={() => { setMenu(null); run().catch((e) => toast.show(errorMessage(e), true)) }} className="w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700">{label}</button>
                ))}
                <button role="menuitem" onClick={() => { setMenu(null); setTimeout(() => window.print(), 50) }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"><Printer className="h-4 w-4" />Print / save as PDF</button>
              </div>
            )}
          </div>
          <Button small onClick={() => setSharing(true)}><Share2 className="h-4 w-4" />Share</Button>
        </header>

        {d.deleted && (
          <div role="alert" className="flex items-center gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            This page is in the trash.
            <Button small variant="outline" onClick={() => restoreFromTrash.mutate()}>Restore</Button>
            <Button small variant="ghost" onClick={() => navigate(`/w/${workspaceId}/trash`)}>Open trash</Button>
          </div>
        )}
        {d.role === 'VIEWER' && <p className="no-print bg-zinc-100 px-4 py-1.5 text-center text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">You have read-only access to this workspace. You can still comment.</p>}

        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="relative mb-2">
            <button onClick={() => canEdit && setMenu(menu === 'icon' ? null : 'icon')} aria-label="Change icon" disabled={!canEdit} className="text-5xl leading-none disabled:cursor-default">{d.icon ?? '📄'}</button>
            {menu === 'icon' && (
              <div className="absolute z-30 mt-2 grid grid-cols-8 gap-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {EMOJIS.map((e) => <button key={e} onClick={() => { setMenu(null); rename.mutate({ icon: e }) }} className="rounded p-1 text-xl hover:bg-zinc-100 dark:hover:bg-zinc-700">{e}</button>)}
                <button onClick={() => { setMenu(null); rename.mutate({ icon: null }) }} className="col-span-8 rounded p-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">Remove icon</button>
              </div>
            )}
          </div>
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            readOnly={!canEdit}
            maxLength={200}
            placeholder="Untitled"
            aria-label="Page title"
            className="w-full bg-transparent text-4xl font-bold outline-none placeholder:text-zinc-300"
          />

          <div className="mt-4">
            {user && !d.deleted && (
              <CollabEditor
                documentId={d.id}
                user={user}
                readOnly={!canEdit}
                onStatus={setStatus}
                onPeers={setPeers}
                onComment={(q) => { setQuote(q); setPanel('comments') }}
                onEditor={setEditor}
              />
            )}
            {d.deleted && <p className="text-sm text-zinc-500">Restore this page to edit it.</p>}
          </div>
        </div>
      </div>

      {panel === 'comments' && user && <CommentsPanel docId={d.id} meId={user.id} role={d.role} quote={quote} clearQuote={() => setQuote('')} onClose={() => setPanel(null)} />}
      {panel === 'history' && <HistoryPanel docId={d.id} canEdit={canEdit} onClose={() => setPanel(null)} onRestored={() => undefined} />}
      {sharing && <ShareModal doc={d} canEdit={canEdit} onClose={() => setSharing(false)} />}
    </div>
  )
}
