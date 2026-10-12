import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Role, type Workspace } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, ErrorBox, Input, Spinner, errorMessage, useToast } from '../components/ui'

const ROLES: Role[] = ['OWNER', 'EDITOR', 'VIEWER']

function WorkspaceSection({ workspace }: { workspace: Workspace }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(workspace.name)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('EDITOR')
  const isOwner = workspace.role === 'OWNER'
  const detail = useQuery({ queryKey: ['workspace', workspace.id], queryFn: () => api.workspace(workspace.id) })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['workspace', workspace.id] }); qc.invalidateQueries({ queryKey: ['workspaces'] }) }
  const onError = (e: unknown) => toast.show(errorMessage(e), true)

  const rename = useMutation({ mutationFn: () => api.renameWorkspace(workspace.id, name.trim()), onSuccess: () => { refresh(); toast.show('Workspace renamed') }, onError })
  const add = useMutation({ mutationFn: () => api.addMember(workspace.id, email.trim(), role), onSuccess: () => { setEmail(''); refresh(); toast.show('Member added') }, onError })
  const setRoleFor = useMutation({ mutationFn: (v: { id: string; role: Role }) => api.setMemberRole(workspace.id, v.id, v.role), onSuccess: refresh, onError })
  const remove = useMutation({
    mutationFn: (id: string) => api.removeMember(workspace.id, id),
    onSuccess: (_r, id) => { refresh(); if (id === user?.id) navigate('/') },
    onError,
  })
  const destroy = useMutation({ mutationFn: () => api.deleteWorkspace(workspace.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['workspaces'] }); navigate('/') }, onError })

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Workspace</h2>
      {isOwner && (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) rename.mutate() }} className="flex max-w-md gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Workspace name" />
          <Button type="submit" disabled={!name.trim() || name.trim() === workspace.name || rename.isPending}>Rename</Button>
        </form>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Members</h3>
        {detail.isLoading ? <Spinner /> : detail.isError ? <ErrorBox error={detail.error} retry={() => detail.refetch()} /> : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
            {detail.data!.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}{m.id === user?.id && ' (you)'}</p>
                  <p className="truncate text-xs text-zinc-500">{m.email}</p>
                </div>
                {isOwner ? (
                  <select value={m.role} onChange={(e) => setRoleFor.mutate({ id: m.id, role: e.target.value as Role })} aria-label={`Role for ${m.name}`} className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-600 dark:bg-zinc-800">
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                ) : <span className="text-xs text-zinc-500">{m.role}</span>}
                {(isOwner || m.id === user?.id) && (
                  <Button small variant="ghost" onClick={() => confirm(m.id === user?.id ? 'Leave this workspace?' : `Remove ${m.name}?`) && remove.mutate(m.id)}>{m.id === user?.id ? 'Leave' : 'Remove'}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isOwner && (
        <form onSubmit={(e) => { e.preventDefault(); add.mutate() }} className="max-w-xl space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Add a member</h3>
          <div className="flex gap-2">
            <Input type="email" required placeholder="Email of an existing Weave user" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Member email" />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="New member role" className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-800">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <Button type="submit" disabled={add.isPending}>Add</Button>
          </div>
          <p className="text-xs text-zinc-500">Owners manage members and settings. Editors change pages. Viewers can read and comment.</p>
        </form>
      )}

      {isOwner && (
        <Button variant="danger" onClick={() => confirm(`Delete “${workspace.name}” and every page in it? This cannot be undone.`) && destroy.mutate()}>Delete workspace</Button>
      )}
    </section>
  )
}

function AccountSection() {
  const { user, setUser, signOut } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [deletePw, setDeletePw] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const onError = (e: unknown) => toast.show(errorMessage(e), true)

  const save = useMutation({ mutationFn: () => api.updateMe(name.trim()), onSuccess: (u) => { setUser(u); toast.show('Profile saved') }, onError })
  const changePw = useMutation({ mutationFn: () => api.changePassword(current, next), onSuccess: () => { toast.show('Password changed. Signing you out…'); setTimeout(signOut, 1200) }, onError })
  const erase = useMutation({ mutationFn: () => api.deleteAccount(deletePw), onSuccess: () => signOut(), onError })

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Account</h2>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="flex max-w-md gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required aria-label="Your name" />
        <Button type="submit" disabled={!name.trim() || name.trim() === user?.name || save.isPending}>Save</Button>
      </form>
      <p className="text-sm text-zinc-500">Signed in as {user?.email}</p>

      <form onSubmit={(e) => { e.preventDefault(); changePw.mutate() }} className="max-w-md space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Change password</h3>
        <Input type="password" autoComplete="current-password" required placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-label="Current password" />
        <Input type="password" autoComplete="new-password" required minLength={8} placeholder="New password (8+ characters, letter and number)" value={next} onChange={(e) => setNext(e.target.value)} aria-label="New password" />
        <Button type="submit" disabled={changePw.isPending}>Change password</Button>
      </form>

      <div className="max-w-md space-y-2 rounded-xl border border-red-200 p-4 dark:border-red-900">
        <h3 className="font-semibold text-red-600">Delete account</h3>
        <p className="text-sm text-zinc-500">Removes your account and any workspace only you belong to.</p>
        {confirmDelete ? (
          <form onSubmit={(e) => { e.preventDefault(); erase.mutate() }} className="space-y-2">
            <Input type="password" required placeholder="Confirm with your password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} aria-label="Password to confirm deletion" />
            <div className="flex gap-2"><Button type="submit" variant="danger">Delete my account</Button><Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button></div>
          </form>
        ) : <Button variant="outline" onClick={() => setConfirmDelete(true)}>Delete account…</Button>}
      </div>
    </section>
  )
}

/** Inside a workspace it shows both sections; at /settings it shows the account only. */
export function SettingsPage({ workspace }: { workspace?: boolean }) {
  const ctx = useOutletContext<{ workspace: Workspace } | null>()
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-10">
      {!workspace && <Link to="/" className="text-sm text-blue-600 hover:underline">← Back to Weave</Link>}
      <h1 className="text-3xl font-bold">Settings</h1>
      {workspace && ctx?.workspace && <WorkspaceSection workspace={ctx.workspace} />}
      <AccountSection />
    </div>
  )
}
