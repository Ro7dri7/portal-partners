import { Link, useOutletContext } from 'react-router-dom'
import { MaterialIcon } from '../components/MaterialIcon'
import type { PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
}

export function DashboardHome() {
  const { user } = useOutletContext<DashboardContext>()
  const displayName = user.firstName || 'Partner'

  return (
    <div className="mx-auto max-w-container-max space-y-stack-lg">
      <header className="mb-stack-lg">
        <h2 className="mb-2 text-headline-lg font-bold text-primary">¡Hola, {displayName}!</h2>
        <p className="text-body-lg text-on-surface-variant">
          Bienvenido a tu panel de partner. Aquí puedes gestionar tu proceso de certificación.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1 md:col-span-8">
          <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-5">
            <MaterialIcon name="fact_check" className="text-9xl" />
          </div>
          <div>
            <div className="mb-stack-md flex items-center justify-between">
              <h3 className="text-headline-sm font-semibold text-primary">Estado de tu solicitud</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-bg px-3 py-1 text-label-md font-semibold text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                En Revisión
              </span>
            </div>
            <p className="max-w-2xl text-body-md text-on-surface-variant">
              Tu documentación está siendo evaluada por nuestro equipo técnico. Te notificaremos si
              necesitamos información adicional para avanzar con tu certificación ISO.
            </p>
          </div>
          <div className="mt-stack-lg flex flex-wrap gap-4">
            <Link
              to="/dashboard/estado"
              className="rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary/90"
            >
              Ver Detalles
            </Link>
            <button
              type="button"
              className="rounded-lg border border-outline-variant px-4 py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container"
            >
              Contactar Soporte
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1 md:col-span-4">
          <h3 className="mb-stack-md text-headline-sm font-semibold text-primary">
            Progreso del Perfil
          </h3>
          <div className="flex flex-1 flex-col justify-center space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-display-lg font-bold leading-none text-secondary">65%</span>
              <span className="text-label-md font-semibold text-on-surface-variant">Completado</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-variant">
              <div className="h-2.5 rounded-full bg-secondary" style={{ width: '65%' }} />
            </div>
            <p className="mt-2 text-sm text-on-surface-variant">
              Completa tu perfil para agilizar el proceso de revisión de tu solicitud.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-stack-md text-headline-sm font-semibold text-primary">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            to="/dashboard/perfil"
            icon="person"
            title="Completar mi perfil"
            description="Añade información fiscal y de contacto."
          />
          <QuickAction
            to="/dashboard/documentos"
            icon="upload"
            title="Subir documentos"
            description="Adjunta actas constitutivas y manuales."
          />
          <QuickAction
            to="/dashboard/estado"
            icon="search"
            title="Ver estado de solicitud"
            description="Revisa el historial y próximos pasos."
          />
        </div>
      </div>
    </div>
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
      className="group flex cursor-pointer items-start gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1 transition-all hover:border-secondary hover:shadow-level-2"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary-container/20 text-secondary transition-colors group-hover:bg-secondary group-hover:text-on-secondary">
        <MaterialIcon name={icon} />
      </div>
      <div>
        <h4 className="mb-1 text-label-md font-semibold text-primary transition-colors group-hover:text-secondary">
          {title}
        </h4>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
    </Link>
  )
}
