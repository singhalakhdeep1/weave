import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, History, Link2, Trash2, X } from 'lucide-react'
import { api, type CommentItem, type DocDetail, type Role } from '../lib/api'
import { Button, ErrorBox, Input, Modal, Spinner, cx, errorMessage, timeAgo, useToast } from './ui'

// ---------------------------------------------------------------- comments

export function CommentsPanel({ docId, meId, role, quote, clearQuote, onClose }: { docId: string; meId: string; role: Role; quote: string; clearQuote: () => void; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [text, setText] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const key = ['comments', docId]
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: key, queryFn: () => api.comments(docId) })
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const onError = (e: unknown) => toast.show(errorMessage(e), true)

  const add = useMutation({
    mutationFn: () => api.addComment(docId, { content: text, quote: quote || undefined }),
    onSuccess: () => { setText(''); clearQuote(); refresh() },
    onError,
  })
  const resolved = (data ?? []).filter((c) => c.resolved)
  const open = (data ?? []).filter((c) => !c.resolved)

  return (
    <aside aria-label="Comments" className="no-print flex h-full w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">Comments</h2>
        <button onClick={onClose} aria-label="Close comments" className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate() }} className="space-y-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        {quote && (
          <div className="flex items-start gap-1 rounded bg-yellow-50 p-2 text-xs text-zinc-700 dark:bg-yellow-900/20 dark:text-zinc-200">
            <span className="flex-1 italic">“{quote}”</span>
            <button type="button" onClick={clearQuote} aria-label="Remove quote"><X className="h-3 w-3" /></button>
          </div>
        )}
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={2000} rows={2} aria-label="New comment" className="w-full resize-none rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-600 dark:bg-zinc-800" />
        <Button type="submit" small disabled={!text.trim() || add.isPending}>Comment</Button>
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} retry={() => refetch()} /> : open.length === 0 && resolved.length === 0 ? (
          <p className="text-sm text-zinc-500">No comments yet. Select text and use the comment button, or write one above.</p>
        ) : (
          <>
            {open.map((c) => <Thread key={c.id} c={c} docId={docId} meId={meId} role={role} refresh={refresh} onError={onError} />)}
            {resolved.length > 0 && (
              <button onClick={() => setShowResolved((s) => !s)} className="text-xs text-zinc-500 hover:underline">{showResolved ? 'Hide' : 'Show'} {resolved.length} resolved</button>
            )}
            {showResolved && resolved.map((c) => <Thread key={c.id} c={c} docId={docId} meId={meId} role={role} refresh={refresh} onError={onError} />)}
          </>
        )}
      </div>
    </aside>
  )
}

function Thread({ c, docId, meId, role, refresh, onError }: { c: CommentItem; docId: string; meId: string; role: Role; refresh: () => void; onError: (e: unknown) => void }) {
  const [reply, setReply] = useState('')
  const post = useMutation({ mutationFn: () => api.addComment(docId, { content: reply, parentId: c.id }), onSuccess: () => { setReply(''); refresh() }, onError })
  const resolve = useMutation({ mutationFn: () => api.updateComment(c.id, { resolved: !c.resolved }), onSuccess: refresh, onError })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteComment(id), onSuccess: refresh, onError })
  const canResolve = role !== 'VIEWER' || c.user.id === meId
  const canDelete = (x: CommentItem) => x.user.id === meId || role === 'OWNER'

  const Body = ({ x }: { x: CommentItem }) => (
    <div className="group text-sm">
      <div className="flex items-center gap-1 text-xs text-zinc-500">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{x.user.name}</span>
        <span>{timeAgo(x.createdAt)}</span>
        {canDelete(x) && <button onClick={() => confirm('Delete this comment?') && remove.mutate(x.id)} aria-label="Delete comment" className="ml-auto hidden text-zinc-400 hover:text-red-600 group-hover:block"><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
      <p className="whitespace-pre-wrap">{x.content}</p>
    </div>
  )

  return (
    <div className={cx('space-y-2 rounded-lg border p-3', c.resolved ? 'border-zinc-200 opacity-60 dark:border-zinc-800' : 'border-zinc-300 dark:border-zinc-700')}>
      {c.quote && <p className="border-l-2 border-yellow-400 pl-2 text-xs italic text-zinc-500">“{c.quote}”</p>}
      <Body x={c} />
      {c.replies.map((r) => <div key={r.id} className="ml-3 border-l border-zinc-200 pl-3 dark:border-zinc-700"><Body x={r} /></div>)}
      {!c.resolved && (
        <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) post.mutate() }} className="flex gap-1">
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" maxLength={2000} aria-label="Reply" className="h-8 text-xs" />
        </form>
      )}
      {canResolve && (
        <button onClick={() => resolve.mutate()} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-green-700"><Check className="h-3.5 w-3.5" />{c.resolved ? 'Reopen' : 'Resolve'}</button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- history

export function HistoryPanel({ docId, canEdit, onClose, onRestored }: { docId: string; canEdit: boolean; onClose: () => void; onRestored: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [selected, setSelected] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const key = ['versions', docId]
  const versions = useQuery({ queryKey: key, queryFn: () => api.versions(docId) })
  const preview = useQuery({ queryKey: ['version', docId, selected], queryFn: () => api.previewVersion(docId, selected!), enabled: Boolean(selected) })
  const onError = (e: unknown) => toast.show(errorMessage(e), true)

  const save = useMutation({ mutationFn: () => api.saveVersion(docId, label.trim() || 'Snapshot'), onSuccess: () => { setLabel(''); qc.invalidateQueries({ queryKey: key }); toast.show('Snapshot saved') }, onError })
  const restore = useMutation({
    mutationFn: (id: string) => api.restoreVersion(docId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setSelected(null); toast.show('Version restored'); onRestored() },
    onError,
  })

  return (
    <aside aria-label="Version history" className="no-print flex h-full w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Version history</h2>
        <button onClick={onClose} aria-label="Close history" className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
      </div>

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="flex gap-1 border-b border-zinc-200 p-3 dark:border-zinc-800">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name this snapshot" maxLength={100} aria-label="Snapshot name" className="h-8 text-xs" />
          <Button type="submit" small disabled={save.isPending}>Save</Button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {versions.isLoading ? <Spinner /> : versions.isError ? <ErrorBox error={versions.error} retry={() => versions.refetch()} /> : versions.data!.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">History is saved automatically every 10 minutes while you edit.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {versions.data!.map((v) => (
              <li key={v.id}>
                <button onClick={() => setSelected(v.id === selected ? null : v.id)} className={cx('w-full px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800', selected === v.id && 'bg-zinc-100 dark:bg-zinc-800')}>
                  <span className="block text-sm font-medium">{v.label ?? 'Automatic save'}</span>
                  <span className="block text-xs text-zinc-500">{new Date(v.createdAt).toLocaleString()}</span>
                </button>
                {selected === v.id && (
                  <div className="space-y-2 bg-zinc-50 px-4 pb-3 dark:bg-zinc-950">
                    {preview.isLoading ? <Spinner /> : preview.isError ? <p className="text-xs text-red-600">{errorMessage(preview.error)}</p> : (
                      <div className="doc-html max-h-64 overflow-y-auto rounded border border-zinc-200 bg-white p-3 text-xs text-zinc-900" dangerouslySetInnerHTML={{ __html: preview.data!.html }} />
                    )}
                    {canEdit && <Button small variant="outline" disabled={restore.isPending} onClick={() => confirm('Replace the current content with this version? The current content is saved first.') && restore.mutate(v.id)}>Restore this version</Button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------- share

export function ShareModal({ doc, canEdit, onClose }: { doc: DocDetail; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [token, setToken] = useState<string | null>(doc.shareToken)
  const url = token ? `${location.origin}/s/${token}` : ''

  const enable = useMutation({ mutationFn: () => api.share(doc.id), onSuccess: (r) => { setToken(r.shareToken); qc.invalidateQueries({ queryKey: ['document', doc.id] }) }, onError: (e) => toast.show(errorMessage(e), true) })
  const disable = useMutation({ mutationFn: () => api.unshare(doc.id), onSuccess: () => { setToken(null); qc.invalidateQueries({ queryKey: ['document', doc.id] }) }, onError: (e) => toast.show(errorMessage(e), true) })

  return (
    <Modal title="Share" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-medium">People in this workspace</p>
          <p className="text-zinc-500">Everyone in the workspace can open this page; editors can change it. Manage members under “Workspace &amp; account”.</p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-medium"><Link2 className="h-4 w-4" />Public link (read-only)</p>
          {token ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label="Public link" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => toast.show('Link copied'))}>Copy</Button>
              </div>
              <p className="text-xs text-zinc-500">Anyone with this link can read the page, without signing in.</p>
              {canEdit && <Button variant="danger" small onClick={() => disable.mutate()} disabled={disable.isPending}>Stop sharing</Button>}
            </>
          ) : canEdit ? (
            <Button variant="outline" onClick={() => enable.mutate()} disabled={enable.isPending}>Create public link</Button>
          ) : (
            <p className="text-zinc-500">This page is not shared publicly.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
