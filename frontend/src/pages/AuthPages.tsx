import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Button, Input, errorMessage } from '../components/ui'

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 text-center">
          <div className="text-3xl" aria-hidden>🧵</div>
          <h1 className="mt-2 text-xl font-semibold">{title}</h1>
          <p className="text-sm text-zinc-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

const Field = ({ id, label, ...p }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <Input id={id} {...p} />
  </div>
)

const safeFrom = (v: unknown) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/')

export function LoginPage() {
  const { user, ready, signIn } = useAuth()
  const navigate = useNavigate()
  const from = safeFrom((useLocation().state as { from?: string } | null)?.from)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (ready && user) navigate(from, { replace: true }) }, [ready, user, from, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await signIn(email, password) } catch (err) { setError(errorMessage(err, 'Sign in failed')); setBusy(false) }
  }

  return (
    <Shell title="Welcome back" subtitle="Sign in to your workspace">
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-md bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <p className="text-center text-sm text-zinc-500">New here? <Link to="/register" className="text-blue-600 hover:underline">Create an account</Link></p>
      </form>
    </Shell>
  )
}

export function RegisterPage() {
  const { user, ready, signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (ready && user && !busy) navigate('/', { replace: true }) }, [ready, user, busy, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const workspaceId = await signUp(form.name, form.email, form.password)
      navigate(`/w/${workspaceId}`, { replace: true })
    } catch (err) { setError(errorMessage(err, 'Could not create your account')); setBusy(false) }
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Shell title="Create your account" subtitle="Start writing together in seconds">
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-md bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <Field id="name" label="Name" autoComplete="name" required maxLength={100} value={form.name} onChange={set('name')} />
        <Field id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <div>
          <Field id="password" label="Password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
          <p className="mt-1 text-xs text-zinc-500">At least 8 characters, with a letter and a number.</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
        <p className="text-center text-sm text-zinc-500">Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link></p>
      </form>
    </Shell>
  )
}
