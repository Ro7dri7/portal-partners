import { useState } from 'react'
import { Link, useNavigate } from '../app-router'
import { AuthSplitLayout } from '../components/AuthSplitLayout'
import { MaterialIcon } from '../components/MaterialIcon'
import type { UserRole } from '../auth'

const ROLES: Array<{
  id: UserRole
  title: string
  description: string
}> = [
  {
    id: 'afiliado',
    title: 'Afiliado',
    description: 'Ideal para empresas y organizaciones que buscan gestionar certificaciones.',
  },
  {
    id: 'partner_auditor',
    title: 'Partner Auditor',
    description: 'Para profesionales independientes certificados en normas ISO.',
  },
]

export function RoleSelectPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('afiliado')

  function handleContinue() {
    sessionStorage.setItem('intercert_selected_role', role)
    navigate('/registro/cuenta', { state: { role } })
  }

  return (
    <AuthSplitLayout>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-headline-md font-bold text-on-surface">Selecciona tu rol</h1>
        <p className="text-body-md text-on-surface-variant">
          Elige el tipo de cuenta que mejor se adapte a tus necesidades para comenzar.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ROLES.map((item) => {
          const selected = role === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              className={`relative rounded-xl border-2 p-5 text-left transition-colors ${
                selected
                  ? 'border-primary-container bg-primary-fixed/60'
                  : 'border-outline-variant bg-surface-container-lowest hover:border-outline'
              }`}
            >
              <span className="absolute right-4 top-4">
                {selected ? (
                  <MaterialIcon name="check_circle" filled className="text-[22px] text-success" />
                ) : (
                  <MaterialIcon name="radio_button_unchecked" className="text-[22px] text-outline" />
                )}
              </span>
              <h2 className="mb-2 pr-8 text-headline-sm font-bold text-on-surface">{item.title}</h2>
              <p className="text-body-md text-on-surface-variant">{item.description}</p>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleContinue}
        className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary"
      >
        Continuar
      </button>

      <p className="mt-6 text-center text-body-md text-on-surface-variant">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-label-md font-semibold text-secondary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthSplitLayout>
  )
}
