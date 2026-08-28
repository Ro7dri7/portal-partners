import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useOutletContext } from '../app-router'
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

type ChatKey = 'fase_1' | 'fase_2' | 'fase_3'

const CHATS: Array<{ key: ChatKey; label: string; hint: string }> = [
  { key: 'fase_1', label: 'FASE 1', hint: 'Verificación de documentación' },
  { key: 'fase_2', label: 'FASE 2', hint: 'Formato IC.F.1.2' },
  { key: 'fase_3', label: 'FASE 3', hint: 'Contrato comercial' },
]

function chatReadStorageKey(userId: string, chat: ChatKey) {
  return `portal-chat-read:${userId}:${chat}`
}

function loadChatReads(userId: string): Record<ChatKey, number> {
  const reads: Record<ChatKey, number> = { fase_1: 0, fase_2: 0, fase_3: 0 }
  if (typeof window === 'undefined') return reads
  for (const chat of CHATS) {
    const raw = window.localStorage.getItem(chatReadStorageKey(userId, chat.key))
    const ts = raw ? Date.parse(raw) : 0
    reads[chat.key] = Number.isFinite(ts) ? ts : 0
  }
  return reads
}

function persistChatRead(userId: string, chat: ChatKey, at = Date.now()) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(chatReadStorageKey(userId, chat), new Date(at).toISOString())
}

function classifyCommentChat(comment: StatusComment): ChatKey {
  if (comment.track === 'commercial') return 'fase_3'
  if (comment.track === 'fase_2') return 'fase_2'
  if (comment.track === 'fase_1') return 'fase_1'
  const text = String(comment.body || '').toLowerCase()
  if (
    text.includes('ic.f.1.2') ||
    text.includes('revisión 2') ||
    text.includes('revision 2') ||
    text.includes('fase 2')
  ) {
    return 'fase_2'
  }
  if (text.includes('contrato') || text.includes('comercial')) return 'fase_3'
  return 'fase_1'
}

function classifyActivityChat(item: string): ChatKey {
  const text = item.toLowerCase()
  if (text.includes('contrato') || text.includes('comercial')) return 'fase_3'
  if (text.includes('ic.f.1.2') || text.includes('revisión 2') || text.includes('fase 2')) {
    return 'fase_2'
  }
  return 'fase_1'
}

function commentTrackForChat(chat: ChatKey): 'fase_1' | 'fase_2' | 'commercial' {
  if (chat === 'fase_3') return 'commercial'
  if (chat === 'fase_2') return 'fase_2'
  return 'fase_1'
}

export function ApplicationStatusPage() {
  const { user } = useOutletContext<DashboardContext>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [documents, setDocuments] = useState<Array<{ category: string; file_name: string }>>([])
  const [application, setApplication] = useState<{ publicCode: string; status: string } | null>(
    null,
  )
  const [comments, setComments] = useState<StatusComment[]>([])
  const [commercialComments, setCommercialComments] = useState<StatusComment[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [activeChat, setActiveChat] = useState<ChatKey | null>(null)
  const [chatReads, setChatReads] = useState<Record<ChatKey, number>>(() => loadChatReads(user.id))
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPartnerAuditor(user.role)) return
    fetchProfile()
      .then((data) => {
        setProfile(data.profile)
        setDocuments(data.documents)
        setApplication(data.application)
        setComments(data.comments)
        setCommercialComments(data.commercialComments || [])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el estado.')
      })
  }, [user.role])

  const progress = useMemo(
    () => (profile ? getAuditorProgress(profile, documents) : null),
    [profile, documents],
  )

  const allComments = useMemo(
    () => [...comments, ...commercialComments],
    [comments, commercialComments],
  )

  const chatThreads = useMemo(() => {
    const buckets: Record<ChatKey, Array<{ id: string; sort: number; node: 'system' | 'comment'; text?: string; comment?: StatusComment }>> = {
      fase_1: [],
      fase_2: [],
      fase_3: [],
    }
    for (const item of progress?.activity || []) {
      const chat = classifyActivityChat(item)
      buckets[chat].push({
        id: `sys-${chat}-${item}`,
        sort: 0,
        node: 'system',
        text: item,
      })
    }
    for (const comment of allComments) {
      const chat = classifyCommentChat(comment)
      buckets[chat].push({
        id: comment.id,
        sort: new Date(comment.createdAt).getTime(),
        node: 'comment',
        comment,
      })
    }
    return {
      fase_1: buckets.fase_1.sort((a, b) => a.sort - b.sort),
      fase_2: buckets.fase_2.sort((a, b) => a.sort - b.sort),
      fase_3: buckets.fase_3.sort((a, b) => a.sort - b.sort),
    }
  }, [allComments, progress?.activity])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [activeChat, chatThreads])

  useEffect(() => {
    if (!activeChat) return
    const at = Date.now()
    persistChatRead(user.id, activeChat, at)
    setChatReads((prev) => ({ ...prev, [activeChat]: at }))
  }, [activeChat, activeChat ? chatThreads[activeChat].length : 0, user.id])

  const visibleTracks = progress?.phaseTracks || []
  const activeThread = activeChat ? chatThreads[activeChat] : []
  const activeMeta = CHATS.find((item) => item.key === activeChat)

  async function addComment() {
    const text = draft.trim()
    if (!text || !application || !activeChat) return
    setError('')
    try {
      const result = await postStatusComment(text, commentTrackForChat(activeChat))
      if (activeChat === 'fase_3') {
        setCommercialComments((prev) => [...prev, result.comment])
      } else {
        setComments((prev) => [...prev, result.comment])
      }
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

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }
    navigate('/dashboard')
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
      <button
        type="button"
        onClick={goBack}
        className="mb-3 inline-flex items-center gap-1 text-label-md font-semibold text-secondary hover:underline"
      >
        <MaterialIcon name="arrow_back" className="text-[18px]" />
        Volver
      </button>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="mb-1 text-headline-lg font-bold tracking-tight text-primary">
            Estado de solicitud
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Seguimiento de tu validación y contrato comercial.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
              {visibleTracks.map((track) => {
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
                  !track.complete &&
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
                        {track.key === 'commercial'
                          ? 'Se habilita cuando envías el contrato comercial.'
                          : track.key === 'review2'
                            ? 'Se habilita al completar la fase 1.'
                            : ''}
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
                            key={`${track.key}-${step.label}-${index}`}
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
            {progress.review2Done && !progress.commercialSubmitted && (
              <Link
                to="/dashboard/perfil?etapa=documents"
                className="mt-2 inline-flex rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90"
              >
                Continuar con el contrato comercial
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col self-start lg:col-span-4">
          <div className="flex h-[560px] w-full flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-level-1">
            {!activeChat ? (
              <>
                <div className="bg-[#0A165E] px-4 py-3 text-white">
                  <p className="text-label-md font-bold">Mensajes</p>
                  <p className="text-[11px] text-white/70">Elige una fase para ver el chat</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-[#f0f2f5]">
                  {CHATS.map((chat) => {
                    const thread = chatThreads[chat.key]
                    const last = thread[thread.length - 1]
                    const preview =
                      last?.node === 'comment'
                        ? last.comment?.body || ''
                        : last?.text || 'Sin mensajes'
                    const unread = thread.filter((item) => {
                      if (item.node !== 'comment' || !item.comment) return false
                      if (item.comment.authorRole === 'applicant') return false
                      return new Date(item.comment.createdAt).getTime() > (chatReads[chat.key] || 0)
                    }).length
                    return (
                      <button
                        key={chat.key}
                        type="button"
                        onClick={() => setActiveChat(chat.key)}
                        className="flex w-full items-start justify-between gap-3 border-b border-outline-variant/20 px-4 py-3 text-left hover:bg-white"
                      >
                        <span className="min-w-0">
                          <span className="block text-[12px] font-black tracking-wide text-[#0A165E]">
                            {chat.label}
                          </span>
                          <span className="block truncate text-[11px] text-on-surface-variant">
                            {chat.hint}
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-[#667781]">
                            {preview}
                          </span>
                        </span>
                        {unread > 0 ? (
                          <span className="mt-1 inline-flex min-w-[22px] shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 py-0.5 text-[11px] font-bold text-white">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col bg-[#ece5dd]">
                <div className="flex items-center gap-2 border-b border-black/5 bg-[#0A165E] px-2 py-2 text-white">
                  <button
                    type="button"
                    onClick={() => setActiveChat(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
                    aria-label="Volver a la lista de chats"
                  >
                    <MaterialIcon name="arrow_back" className="text-[22px]" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-label-md font-bold">{activeMeta?.label}</p>
                    <p className="text-[11px] text-white/70">{activeMeta?.hint}</p>
                  </div>
                </div>
                <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {activeThread.length === 0 ? (
                    <p className="rounded-lg bg-white/80 px-3 py-2 text-center text-sm text-on-surface-variant">
                      Aún no hay mensajes en esta fase.
                    </p>
                  ) : (
                    activeThread.map((item) =>
                      item.node === 'system' ? (
                        <div
                          key={item.id}
                          className="mx-auto max-w-[90%] rounded-md bg-[#fff5c4] px-3 py-1.5 text-center text-[12px] text-[#5a4b12]"
                        >
                          {item.text}
                        </div>
                      ) : item.comment ? (
                        <ActivityComment key={item.id} comment={item.comment} />
                      ) : null,
                    )
                  )}
                </div>
                {error && <p className="px-3 text-label-md text-error">{error}</p>}
                <form onSubmit={handleSubmit} className="bg-[#f0f2f5] p-2">
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={!application}
                      placeholder={
                        application
                          ? `Escribe un mensaje en ${activeMeta?.label}…`
                          : 'Envía el formulario para chatear con el coordinador'
                      }
                      className="w-full resize-none rounded-2xl border-0 bg-white py-2 pl-3 pr-10 text-sm text-on-surface shadow-sm focus:outline-none disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || !application}
                      className="absolute bottom-3 right-2 text-[#0A165E] transition-colors hover:text-secondary disabled:opacity-40"
                      aria-label="Enviar comentario"
                    >
                      <MaterialIcon name="send" className="text-[20px]" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PhaseDocOutcomes({
  docs,
  observed,
}: {
  docs: Array<{
    category: string
    label: string
    status: 'approved' | 'rejected' | 'pending'
    href?: string
  }>
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
            {doc.href ? (
              <Link
                to={doc.href}
                className={`underline-offset-2 hover:underline ${
                  doc.status === 'rejected'
                    ? 'font-semibold text-error'
                    : doc.status === 'approved'
                      ? 'text-on-surface'
                      : 'text-on-surface-variant'
                }`}
              >
                {doc.label}
              </Link>
            ) : (
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
            )}
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
      className={`flex min-w-0 flex-1 flex-col items-center gap-2 ${state === 'pending' ? 'opacity-50' : ''}`}
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
