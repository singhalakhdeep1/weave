/** Typed API client with automatic, de-duplicated access-token refresh. */

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) || '/api'

export const collabUrl = (): string => {
  const configured = import.meta.env.VITE_COLLAB_URL as string | undefined
  if (configured) return configured
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/collab`
}

export type Role = 'OWNER' | 'EDITOR' | 'VIEWER'
export interface User { id: string; email: string; name: string }
export interface Workspace { id: string; name: string; role: Role; members: number }
export interface Member { id: string; name: string; email: string; role: Role }
export interface DocSummary { id: string; title: string; icon: string | null; parentId: string | null; position: number; updatedAt: string; deletedAt?: string | null }
export interface DocDetail {
  id: string; workspaceId: string; title: string; icon: string | null; parentId: string | null
  deleted: boolean; shareToken: string | null; role: Role; updatedAt: string
  trail: { id: string; title: string; icon: string | null }[]
}
export interface SearchHit extends DocSummary { snippet: string }
export interface Version { id: string; label: string | null; createdAt: string }
export interface CommentItem {
  id: string; content: string; quote: string | null; resolved: boolean; createdAt: string
  user: { id: string; name: string }; replies: CommentItem[]
}
export interface Template { id: string; name: string; icon: string }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null
let onSessionLost: (() => void) | null = null

export const setAccessToken = (t: string | null) => { accessToken = t }
export const getAccessToken = () => accessToken
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn }

/** The refresh token rotates on every use, so concurrent callers must share one request. */
export function refreshSession(): Promise<string | null> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null
      const data = (await res.json()) as { accessToken: string }
      accessToken = data.accessToken
      return data.accessToken
    })
    .catch(() => null)
    .finally(() => { refreshing = null })
  return refreshing
}

/** A token with at least 30 seconds left (used when (re)connecting the realtime socket). */
export async function getFreshToken(): Promise<string> {
  const exp = (() => {
    try { return JSON.parse(atob((accessToken ?? '').split('.')[1])).exp * 1000 as number } catch { return 0 }
  })()
  if (!accessToken || exp - Date.now() < 30_000) await refreshSession()
  return accessToken ?? ''
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/register') && !path.startsWith('/auth/refresh') && !path.startsWith('/public')) {
    if (await refreshSession()) return request<T>(method, path, body, false)
    onSessionLost?.()
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Something went wrong')
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const get = <T>(p: string) => request<T>('GET', p)
const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {})
const patch = <T>(p: string, b: unknown) => request<T>('PATCH', p, b)
const put = <T>(p: string, b: unknown) => request<T>('PUT', p, b)
const del = <T>(p: string, b?: unknown) => request<T>('DELETE', p, b)

/** Downloads an export as a file (needs the auth header, so a plain link will not work). */
export async function downloadExport(docId: string, format: 'md' | 'html', fallbackName: string) {
  const res = await fetch(`${API_URL}/documents/${docId}/export?format=${format}`, { credentials: 'include', headers: { Authorization: `Bearer ${accessToken ?? ''}` } })
  if (!res.ok) throw new ApiError(res.status, 'Export failed')
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${fallbackName}.${format}`
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export const api = {
  register: (b: { name: string; email: string; password: string }) => post<{ user: User; workspaceId: string; accessToken: string }>('/auth/register', b),
  login: (b: { email: string; password: string }) => post<{ user: User; accessToken: string }>('/auth/login', b),
  logout: () => post('/auth/logout'),
  me: () => get<User>('/auth/me'),
  updateMe: (name: string) => put<User>('/auth/me', { name }),
  changePassword: (currentPassword: string, newPassword: string) => post('/auth/change-password', { currentPassword, newPassword }),
  deleteAccount: (password: string) => del('/auth/me', { password }),

  workspaces: () => get<Workspace[]>('/workspaces'),
  createWorkspace: (name: string) => post<Workspace>('/workspaces', { name }),
  workspace: (id: string) => get<{ id: string; name: string; role: Role; members: Member[] }>(`/workspaces/${id}`),
  renameWorkspace: (id: string, name: string) => patch(`/workspaces/${id}`, { name }),
  deleteWorkspace: (id: string) => del(`/workspaces/${id}`),
  addMember: (id: string, email: string, role: Role) => post<Member>(`/workspaces/${id}/members`, { email, role }),
  setMemberRole: (id: string, userId: string, role: Role) => patch(`/workspaces/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) => del(`/workspaces/${id}/members/${userId}`),

  documents: (wid: string) => get<DocSummary[]>(`/workspaces/${wid}/documents`),
  trash: (wid: string) => get<DocSummary[]>(`/workspaces/${wid}/trash`),
  search: (wid: string, q: string) => get<SearchHit[]>(`/workspaces/${wid}/search?q=${encodeURIComponent(q)}`),
  templates: () => get<Template[]>('/templates'),
  createDocument: (wid: string, b: { title?: string; parentId?: string | null; templateId?: string }) => post<DocSummary>(`/workspaces/${wid}/documents`, b),
  document: (id: string) => get<DocDetail>(`/documents/${id}`),
  updateDocument: (id: string, b: Partial<{ title: string; icon: string | null; parentId: string | null; position: number }>) => patch<DocSummary>(`/documents/${id}`, b),
  trashDocument: (id: string) => del(`/documents/${id}`),
  restoreDocument: (id: string) => post(`/documents/${id}/restore`),
  deleteForever: (id: string) => del(`/documents/${id}/permanent`),

  versions: (id: string) => get<Version[]>(`/documents/${id}/versions`),
  saveVersion: (id: string, label: string) => post<Version>(`/documents/${id}/versions`, { label }),
  previewVersion: (id: string, vid: string) => get<{ html: string }>(`/documents/${id}/versions/${vid}`),
  restoreVersion: (id: string, vid: string) => post(`/documents/${id}/versions/${vid}/restore`),

  share: (id: string) => post<{ shareToken: string }>(`/documents/${id}/share`),
  unshare: (id: string) => del(`/documents/${id}/share`),
  publicPage: (token: string) => get<{ title: string; icon: string | null; html: string; updatedAt: string }>(`/public/${token}`),

  comments: (id: string) => get<CommentItem[]>(`/documents/${id}/comments`),
  addComment: (id: string, b: { content: string; quote?: string; parentId?: string }) => post<CommentItem>(`/documents/${id}/comments`, b),
  updateComment: (id: string, b: { content?: string; resolved?: boolean }) => patch<CommentItem>(`/comments/${id}`, b),
  deleteComment: (id: string) => del(`/comments/${id}`),
}
