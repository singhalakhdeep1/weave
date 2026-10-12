import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import { api } from '../lib/api'
import { ErrorBox, Spinner } from '../components/ui'
import { Sidebar } from '../components/Sidebar'

export function AppLayout() {
  const { workspaceId = '' } = useParams()
  const [open, setOpen] = useState(false)
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces })

  useEffect(() => { try { localStorage.setItem('weave_last_workspace', workspaceId) } catch { /* ignore */ } }, [workspaceId])

  if (workspaces.isLoading) return <Spinner />
  if (workspaces.isError) return <ErrorBox error={workspaces.error} retry={() => workspaces.refetch()} />
  const current = workspaces.data!.find((w) => w.id === workspaceId)
  if (!current) return <ErrorBox error="This workspace does not exist or you are not a member." />

  return (
    <div className="flex h-full">
      <div className={`no-print fixed inset-y-0 left-0 z-40 w-72 transform border-r border-zinc-200 bg-zinc-50 transition-transform dark:border-zinc-800 dark:bg-zinc-950 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar workspace={current} workspaces={workspaces.data!} onNavigate={() => setOpen(false)} />
      </div>
      {open && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <button className="no-print m-2 w-fit rounded p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <main className="min-h-0 flex-1 overflow-y-auto"><Outlet context={{ workspace: current }} /></main>
      </div>
    </div>
  )
}
