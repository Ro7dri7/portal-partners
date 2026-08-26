import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '../app-router'
import { AuthSplitLayout } from '../components/AuthSplitLayout'
import { MaterialIcon } from '../components/MaterialIcon'
import type { UserRole } from '../auth'
import {
  COMMERCIAL_COORDINATORS,
  COMMERCIAL_COORDINATOR_STORAGE_KEY,
  findCoordinatorByEmail,
} from '../data/commercialCoordinators'
import {
  COUNTRY_SELECT_OPTIONS,
  ORIGIN_COUNTRY_STORAGE_KEY,
  findOriginCountry,
} from '../data/locations'
import { SearchSelect } from '../components/SearchSelect'

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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [role, setRole] = useState<UserRole>('afiliado')
  const [coordinatorEmail, setCoordinatorEmail] = useState('')
  const [country, setCountry] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = findCoordinatorByEmail(coordinatorEmail)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleContinueRole() {
    setError('')
    sessionStorage.setItem('intercert_selected_role', role)
    setStep(2)
  }

  function handleContinueCoordinator() {
    const coordinator = findCoordinatorByEmail(coordinatorEmail)
    if (!coordinator) {
      setError('Selecciona el coordinador comercial que te refirió.')
      return
    }
    sessionStorage.setItem('intercert_selected_role', role)
    sessionStorage.setItem(COMMERCIAL_COORDINATOR_STORAGE_KEY, coordinator.email)
    setError('')
    setStep(3)
  }

  function handleContinueCountry() {
    const selectedCountry = findOriginCountry(country)
    if (!selectedCountry) {
      setError('Selecciona tu país de procedencia.')
      return
    }
    sessionStorage.setItem('intercert_selected_role', role)
    sessionStorage.setItem(ORIGIN_COUNTRY_STORAGE_KEY, selectedCountry.name)
    navigate('/registro/cuenta', {
      state: { role, comercialEmail: coordinatorEmail, country: selectedCountry.name },
    })
  }

  return (
    <AuthSplitLayout>
      <p className="mb-3 text-center text-label-sm font-semibold uppercase tracking-wide text-outline">
        Paso {step} de 3
      </p>

      {step === 1 ? (
        <>
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-headline-md font-bold text-on-surface">Selecciona tu rol</h1>
            <p className="text-body-md text-on-surface-variant">
              Elige el tipo de cuenta que mejor se adapte a tus necesidades para comenzar.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ROLES.map((item) => {
              const isSelected = role === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRole(item.id)}
                  className={`relative rounded-xl border-2 p-5 text-left transition-colors ${
                    isSelected
                      ? 'border-primary-container bg-primary-fixed/60'
                      : 'border-outline-variant bg-surface-container-lowest hover:border-outline'
                  }`}
                >
                  <span className="absolute right-4 top-4">
                    {isSelected ? (
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
            onClick={handleContinueRole}
            className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary"
          >
            Continuar
          </button>
        </>
      ) : step === 2 ? (
        <div className="animate-fade-in">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-headline-md font-bold text-on-surface">
              Elige tu coordinador comercial por el cual fuiste referido
            </h1>
            <p className="text-body-md text-on-surface-variant">
              Selecciona a la persona de Intercert que te invitó a registrarte.
            </p>
          </div>

          <div ref={dropdownRef} className="relative mb-8">
            <label className="mb-2 block text-label-md font-semibold text-on-surface" htmlFor="coordinator">
              Coordinador comercial
            </label>
            <button
              id="coordinator"
              type="button"
              onClick={() => setOpen((value) => !value)}
              className={`flex w-full items-center justify-between rounded-xl border-2 bg-surface-container-lowest px-4 py-3.5 text-left transition-colors ${
                selected
                  ? 'border-primary-container'
                  : 'border-outline-variant hover:border-outline'
              }`}
            >
              <span className={selected ? 'text-body-md font-semibold text-on-surface' : 'text-body-md text-outline'}>
                {selected?.name || 'Selecciona un coordinador'}
              </span>
              <MaterialIcon
                name={open ? 'expand_less' : 'expand_more'}
                className="text-[22px] text-outline"
              />
            </button>
            {open && (
              <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-level-2">
                {COMMERCIAL_COORDINATORS.map((item) => (
                  <li key={item.email}>
                    <button
                      type="button"
                      className={`flex w-full px-4 py-3 text-left text-body-md transition-colors hover:bg-surface-container ${
                        item.email === coordinatorEmail
                          ? 'font-semibold text-secondary'
                          : 'text-on-surface'
                      }`}
                      onClick={() => {
                        setCoordinatorEmail(item.email)
                        setError('')
                        setOpen(false)
                      }}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1)
                setError('')
              }}
              className="flex w-1/3 items-center justify-center rounded-lg border border-outline-variant px-4 py-3 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={handleContinueCoordinator}
              disabled={!selected}
              className="flex flex-1 items-center justify-center rounded-lg bg-primary-container px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-headline-md font-bold text-on-surface">
              ¿Cuál es tu país de procedencia?
            </h1>
            <p className="text-body-md text-on-surface-variant">
              Escríbelo para filtrar el listado y selecciona tu país. Este dato quedará en tu perfil.
            </p>
          </div>

          <div className="mb-8">
            <label className="mb-2 block text-label-md font-semibold text-on-surface" htmlFor="origin-country">
              País de procedencia
            </label>
            <SearchSelect
              id="origin-country"
              value={country}
              options={COUNTRY_SELECT_OPTIONS}
              placeholder="Busca tu país, ej. Perú, Colombia, México..."
              onChange={(value) => {
                setCountry(value)
                setError('')
              }}
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(2)
                setError('')
              }}
              className="flex w-1/3 items-center justify-center rounded-lg border border-outline-variant px-4 py-3 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={handleContinueCountry}
              disabled={!findOriginCountry(country)}
              className="flex flex-1 items-center justify-center rounded-lg bg-primary-container px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-body-md text-on-surface-variant">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-label-md font-semibold text-secondary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthSplitLayout>
  )
}
