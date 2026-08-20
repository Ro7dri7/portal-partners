import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useOutletContext } from '../app-router'
import { fetchProfile, postStatusComment, type ProfessionalProfile } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import type { PartnerUser } from '../constants'
import {
  getAuditorProgress,
  isPartnerAuditor,
} from '../utils/auditorProgress'

type DashboardContext = {
  user: PartnerUser
}

type StatusComment = {
  id: string
  authorRole: 'coordinator' | 'applicant'
  authorName: string
  body: string
  createdAt: string
}

function formatStamp(value: string) {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ApplicationStatusPage() {
  const { user } = useOutletContext<DashboardContext>()
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [documents, setDocuments] = useState<Array<{ category: string; file_name: string }>>([])
  const [application, setApplication] = useState<{ publicCode: string; status: string } | null>(null)
  const [comments, setComments] = useState<StatusComment[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPartnerAuditor(user.role)) return
    fetchProfile()
      .then((data) => {
        setProfile(data.profile)
        setDocuments(data.documents)
        setApplication(data.application)
        setComments(data.comments)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el estado.')
      })
  }, [user.role])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [comments.length])

  const progress = useMemo(
    () => (profile ? getAuditorProgress(profile, documents) : null),
    [profile, documents],
  )

  async function addComment() {
    const text = draft.trim()
    if (!text || !application) return
    setError('')
    try {
      const result = await postStatusComment(text)
      setComments((prev) => [...prev, result.comment])
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el comentario.')
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void addComment()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void addComment()
    }
  }

  if (!isPartnerAuditor(user.role)) {
    return (
      <div className="mx-auto max-w-container-max">
        <h2 className="mb-2 text-headline-lg font-bold text-primary">Estado de solicitud</h2>
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1">
          {user.auditorRequestStatus === 'pending' && (
            <>
              <span className="mb-3 inline-flex rounded-full border border-warning-border bg-warning-bg px-3 py-1 text-label-md font-semibold text-warning">
                En revisión
              </span>
              <p className="text-body-md text-on-surface-variant">
                Pediste ser Partner Auditor. Cuando Intercert apruebe esa solicitud, tu rol cambiará
                y podrás completar el formulario de validación. El seguimiento de ese formulario
                aparecerá aquí.
              </p>
            </>
          )}
          {user.auditorRequestStatus === 'rejected' && (
            <p className="text-body-md text-on-error-container">
              Tu solicitud para ser Partner Auditor no fue aprobada. El formulario de validación no
              está disponible para el rol de Afiliado.
            </p>
          )}
          {user.auditorRequestStatus === 'none' && (
            <p className="text-body-md text-on-surface-variant">
              Esta sección muestra el avance del formulario de validación, exclusivo para el rol
              Partner Auditor. Como afiliado puedes solicitar ese rol desde el inicio.
            </p>
          )}
          <Link
            to="/dashboard"
            className="mt-4 inline-block text-label-md font-semibold text-secondary hover:underline"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  if (!profile || !progress) {
    return (
      <div className="mx-auto max-w-container-max text-body-md text-on-surface-variant">
        {error || 'Cargando estado de tu solicitud...'}
      </div>
    )
  }

  const barWidth = `${progress.percent}%`

  return (
    <div className="mx-auto max-w-container-max">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="mb-1 text-headline-lg font-bold tracking-tight text-primary">
            Estado de solicitud
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Seguimiento de tu validación como Partner Auditor.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-label-md font-semibold text-on-surface-variant">
            ID de solicitud:
          </span>
          <span className="rounded-md border border-primary-fixed bg-primary-fixed/30 px-3 py-1 text-label-md font-semibold text-primary">
            {application?.publicCode || 'Aún no enviada'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-lg shadow-level-1">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="mb-2 text-headline-md font-semibold text-primary">Fase actual</h3>
                <p className="text-body-md text-on-surface-variant">{progress.description}</p>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-warning-border bg-warning-bg px-4 py-1.5 text-warning">
                <MaterialIcon name={progress.submitted ? 'pending' : 'edit'} filled className="text-[16px]" />
                <span className="text-label-sm font-bold uppercase tracking-wider">{progress.badge}</span>
              </div>
            </div>

            <div className="relative py-8">
              <div className="absolute left-8 right-8 top-1/2 z-0 h-1 -translate-y-1/2 rounded-full bg-surface-variant" />
              <div
                className="absolute left-8 top-1/2 z-0 h-1 -translate-y-1/2 rounded-full bg-secondary transition-all duration-500"
                style={{ width: barWidth }}
              />
              <div className="relative z-10 flex w-full items-center justify-between">
                {progress.phases.map((phase, index) => (
                  <Step
                    key={phase.key}
                    state={phase.state}
                    label={phase.label}
                    sublabel={phase.detail}
                    icon={phase.state === 'done' ? 'check' : phase.state === 'active' ? 'autorenew' : undefined}
                    number={index + 1}
                  />
                ))}
              </div>
            </div>

            {!progress.review1Done && (
              <Link
                to="/dashboard/perfil"
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90"
              >
                Continuar validación
              </Link>
            )}
            {progress.review1Done && !progress.review2Done && (
              <Link
                to="/dashboard/perfil"
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90"
              >
                Continuar con IC.F.1.2
              </Link>
            )}
          </div>

          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-lg shadow-level-1">
            <h3 className="mb-4 text-headline-sm font-semibold text-primary">Avance del formulario</h3>
            <ul className="space-y-3">
              <ChecklistItem done={progress.review1Docs} label="Documentos de la revisión 1" />
              <ChecklistItem done={progress.review1Status === 'in_review' || progress.review1Done} label="Revisión 1 enviada" />
              <ChecklistItem done={progress.review1Done} label="Revisión 1 aprobada" />
              <ChecklistItem done={progress.review2Done || progress.review2Status === 'in_review'} label="Formato IC.F.1.2 enviado" />
            </ul>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-label-md">
                <span className="text-on-surface-variant">Progreso</span>
                <span className="font-semibold text-secondary">{progress.percent}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-variant">
                <div className="h-2.5 rounded-full bg-secondary" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-gutter lg:col-span-4">
          <div className="flex min-h-[360px] flex-1 flex-col rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-md shadow-level-1">
            <div className="mb-4 flex items-center gap-2 border-b border-outline-variant/30 pb-3">
              <MaterialIcon name="forum" className="text-secondary" />
              <h3 className="text-headline-sm font-semibold text-primary">Actividad</h3>
            </div>

            <div ref={listRef} className="mb-4 max-h-[280px] flex-1 space-y-4 overflow-y-auto">
              {progress.activity.map((item) => (
                <div key={item} className="mr-4 rounded-lg border border-outline-variant/20 bg-surface p-3">
                  <p className="text-label-md font-bold text-primary">Sistema</p>
                  <p className="text-sm text-on-surface-variant">{item}</p>
                </div>
              ))}
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-lg border p-3 ${
                    comment.authorRole === 'applicant'
                      ? 'ml-4 border-secondary/20 bg-secondary-container/10'
                      : 'mr-4 border-outline-variant/20 bg-surface'
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-label-md font-bold text-primary">{comment.authorName}</span>
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                        {comment.authorRole === 'coordinator' ? 'Coordinador' : 'Solicitante'}
                      </span>
                    </div>
                    <span className="shrink-0 text-label-sm font-bold tracking-wide text-on-surface-variant">
                      {formatStamp(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{comment.body}</p>
                </div>
              ))}
            </div>

            {error && (
              <p className="mb-2 text-label-md text-error">{error}</p>
            )}

            <form onSubmit={handleSubmit} className="mt-auto space-y-2">
              <div className="relative">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!application}
                  placeholder={
                    application
                      ? 'Escribe un comentario o pregunta...'
                      : 'Envía el formulario para chatear con el coordinador'
                  }
                  className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-3 pr-10 text-sm text-on-surface transition-all focus:border-secondary focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || !application}
                  className="absolute bottom-3 right-2 text-secondary transition-colors hover:text-primary disabled:opacity-40"
                  aria-label="Enviar comentario"
                >
                  <MaterialIcon name="send" className="text-[20px]" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-body-md">
      <MaterialIcon
        name={done ? 'check_circle' : 'radio_button_unchecked'}
        filled={done}
        className={done ? 'text-success' : 'text-outline'}
      />
      <span className={done ? 'text-on-surface' : 'text-on-surface-variant'}>{label}</span>
    </li>
  )
}

function Step({
  state,
  label,
  sublabel,
  icon,
  number,
}: {
  state: 'done' | 'active' | 'pending'
  label: string
  sublabel?: string
  icon?: string
  number?: number
}) {
  return (
    <div className={`flex w-1/4 flex-col items-center gap-2 ${state === 'pending' ? 'opacity-50' : ''}`}>
      {state === 'done' && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-secondary text-on-secondary shadow-sm">
          <MaterialIcon name={icon ?? 'check'} filled className="text-[20px]" />
        </div>
      )}
      {state === 'active' && (
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-secondary bg-surface-container-lowest text-secondary shadow-md">
          <span className="absolute -inset-1 animate-pulse rounded-full border border-secondary/30" />
          <MaterialIcon name={icon ?? 'autorenew'} className="text-[20px]" />
        </div>
      )}
      {state === 'pending' && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-surface-variant text-on-surface-variant">
          <span className="text-label-md font-semibold">{number}</span>
        </div>
      )}
      <span
        className={`text-center text-label-md ${
          state === 'active' ? 'font-bold text-primary' : 'font-semibold text-on-surface'
        } ${state === 'pending' ? 'text-on-surface-variant' : ''}`}
      >
        {label}
      </span>
      {sublabel && (
        <span
          className={`text-center text-label-sm font-bold tracking-wide ${
            state === 'active' ? 'text-secondary' : 'text-on-surface-variant'
          }`}
        >
          {sublabel}
        </span>
      )}
    </div>
  )
}
