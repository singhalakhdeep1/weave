import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from './lib/api'
import { useAuth } from './lib/auth'
import { AppLayout } from './pages/AppLayout'
import { DocumentPage } from './pages/DocumentPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { SettingsPage } from './pages/SettingsPage'
import { SharedPage } from './pages/SharedPage'
import { TrashPage } from './pages/TrashPage'
import { WorkspaceHome } from './pages/WorkspaceHome'
import { ErrorBox, Spinner } from './components/ui'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

/** "/" sends signed-in users to their first workspace. */
function Landing() {
  const { user, ready } = useAuth()
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces, enabled: Boolean(user) })
  if (!ready) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (workspaces.isError) return <ErrorBox error={workspaces.error} retry={() => workspaces.refetch()} />
  if (!workspaces.data) return <Spinner />
  const last = (() => { try { return localStorage.getItem('weave_last_workspace') } catch { return null } })()
  const target = workspaces.data.find((w) => w.id === last) ?? workspaces.data[0]
  return target ? <Navigate to={`/w/${target.id}`} replace /> : <ErrorBox error="You are not a member of any workspace." />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/s/:token" element={<SharedPage />} />
      <Route path="/" element={<Landing />} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="/w/:workspaceId" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<WorkspaceHome />} />
        <Route path="d/:documentId" element={<DocumentPage />} />
        <Route path="trash" element={<TrashPage />} />
        <Route path="settings" element={<SettingsPage workspace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
