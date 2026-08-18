import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MaterialIcon } from '../components/MaterialIcon'
import type { PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
}

type CommentAuthor = 'coordinator' | 'applicant'

type Comment = {
  id: string
  author: CommentAuthor
  name: string
  text: string
  timestamp: string
}

const COMMENTS_KEY = 'intercert_application_comments'
const APPLICATION_ID = 'REQ-2023-894'

const INITIAL_COMMENTS: Comment[] = [
  {
    id: '1',
    author: 'coordinator',
    name: 'Ana Silva',
    text: 'Aplicación inicial registrada correctamente en el sistema.',
    timestamp: '12 oct, 14:15',
  },
  {
    id: '2',
    author: 'coordinator',
    name: 'Ana Silva',
    text: 'Documentación técnica recibida. Iniciando revisión de los anexos B y C. Te notificaré si falta algún soporte.',
    timestamp: 'Hoy, 10:30',
  },
]

function loadComments(): Comment[] {
  const raw = localStorage.getItem(COMMENTS_KEY)
  if (!raw) return INITIAL_COMMENTS
  try {
    return JSON.parse(raw) as Comment[]
  } catch {
    return INITIAL_COMMENTS
  }
}

function saveComments(comments: Comment[]) {
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments))
}

function formatNow() {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

export function ApplicationStatusPage() {
  const { user } = useOutletContext<DashboardContext>()
  const [comments, setComments] = useState<Comment[]>(() => loadComments())
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveComments(comments)
  }, [comments])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [comments.length])

  function addComment(author: CommentAuthor) {
    const text = draft.trim()
    if (!text) return

    const name =
      author === 'coordinator'
        ? 'Ana Silva'
        : `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim() || 'Partner'

    const next: Comment = {
      id: `${Date.now()}`,
      author,
      name,
      text,
      timestamp: formatNow(),
    }
    setComments((prev) => [...prev, next])
    setDraft('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    addComment('applicant')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addComment('applicant')
    }
  }

  return (
    <div className="mx-auto max-w-container-max">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="mb-1 text-headline-lg font-bold tracking-tight text-primary">
            Estado de solicitud
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Sigue el progreso de tu solicitud de certificación ISO.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-label-md font-semibold text-on-surface-variant">
            ID de solicitud:
          </span>
          <span className="rounded-md border border-primary-fixed bg-primary-fixed/30 px-3 py-1 text-label-md font-semibold text-primary">
            {APPLICATION_ID}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-lg shadow-level-1 lg:col-span-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h3 className="mb-2 text-headline-md font-semibold text-primary">Fase actual</h3>
              <p className="text-body-md text-on-surface-variant">
                Tu solicitud está siendo revisada por nuestro equipo técnico.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#FFEEBA] bg-[#FFF3CD] px-4 py-1.5 text-[#856404]">
              <MaterialIcon name="pending" filled className="text-[16px]" />
              <span className="text-label-sm font-bold uppercase tracking-wider">En Revisión</span>
            </div>
          </div>

          <div className="relative py-8">
            <div className="absolute left-8 right-8 top-1/2 z-0 h-1 -translate-y-1/2 rounded-full bg-surface-variant" />
            <div className="absolute left-8 top-1/2 z-0 h-1 w-1/3 -translate-y-1/2 rounded-full bg-secondary transition-all duration-500" />

            <div className="relative z-10 flex w-full items-center justify-between">
              <Step
                state="done"
                label="Enviado"
                sublabel="12 oct 2023"
                icon="check"
              />
              <Step
                state="active"
                label="En revisión"
                sublabel="Fase actual"
                icon="autorenew"
              />
              <Step state="pending" label="Validación" number={3} />
              <Step state="pending" label="Respuesta final" number={4} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-gutter lg:col-span-4">
          <div className="flex min-h-[360px] flex-1 flex-col rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-md shadow-level-1">
            <div className="mb-4 flex items-center gap-2 border-b border-outline-variant/30 pb-3">
              <MaterialIcon name="forum" className="text-secondary" />
              <h3 className="text-headline-sm font-semibold text-primary">Comentarios</h3>
            </div>

            <div ref={listRef} className="mb-4 max-h-[280px] flex-1 space-y-4 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-lg border p-3 ${
                    comment.author === 'applicant'
                      ? 'ml-4 border-secondary/20 bg-secondary-container/10'
                      : 'mr-4 border-outline-variant/20 bg-surface'
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-label-md font-bold text-primary">{comment.name}</span>
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                        {comment.author === 'coordinator' ? 'Coordinador' : 'Solicitante'}
                      </span>
                    </div>
                    <span className="shrink-0 text-label-sm font-bold tracking-wide text-on-surface-variant">
                      {comment.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{comment.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-auto space-y-2">
              <div className="relative">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un comentario o pregunta..."
                  className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-3 pr-10 text-sm text-on-surface transition-all focus:border-secondary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="absolute bottom-3 right-2 text-secondary transition-colors hover:text-primary disabled:opacity-40"
                  aria-label="Enviar comentario"
                >
                  <MaterialIcon name="send" className="text-[20px]" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-label-sm font-bold tracking-wide text-on-secondary transition-colors hover:bg-secondary/90 disabled:opacity-40"
                >
                  Enviar como solicitante
                </button>
                <button
                  type="button"
                  disabled={!draft.trim()}
                  onClick={() => addComment('coordinator')}
                  className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-sm font-bold tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
                >
                  Simular respuesta del coordinador
                </button>
              </div>
            </form>
          </div>

          <a
            href="mailto:soporte@intercertlatam.com"
            className="group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl bg-primary p-stack-md text-on-primary shadow-[0px_4px_12px_rgba(10,22,94,0.15)] transition-colors hover:bg-primary-container"
          >
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-secondary/20 blur-xl transition-all group-hover:bg-secondary/30" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest/10 backdrop-blur-sm">
                <MaterialIcon name="support_agent" />
              </div>
              <div>
                <h4 className="text-label-md font-bold text-on-primary">¿Necesitas ayuda?</h4>
                <p className="text-label-sm font-bold tracking-wide text-on-primary/70">
                  Contacta a nuestro equipo de soporte
                </p>
              </div>
            </div>
            <MaterialIcon
              name="chevron_right"
              className="relative z-10 opacity-70 transition-all group-hover:translate-x-1 group-hover:opacity-100"
            />
          </a>
        </div>
      </div>
    </div>
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
    <div
      className={`flex w-1/4 flex-col items-center gap-2 ${
        state === 'pending' ? 'opacity-50' : ''
      }`}
    >
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
