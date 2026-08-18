import { useOutletContext } from 'react-router-dom'
import type { PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
}

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-container-max">
      <h2 className="mb-2 text-headline-lg font-bold text-primary">{title}</h2>
      <p className="text-body-lg text-on-surface-variant">{description}</p>
      <div className="mt-stack-lg rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1">
        <p className="text-body-md text-on-surface-variant">
          Esta sección estará disponible en una próxima iteración.
        </p>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const { user } = useOutletContext<DashboardContext>()
  return (
    <div className="mx-auto max-w-container-max">
      <h2 className="mb-2 text-headline-lg font-bold text-primary">Mi Perfil</h2>
      <p className="mb-stack-lg text-body-lg text-on-surface-variant">
        Información básica de tu cuenta de partner.
      </p>
      <div className="max-w-lg space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1">
        <div>
          <p className="text-label-md font-semibold text-on-surface-variant">Nombre</p>
          <p className="text-body-lg text-on-surface">
            {user.firstName} {user.lastName}
          </p>
        </div>
        <div>
          <p className="text-label-md font-semibold text-on-surface-variant">Correo electrónico</p>
          <p className="text-body-lg text-on-surface">{user.email}</p>
        </div>
      </div>
    </div>
  )
}
