import { useEffect, useState } from 'react'
import { Link, useOutletContext } from '../app-router'
import { fetchProfile, requestAuditorRole } from '../api'
import { AuditorJourneyTimeline } from '../components/AuditorJourneyTimeline'
import { MaterialIcon } from '../components/MaterialIcon'
import { saveUser, type PartnerUser } from '../constants'
import { getAuditorProgress, DEFAULT_JOURNEY } from '../utils/auditorProgress'

type DashboardContext = {
  user: PartnerUser
  setUser: (user: PartnerUser) => void
}

export function DashboardHome() {
  const { user, setUser } = useOutletContext<DashboardContext>()
  const displayName = user.firstName || 'Partner'
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<ReturnType<typeof getAuditorProgress> | null>(null)
  const isAuditor = user.role === 'partner_auditor'

  useEffect(() => {
    if (!isAuditor) return
    fetchProfile()
      .then((data) => {
        setProgress(getAuditorProgress(data.profile, data.documents))
      })
      .catch(() => {
        setProgress(null)
      })
  }, [isAuditor, user.documentsSubmitted])

  async function handleAuditorRequest() {
    setError('')
    setSending(true)
    try {
      const result = await requestAuditorRole()
      saveUser(result.user)
      setUser(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-container-max flex-1 flex-col gap-4">
      <header className="shrink-0">
        <h2 className="text-headline-md font-bold text-primary">¡Hola, {displayName}!</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          {isAuditor
            ? 'Bienvenido a tu panel de Partner Auditor. Completa las dos revisiones para continuar.'
            : 'Bienvenido a tu panel de afiliado. Aquí puedes gestionar tu cuenta y, si lo deseas, solicitar ser Partner Auditor.'}
        </p>
      </header>

      {error && (
        <p className="shrink-0 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
          {error}
        </p>
      )}

      {user.role === 'afiliado' && user.auditorRequestStatus === 'none' && (
        <div className="flex min-h-0 flex-1 flex-col justify-center rounded-xl border border-secondary/30 bg-surface-container-lowest p-5 shadow-level-1">
          <h3 className="mb-1 text-headline-sm font-semibold text-primary">
            ¿Quieres ser Partner Auditor?
          </h3>
          <p className="mb-4 max-w-2xl text-body-md text-on-surface-variant">
            Envía una solicitud para que el equipo de Intercert revise tu perfil. Si se aprueba, tu
            rol cambiará a Partner Auditor y podrás completar el formulario de validación.
          </p>
          <button
            type="button"
            disabled={sending}
            onClick={handleAuditorRequest}
            className="w-fit rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Solicitar ser Partner Auditor'}
          </button>
        </div>
      )}

      {user.role === 'afiliado' && user.auditorRequestStatus === 'pending' && (
        <div className="flex min-h-0 flex-1 flex-col justify-center rounded-xl border border-warning-border bg-warning-bg p-5">
          <h3 className="mb-1 text-headline-sm font-semibold text-primary">Solicitud en revisión</h3>
          <p className="text-body-md text-on-surface-variant">
            Tu solicitud para ser Partner Auditor está siendo revisada. El formulario de validación
            se habilitará solo si es aprobada.
          </p>
        </div>
      )}

      {user.role === 'afiliado' && user.auditorRequestStatus === 'rejected' && (
        <div className="flex min-h-0 flex-1 flex-col justify-center rounded-xl border border-error/30 bg-error-container/30 p-5">
          <h3 className="mb-1 text-headline-sm font-semibold text-on-error-container">
            Solicitud no aprobada
          </h3>
          <p className="mb-4 text-body-md text-on-error-container">
            Por ahora no se habilitó el formulario de validación. Puedes volver a enviar una
            solicitud más adelante.
          </p>
          <button
            type="button"
            disabled={sending}
            onClick={handleAuditorRequest}
            className="w-fit rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Volver a solicitar'}
          </button>
        </div>
      )}

      {isAuditor && (
        <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-level-1 lg:col-span-8">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-label-md font-semibold text-primary">Estado de tu solicitud</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-bg px-2.5 py-0.5 text-label-sm font-semibold text-warning">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  {progress?.badge || 'En progreso'}
                </span>
              </div>
              <p className="mt-0.5 truncate text-body-md text-on-surface-variant">
                {progress?.description ||
                  'Completa la revisión de documentación. Luego se habilitará el formato IC.F.1.2.'}
              </p>
            </div>
            <Link
              to={progress?.bothPhasesSubmitted ? '/dashboard/estado' : '/dashboard/perfil'}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary/90"
            >
              {progress?.bothPhasesSubmitted ? 'Ver estado' : 'Continuar'}
            </Link>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-level-1 lg:col-span-4">
            <span className="text-headline-md font-bold leading-none text-secondary">
              {progress?.percent ?? 0}%
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-label-md font-semibold text-primary">Progreso del perfil</p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-variant">
                <div
                  className="h-2 rounded-full bg-secondary"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {isAuditor && (
          <>
            <AuditorJourneyTimeline steps={progress?.journey || DEFAULT_JOURNEY} />
            <IntroVideo />
          </>
        )}
        <div className="mt-4 shrink-0">
          <h3 className="mb-3 text-headline-sm font-semibold text-primary">Acciones Rápidas</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              to="/dashboard/perfil"
              icon="person"
              title={isAuditor ? 'Completar mi perfil' : 'Ver mi perfil'}
              description={
                isAuditor
                  ? 'Revisión de documentos y formato IC.F.1.2 de registro de auditor.'
                  : 'Consulta los datos de tu cuenta de afiliado.'
              }
            />
            {isAuditor && (
              <>
                <QuickAction
                  to="/dashboard/documentos"
                  icon="folder_open"
                  title="Repositorio de documentos"
                  description="Consulta, descarga y organiza los archivos de tu expediente."
                />
                <QuickAction
                  to="/dashboard/estado"
                  icon="search"
                  title="Ver estado de solicitud"
                  description="Revisa el avance real de tu formulario."
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const INTRO_VIDEO_SRC = '/videos/introduccion-partner.mp4'

function IntroVideo() {
  return (
    <section className="mt-4 shrink-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-[#0A165E] shadow-level-1">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="text-label-md font-semibold text-white">Video de introducción</p>
        <p className="text-sm text-white/70">Introducción al Partner Portal</p>
      </div>
      <video
        className="max-h-[280px] w-full bg-black object-contain"
        controls
        playsInline
        poster="/partners-logo-blanco.png"
      >
        <source src={INTRO_VIDEO_SRC} type="video/mp4" />
      </video>
    </section>
  )
}

function QuickAction({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-level-1 transition-all hover:border-secondary hover:shadow-level-2"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-container/20 text-secondary transition-colors group-hover:bg-secondary group-hover:text-on-secondary">
        <MaterialIcon name={icon} />
      </div>
      <div className="min-w-0">
        <h4 className="text-label-md font-semibold text-primary transition-colors group-hover:text-secondary">
          {title}
        </h4>
        <p className="truncate text-sm text-on-surface-variant">{description}</p>
      </div>
    </Link>
  )
}
