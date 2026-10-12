import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Spinner } from '../components/ui'

/** Public, read-only view of a shared page. The HTML is generated and sanitized by the server. */
export function SharedPage() {
  const { token = '' } = useParams()
  const page = useQuery({ queryKey: ['public', token], queryFn: () => api.publicPage(token), retry: false })

  if (page.isLoading) return <Spinner />
  if (page.isError || !page.data) return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-semibold">This page is not available</h1>
      <p className="mt-2 text-sm text-zinc-500">The link may have been turned off or the page was deleted.</p>
    </div>
  )
  const p = page.data
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="no-print mb-8 text-sm text-zinc-500">Shared with Weave · <Link to="/login" className="text-blue-600 hover:underline">Open Weave</Link></p>
      <div className="text-5xl" aria-hidden>{p.icon ?? '📄'}</div>
      <h1 className="mt-2 text-4xl font-bold">{p.title}</h1>
      <p className="mt-1 text-xs text-zinc-500">Updated {new Date(p.updatedAt).toLocaleString()}</p>
      <article className="doc-html mt-8" dangerouslySetInnerHTML={{ __html: p.html }} />
    </div>
  )
}
