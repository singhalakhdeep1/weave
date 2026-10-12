import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type DocSummary, type Workspace } from '../lib/api'
import { Button, ErrorBox, Spinner, errorMessage, timeAgo, useToast } from '../components/ui'

export function TrashPage() {
  const { workspace } = useOutletContext<{ workspace: Workspace }>()
  const qc = useQueryClient()
  const toast = useToast()
  const trash = useQuery({ queryKey: ['trash', workspace.id], queryFn: () => api.trash(workspace.id) })
  const canEdit = workspace.role !== 'VIEWER'

  const refresh = () => { qc.invalidateQueries({ queryKey: ['trash', workspace.id] }); qc.invalidateQueries({ queryKey: ['documents', workspace.id] }) }
  const onError = (e: unknown) => toast.show(errorMessage(e), true)
  const restore = useMutation({ mutationFn: (d: DocSummary) => api.restoreDocument(d.id), onSuccess: () => { refresh(); toast.show('Page restored') }, onError })
  const erase = useMutation({ mutationFn: (d: DocSummary) => api.deleteForever(d.id), onSuccess: () => { refresh(); toast.show('Deleted permanently') }, onError })

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">Trash</h1>
      <p className="mt-1 text-zinc-500">Deleted pages stay here until you remove them permanently.</p>
      <div className="mt-6">
        {trash.isLoading ? <Spinner /> : trash.isError ? <ErrorBox error={trash.error} retry={() => trash.refetch()} /> : trash.data!.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">The trash is empty.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
            {trash.data!.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden>{d.icon ?? '📄'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.title || 'Untitled'}</p>
                  <p className="text-xs text-zinc-500">Deleted {d.deletedAt ? timeAgo(d.deletedAt) : ''}</p>
                </div>
                {canEdit && (
                  <>
                    <Button small variant="outline" onClick={() => restore.mutate(d)}>Restore</Button>
                    <Button small variant="danger" onClick={() => confirm(`Permanently delete “${d.title}”? This cannot be undone.`) && erase.mutate(d)}>Delete forever</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
