import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useOutletContext } from '../app-router'
import {
  fetchProfile,
  postStatusComment,
  type ProfessionalProfile,
  type StatusComment,
} from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import type { PartnerUser } from '../constants'
import {
  getAuditorProgress,
  isPartnerAuditor,
} from '../utils/auditorProgress'

type DashboardContext = {
  user: PartnerUser
}

function formatStamp(value: string) {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ActivityComment({ comment }: { comment: StatusComment }) {
  const labels = comment.referencedDocLabels?.length
    ? comment.referencedDocLabels
    : comment.referencedDocs || []
  const hasDeadline = Boolean(comment.deadlineAt || comment.deadlineLabel)
  const deadlineText = comment.deadlineAt
    ? formatDeadline(comment.deadlineAt)
    : comment.deadlineLabel || ''
  const overdue =
    Boolean(comment.deadlineAt) && new Date(comment.deadlineAt as string).getTime() < Date.now()

  return (
    <div
      className={`rounded-lg border p-3 ${
        comment.authorRole === 'applicant'
          ? 'ml-4 border-secondary/20 bg-secondary-container/10'
          : 'mr-4 border-outline-variant/20 bg-surface'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-md font-bold text-primary">{comment.authorName}</span>
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            {comment.authorRole === 'coordinator' ? 'Coordinador' : 'Solicitante'}
          </span>
        </div>
        <span className="shrink-0 text-label-sm font-bold tracking-wide text-on-surface-variant">
          {formatStamp(comment.createdAt)}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
        {comment.body}
      </p>

      {labels.length > 0 && (
        <div className="mt-3 rounded-md border border-outline-variant/30 bg-surface-container-low/80 p-2.5">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Documentos observados
          </p>
          <ul className="space-y-1">
            {labels.map((label) => (
              <li key={label} className="flex items-start gap-1.5 text-sm text-on-surface">
                <MaterialIcon name="description" className="mt-0.5 text-[16px] text-secondary" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasDeadline && (
        <div
          className={`mt-3 rounded-md border px-3 py-2.5 ${
            overdue
              ? 'border-error/50 bg-error-container/40 text-on-error-container'
              : 'border-[#dc2626]/35 bg-[#fef2f2] text-[#991b1b]'
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            <MaterialIcon name="alarm" className="mt-0.5 text-[18px]" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide">
                {overdue ? 'Plazo vencido' : 'Plazo de corrección'}
                {comment.deadlineDurationLabel ? ` · ${comment.deadlineDurationLabel}` : ''}
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {overdue ? `Venció ${deadlineText}` : `Vence ${deadlineText}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ApplicationStatusPage() {
  const { user } = useOutletContext<DashboardContext>()
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [documents, setDocuments] = useState<Array<{ category: string; file_name: string }>>([])
  const [application, setApplication] = useState<{ publicCode: string; status: string } | null>(
    null,
  )
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
                <MaterialIcon
                  name={progress.submitted ? 'pending' : 'edit'}
                  filled
                  className="text-[16px]"
                />
                <span className="text-label-sm font-bold uppercase tracking-wider">
                  {progress.badge}
                </span>
              </div>
            </div>

            <div className="space-y-8">
              {progress.phaseTracks.map((track) => {
                const lastIdx = track.steps.reduce(
                  (acc, step, index) =>
                    step.state === 'done' || step.state === 'active' || step.state === 'rejected'
                      ? index
                      : acc,
                  0,
                )
                const max = Math.max(track.steps.length - 1, 1)
                const barWidth = Math.min(100, Math.max(0, (lastIdx / max) * 100))
                const observed = track.steps.some((step) => step.state === 'rejected')
                const phaseDocs = track.steps.find((step) => step.docs?.length)?.docs || []
                const showDocs =
                  track.unlocked &&
                  phaseDocs.length > 0 &&
                  track.steps.some((step) => step.state !== 'pending')
                return (
                <div
                  key={track.key}
                  className={track.unlocked ? '' : 'opacity-55'}
                >
                  <div className="mb-4">
                    <h4 className="text-headline-sm font-semibold text-primary">{track.label}</h4>
                    <p className="text-body-md text-on-surface-variant">{track.subtitle}</p>
                    {!track.unlocked && (
                      <p className="mt-1 text-label-md font-semibold text-on-surface-variant">
                        Se habilita al completar la fase 1.
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <div className="relative py-2">
                      <div className="absolute left-6 right-6 top-7 z-0 h-1 overflow-hidden rounded-full bg-surface-variant">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            observed ? 'bg-error' : 'bg-secondary'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="relative z-10 flex w-full items-start justify-between">
                        {track.steps.map((step, index) => (
                          <Step
                            key={step.key}
                            state={
                              step.state === 'rejected'
                                ? 'rejected'
                                : step.state === 'done'
                                  ? 'done'
                                  : step.state === 'active'
                                    ? 'active'
                                    : 'pending'
                            }
                            label={step.label}
                            icon={
                              step.state === 'done'
                                ? 'check'
                                : step.state === 'rejected'
                                  ? 'close'
                                  : step.state === 'active'
                                    ? 'autorenew'
                                    : undefined
                            }
                            number={index + 1}
                            success={step.key === 'validated' && step.state === 'done'}
                          />
                        ))}
                      </div>
                    </div>
                    {showDocs && <PhaseDocOutcomes docs={phaseDocs} observed={observed} />}
                  </div>
                </div>
                )
              })}
            </div>

            {!progress.review1Done && (
              <Link
                to="/dashboard/perfil"
                className="mt-2 inline-flex rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90"
              >
                Continuar validación
              </Link>
            )}
            {progress.review1Done && !progress.review2Done && (
              <Link
                to="/dashboard/perfil"
                className="mt-2 inline-flex rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90"
              >
                Continuar con IC.F.1.2
              </Link>
            )}
          </div>

          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-lg shadow-level-1">
            <h3 className="mb-4 text-headline-sm font-semibold text-primary">Avance del formulario</h3>
            <ul className="space-y-3">
              <ChecklistItem done={progress.review1Docs} label="Documentos de la revisión 1" />
              <ChecklistItem
                done={['sent', 'in_review', 'validated', 'approved'].includes(progress.review1Status)}
                label="Revisión 1 enviada"
              />
              <ChecklistItem done={progress.review1Done} label="Fase 1 aprobada" />
              <ChecklistItem
                done={['sent', 'in_review', 'validated', 'approved'].includes(progress.review2Status)}
                label="Formato IC.F.1.2 enviado"
              />
              <ChecklistItem done={progress.review2Done} label="Fase 2 aprobada" />
            </ul>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-label-md">
                <span className="text-on-surface-variant">Progreso</span>
                <span className="font-semibold text-secondary">{progress.percent}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-variant">
                <div
                  className="h-2.5 rounded-full bg-secondary"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-gutter self-start lg:col-span-4">
          <div className="flex w-full flex-col rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-md shadow-level-1">
            <div className="mb-3 flex items-center gap-2 border-b border-outline-variant/30 pb-3">
              <MaterialIcon name="forum" className="text-secondary" />
              <h3 className="text-headline-sm font-semibold text-primary">Actividad</h3>
            </div>

            <div ref={listRef} className="max-h-[280px] space-y-3 overflow-y-auto">
              {progress.activity.map((item) => (
                <div
                  key={item}
                  className="mr-4 rounded-lg border border-outline-variant/20 bg-surface p-3"
                >
                  <p className="text-label-md font-bold text-primary">Sistema</p>
                  <p className="text-sm text-on-surface-variant">{item}</p>
                </div>
              ))}
              {comments.map((comment) => (
                <ActivityComment key={comment.id} comment={comment} />
              ))}
            </div>

            {error && <p className="mt-2 text-label-md text-error">{error}</p>}

            <form onSubmit={handleSubmit} className="mt-3 space-y-2">
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

function PhaseDocOutcomes({
  docs,
  observed,
}: {
  docs: Array<{ category: string; label: string; status: 'approved' | 'rejected' | 'pending' }>
  observed: boolean
}) {
  const approved = docs.filter((doc) => doc.status === 'approved').length
  const rejected = docs.filter((doc) => doc.status === 'rejected').length
  const pending = docs.filter((doc) => doc.status === 'pending').length
  return (
    <div
      className={`mt-4 rounded-lg border p-3 ${
        observed
          ? 'border-error/30 bg-error-container/20'
          : 'border-outline-variant/30 bg-surface-container-low/60'
      }`}
    >
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
        Documentos de esta fase
        <span className="ml-2 font-semibold normal-case tracking-normal">
          {approved} aprobados · {rejected} observados · {pending} pendientes
        </span>
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {docs.map((doc) => (
          <li key={doc.category} className="flex items-start gap-2 text-sm">
            <MaterialIcon
              name={
                doc.status === 'approved'
                  ? 'check_circle'
                  : doc.status === 'rejected'
                    ? 'cancel'
                    : 'schedule'
              }
              filled={doc.status !== 'pending'}
              className={`mt-0.5 text-[18px] ${
                doc.status === 'approved'
                  ? 'text-success'
                  : doc.status === 'rejected'
                    ? 'text-error'
                    : 'text-on-surface-variant'
              }`}
            />
            <span
              className={
                doc.status === 'rejected'
                  ? 'font-semibold text-error'
                  : doc.status === 'approved'
                    ? 'text-on-surface'
                    : 'text-on-surface-variant'
              }
            >
              {doc.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Step({
  state,
  label,
  sublabel,
  icon,
  number,
  success,
}: {
  state: 'done' | 'active' | 'pending' | 'rejected'
  label: string
  sublabel?: string
  icon?: string
  number?: number
  success?: boolean
}) {
  return (
    <div
      className={`flex w-1/3 flex-col items-center gap-2 ${state === 'pending' ? 'opacity-50' : ''}`}
    >
      {state === 'done' && (
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-lowest text-white shadow-sm ${
            success ? 'bg-success' : 'bg-secondary'
          }`}
        >
          <MaterialIcon name={icon ?? 'check'} filled className="text-[20px]" />
        </div>
      )}
      {state === 'active' && (
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-secondary bg-surface-container-lowest text-secondary shadow-md">
          <span className="absolute -inset-1 animate-pulse rounded-full border border-secondary/30" />
          <MaterialIcon name={icon ?? 'autorenew'} className="text-[20px]" />
        </div>
      )}
      {state === 'rejected' && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-error text-on-error shadow-sm">
          <MaterialIcon name={icon ?? 'close'} filled className="text-[20px]" />
        </div>
      )}
      {state === 'pending' && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-surface-variant text-on-surface-variant">
          <span className="text-label-md font-semibold">{number}</span>
        </div>
      )}
      <span
        className={`text-center text-label-md ${
          state === 'active' || state === 'rejected'
            ? 'font-bold text-primary'
            : 'font-semibold text-on-surface'
        } ${state === 'pending' ? 'text-on-surface-variant' : ''} ${
          state === 'rejected' ? 'text-error' : ''
        }`}
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
