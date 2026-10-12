import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Workspace } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Spinner, errorMessage, timeAgo, useToast } from '../components/ui'

export function WorkspaceHome() {
  const { workspace } = useOutletContext<{ workspace: Workspace }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const docs = useQuery({ queryKey: ['documents', workspace.id], queryFn: () => api.documents(workspace.id) })
  const templates = useQuery({ queryKey: ['templates'], queryFn: api.templates })
  const canEdit = workspace.role !== 'VIEWER'

  const create = useMutation({
    mutationFn: (templateId: string) => api.createDocument(workspace.id, { templateId }),
    onSuccess: (doc) => { qc.invalidateQueries({ queryKey: ['documents', workspace.id] }); navigate(`d/${doc.id}`) },
    onError: (e) => toast.show(errorMessage(e), true),
  })

  const recent = [...(docs.data ?? [])].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 8)

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold">Good to see you, {user?.name.split(' ')[0]}</h1>
      <p className="mt-1 text-zinc-500">{workspace.name} · {workspace.members} {workspace.members === 1 ? 'member' : 'members'} · you are {workspace.role.toLowerCase()}</p>

      {canEdit && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Start a new page</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {templates.data?.map((t) => (
              <button key={t.id} onClick={() => create.mutate(t.id)} disabled={create.isPending} className="rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                <span className="text-2xl" aria-hidden>{t.icon}</span>
                <span className="mt-2 block text-sm font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recently edited</h2>
        {docs.isLoading ? <Spinner /> : recent.length === 0 ? (
          <p className="text-sm text-zinc-500">No pages yet. {canEdit ? 'Pick a template above to begin.' : 'Ask an editor to add one.'}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
            {recent.map((d) => (
              <li key={d.id}>
                <Link to={`d/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <span aria-hidden>{d.icon ?? '📄'}</span>
                  <span className="flex-1 truncate font-medium">{d.title || 'Untitled'}</span>
                  <span className="text-xs text-zinc-500">{timeAgo(d.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
