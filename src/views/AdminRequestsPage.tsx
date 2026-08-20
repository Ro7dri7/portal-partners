import { useState, type FormEvent } from 'react'
import { Link } from '../app-router'
import {
  fetchAuditorRequests,
  fetchDocumentReviews,
  reviewAuditorRequest,
  reviewDocumentPackage,
} from '../api'

type RequestRow = {
  id: string
  status: string
  created_at: string
  first_name: string
  last_name: string
  email: string
}

type ReviewRow = {
  partner_id: string
  first_name: string
  last_name: string
  email: string
  review1_status: string
  review2_status: string
  review1_submitted_at: string | null
  review2_submitted_at: string | null
}

function statusLabel(value: string) {
  if (value === 'approved') return 'Aprobada'
  if (value === 'in_review') return 'En revisión'
  if (value === 'rejected') return 'Observada'
  if (value === 'locked') return 'Bloqueada'
  return 'Pendiente'
}

export function AdminRequestsPage() {
  const [token, setToken] = useState('')
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  async function load(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    try {
      const [requestData, reviewData] = await Promise.all([
        fetchAuditorRequests(token.trim()),
        fetchDocumentReviews(token.trim()),
      ])
      setRequests(requestData.requests)
      setReviews(reviewData.reviews)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes.')
      setLoaded(false)
    }
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    setError('')
    try {
      await reviewAuditorRequest(token.trim(), id, status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revisar la solicitud.')
    }
  }

  async function reviewDocs(partnerId: string, stage: 1 | 2, status: 'approved' | 'rejected') {
    setError('')
    try {
      await reviewDocumentPackage(token.trim(), partnerId, stage, status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revisar el paquete documental.')
    }
  }

  return (
    <div className="min-h-screen bg-dashboard-surface p-6 text-on-surface">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-headline-lg font-bold text-primary">Revisión de solicitudes</h1>
        <p className="mb-6 text-body-md text-on-surface-variant">
          Aprueba o rechaza las solicitudes de afiliados y las dos revisiones de Partner Auditor.
        </p>

        <form className="mb-6 flex gap-3" onSubmit={load}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token de revisión"
            className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md focus:border-secondary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary"
          >
            Cargar
          </button>
        </form>

        {error && (
          <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
            {error}
          </p>
        )}

        <h2 className="mb-3 text-headline-sm font-semibold text-primary">Solicitudes de rol</h2>
        {loaded && requests.length === 0 && (
          <p className="mb-6 text-body-md text-on-surface-variant">No hay solicitudes de rol todavía.</p>
        )}

        <div className="mb-10 space-y-3">
          {requests.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-level-1"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-on-surface">
                    {item.first_name} {item.last_name}
                  </p>
                  <p className="text-body-md text-on-surface-variant">{item.email}</p>
                  <p className="mt-1 text-label-sm text-outline">Estado: {item.status}</p>
                </div>
                {item.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => review(item.id, 'approved')}
                      className="rounded-lg bg-success px-3 py-2 text-label-md font-semibold text-on-primary"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => review(item.id, 'rejected')}
                      className="rounded-lg bg-error px-3 py-2 text-label-md font-semibold text-on-error"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-headline-sm font-semibold text-primary">
          Revisiones de documentación
        </h2>
        {loaded && reviews.length === 0 && (
          <p className="text-body-md text-on-surface-variant">
            No hay paquetes de documentación enviados todavía.
          </p>
        )}

        <div className="space-y-3">
          {reviews.map((item) => (
            <div
              key={item.partner_id}
              className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-level-1"
            >
              <p className="font-semibold text-on-surface">
                {item.first_name} {item.last_name}
              </p>
              <p className="text-body-md text-on-surface-variant">{item.email}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="min-w-[220px] flex-1 rounded-lg border border-outline-variant/40 p-3">
                  <p className="text-label-md font-semibold text-on-surface">Revisión 1</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {statusLabel(item.review1_status)}
                  </p>
                  {item.review1_status === 'in_review' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => reviewDocs(item.partner_id, 1, 'approved')}
                        className="rounded-lg bg-success px-3 py-1.5 text-label-sm font-semibold text-on-primary"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewDocs(item.partner_id, 1, 'rejected')}
                        className="rounded-lg bg-error px-3 py-1.5 text-label-sm font-semibold text-on-error"
                      >
                        Observar
                      </button>
                    </div>
                  )}
                </div>
                <div className="min-w-[220px] flex-1 rounded-lg border border-outline-variant/40 p-3">
                  <p className="text-label-md font-semibold text-on-surface">Revisión 2 · IC.F.1.2</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {statusLabel(item.review2_status)}
                  </p>
                  {item.review2_status === 'in_review' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => reviewDocs(item.partner_id, 2, 'approved')}
                        className="rounded-lg bg-success px-3 py-1.5 text-label-sm font-semibold text-on-primary"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewDocs(item.partner_id, 2, 'rejected')}
                        className="rounded-lg bg-error px-3 py-1.5 text-label-sm font-semibold text-on-error"
                      >
                        Observar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-body-md">
          <Link to="/login" className="text-secondary hover:underline">
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
