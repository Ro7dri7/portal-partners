import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from '../app-router'
import { registerAccount } from '../api'
import { postLoginPath, saveSession, type UserRole } from '../auth'
import { AuthSplitLayout } from '../components/AuthSplitLayout'
import { MaterialIcon } from '../components/MaterialIcon'
import { PasswordRequirements } from '../components/PasswordRequirements'
import { getPasswordChecks, isPasswordValid } from '../utils/passwordValidation'

function readRole(stateRole: unknown): UserRole | null {
  if (stateRole === 'afiliado' || stateRole === 'partner_auditor') return stateRole
  const stored = sessionStorage.getItem('intercert_selected_role')
  if (stored === 'afiliado' || stored === 'partner_auditor') return stored
  return null
}

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const role = readRole((location.state as { role?: unknown } | null)?.role)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const checks = useMemo(() => getPasswordChecks(password), [password])
  const passwordReady = isPasswordValid(password)
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  useEffect(() => {
    if (!role) navigate('/registro', { replace: true })
  }, [role, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!role) {
      navigate('/registro', { replace: true })
      return
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Completa todos los campos requeridos.')
      return
    }
    if (!passwordReady) {
      setError('La contraseña no cumple los requisitos de seguridad.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!terms) {
      setError('Debes aceptar los términos y condiciones.')
      return
    }

    setSubmitting(true)
    try {
      const result = await registerAccount({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        role,
        terms,
      })
      saveSession(result.user, result.token)
      sessionStorage.removeItem('intercert_selected_role')
      navigate(postLoginPath(result.user), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full pl-10 pr-4 py-2 bg-surface rounded-lg border border-outline-variant text-on-surface text-body-md focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

  if (!role) return null

  return (
    <AuthSplitLayout>
      <div className="mb-4 text-center lg:text-left">
        <h1 className="mb-1 text-headline-md font-bold text-on-surface">
          Crea tu cuenta de {role === 'afiliado' ? 'Afiliado' : 'Partner Auditor'}
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Completa los datos a continuación para registrarte en el portal.
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-label-md font-semibold text-on-surface" htmlFor="firstName">
              Nombre
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
                <MaterialIcon name="person" className="text-[20px]" />
              </div>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                placeholder="Ej. Juan"
                className={inputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-label-md font-semibold text-on-surface" htmlFor="lastName">
              Apellidos
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline">
                <MaterialIcon name="badge" className="text-[20px]" />
              </div>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                placeholder="Ej. Pérez García"
                className={inputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
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

        <div className="space-y-1">
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
              autoComplete="new-password"
              placeholder="••••••••"
              className={`${inputClass} pr-10`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
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
          <PasswordRequirements checks={checks} />
        </div>

        <div className="space-y-1">
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
              autoComplete="new-password"
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

        <div className="flex items-start">
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

        <div className="pt-1">
          <button
            type="submit"
            disabled={submitting || !passwordReady || !passwordsMatch || !terms}
            className="flex w-full items-center justify-center rounded-lg bg-primary-container px-4 py-2.5 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </div>
      </form>

      <div className="mt-4 text-center">
        <p className="text-body-md text-on-surface-variant">
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="text-label-md font-semibold text-secondary transition-colors hover:text-on-secondary-container hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  )
}
