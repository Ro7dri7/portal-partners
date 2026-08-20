import { useMemo, useState, type FormEvent } from 'react'
import { MaterialIcon } from './MaterialIcon'
import { PasswordRequirements } from './PasswordRequirements'
import { getPasswordChecks, isPasswordValid } from '../utils/passwordValidation'

export type PartnerRole = 'afiliado' | 'auditor'

type RegisterFormProps = {
  initialError?: string
  initialRole?: PartnerRole
}

const inputClass =
  'w-full pl-10 pr-4 py-2.5 bg-surface rounded-lg border border-outline-variant text-on-surface text-body-md focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

export default function RegisterForm({
  initialError = '',
  initialRole = 'afiliado',
}: RegisterFormProps) {
  const [step, setStep] = useState<1 | 2>(initialError ? 2 : 1)
  const [role, setRole] = useState<PartnerRole>(initialRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState(initialError)

  const checks = useMemo(() => getPasswordChecks(password), [password])
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    setError('')

    if (!fullName.trim() || !email.trim()) {
      e.preventDefault()
      setError('Completa todos los campos requeridos.')
      return
    }
    if (!isPasswordValid(password)) {
      e.preventDefault()
      setError('La contraseña no cumple los requisitos de seguridad.')
      return
    }
    if (password !== confirmPassword) {
      e.preventDefault()
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!terms) {
      e.preventDefault()
      setError('Debes aceptar los términos y condiciones.')
      return
    }
  }

  if (step === 1) {
    return (
      <>
        <div className="mb-stack-lg text-center lg:text-left">
          <h1 className="mb-2 text-2xl font-bold text-on-surface md:text-headline-lg">
            Selecciona tu rol
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Elige el tipo de cuenta que mejor se adapte a tus necesidades para comenzar.
          </p>
        </div>

        <div className="space-y-stack-md">
          <div className="mb-8 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RoleCard
                selected={role === 'afiliado'}
                title="Afiliado"
                description="Ideal para empresas y organizaciones que buscan gestionar certificaciones."
                onSelect={() => setRole('afiliado')}
              />
              <RoleCard
                selected={role === 'auditor'}
                title="Partner Auditor"
                description="Para profesionales independientes certificados en normas ISO."
                onSelect={() => setRole('auditor')}
              />
            </div>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2"
            >
              Continuar
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mb-stack-lg text-center lg:text-left">
        <button
          type="button"
          onClick={() => {
            setStep(1)
            setError('')
          }}
          className="mb-3 inline-flex items-center gap-1 text-label-md font-semibold text-secondary hover:underline"
        >
          <MaterialIcon name="arrow_back" className="text-[18px]" />
          Cambiar rol
        </button>
        <h1 className="mb-2 text-2xl font-bold text-on-surface md:text-headline-lg">
          Crea tu cuenta de {role === 'auditor' ? 'Partner Auditor' : 'Afiliado'}
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Completa los datos a continuación para registrarte en el portal.
        </p>
      </div>

      <form method="POST" action="/registro" className="space-y-stack-md" onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="role" value={role} />

        <div className="space-y-2">
          <label className="block text-label-md font-semibold text-on-surface" htmlFor="fullName">
            Nombre completo
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
              <MaterialIcon name="person" className="text-[20px]" />
            </div>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              placeholder="Ej. Juan Pérez"
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-label-md font-semibold text-on-surface" htmlFor="email">
            Correo electrónico
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
              <MaterialIcon name="mail" className="text-[20px]" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="tu@empresa.com"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-label-md font-semibold text-on-surface" htmlFor="password">
            Contraseña
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
              <MaterialIcon name="lock" className="text-[20px]" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              className={`${inputClass} pr-10`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline transition-colors hover:text-on-surface"
              onClick={() => setShowPassword((v) => !v)}
            >
              <MaterialIcon
                name={showPassword ? 'visibility_off' : 'visibility'}
                className="text-[20px]"
              />
            </button>
          </div>
          {password.length > 0 && <PasswordRequirements checks={checks} />}
        </div>

        <div className="space-y-2">
          <label
            className="block text-label-md font-semibold text-on-surface"
            htmlFor="confirmPassword"
          >
            Confirmar contraseña
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
              <MaterialIcon name="lock" className="text-[20px]" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              required
              placeholder="••••••••"
              className={`${inputClass} pr-10 ${
                !passwordsMatch ? 'border-error focus:border-error focus:ring-error' : ''
              }`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline transition-colors hover:text-on-surface"
              onClick={() => setShowConfirm((v) => !v)}
            >
              <MaterialIcon
                name={showConfirm ? 'visibility_off' : 'visibility'}
                className="text-[20px]"
              />
            </button>
          </div>
          {!passwordsMatch && (
            <p className="text-[11px] text-error">Las contraseñas no coinciden.</p>
          )}
        </div>

        <div className="flex items-start pt-2">
          <div className="flex h-5 items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-outline-variant bg-surface text-primary-container focus:ring-secondary"
            />
          </div>
          <div className="ml-3">
            <label className="cursor-pointer text-body-md text-on-surface-variant" htmlFor="terms">
              Acepto los{' '}
              <a className="text-secondary hover:underline" href="#">
                términos y condiciones
              </a>
            </label>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
            {error}
          </p>
        )}

        <div className="pt-4">
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2"
          >
            Crear cuenta
          </button>
        </div>
      </form>
    </>
  )
}

function RoleCard({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col rounded-lg p-4 text-left transition-colors ${
        selected
          ? 'border-2 border-secondary bg-surface-container-low hover:bg-surface-container-high'
          : 'border border-outline-variant bg-surface hover:bg-surface-container-low'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`text-label-md font-semibold ${
            selected ? 'text-primary-container' : 'text-on-surface'
          }`}
        >
          {title}
        </span>
        <MaterialIcon
          name={selected ? 'check_circle' : 'circle'}
          className={selected ? 'text-secondary' : 'text-[20px] text-outline'}
        />
      </div>
      <p className="text-[12px] leading-tight text-on-surface-variant">{description}</p>
    </button>
  )
}
