import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { ApiError } from '../lib/api'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const errorMessage = (e: unknown, fallback = 'Something went wrong') =>
  e instanceof ApiError ? e.message : e instanceof TypeError ? 'Cannot reach the server. Check your connection.' : fallback

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger'; small?: boolean }

export function Button({ variant = 'primary', small, className, ...p }: BtnProps) {
  const styles = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
    ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
    outline: 'border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant]
  return <button {...p} className={cx('inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50', small ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm', styles, className)} />
}

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx('h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800', className)} />
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="mx-auto max-w-sm p-10 text-center text-sm">
      <p className="text-zinc-600 dark:text-zinc-300">{errorMessage(error, 'Failed to load')}</p>
      {retry && <Button variant="outline" className="mt-3" onClick={retry}>Try again</Button>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('w-full rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- toasts ----------
interface Toast { id: number; text: string; error?: boolean }
const ToastContext = createContext<{ show: (text: string, error?: boolean) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, error }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), error ? 6000 : 3000)
  }, [])
  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[60] flex w-80 max-w-[90vw] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('rounded-lg border bg-white px-3 py-2 text-sm shadow-lg dark:bg-zinc-800', t.error ? 'border-red-400 text-red-700 dark:text-red-300' : 'border-zinc-200 dark:border-zinc-700')}>{t.text}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export const colorFor = (id: string) => {
  const palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
