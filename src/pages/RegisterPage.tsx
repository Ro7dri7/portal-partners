import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MaterialIcon } from '../components/MaterialIcon'
import { PasswordRequirements } from '../components/PasswordRequirements'
import { LOGO_URL, REGISTER_HERO_URL, saveUser } from '../constants'
import { getPasswordChecks, isPasswordValid } from '../utils/passwordValidation'

export function RegisterPage() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  const checks = useMemo(() => getPasswordChecks(password), [password])
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Completa todos los campos requeridos.')
      return
    }
    if (!isPasswordValid(password)) {
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

    saveUser({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
    })
    navigate('/dashboard')
  }

  const inputClass =
    'w-full pl-10 pr-4 py-2.5 bg-surface rounded-lg border border-outline-variant text-on-surface text-body-md focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background text-on-surface antialiased">
      {/* Left hero */}
      <div
        className="relative hidden bg-surface-container bg-cover bg-center lg:flex lg:w-1/2"
        style={{ backgroundImage: `url('${REGISTER_HERO_URL}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary-container/40 mix-blend-multiply" />
        <div className="relative z-10 flex h-full flex-col justify-end p-margin-page text-on-primary">
          <div className="mb-12 max-w-lg">
            <MaterialIcon name="verified_user" className="mb-4 text-4xl text-secondary-container" />
            <h2 className="mb-stack-md text-display-lg font-bold tracking-tight">
              Excelencia en Certificación
            </h2>
            <p className="text-body-lg opacity-90">
              Únete a la red de partners de Intercert Latam y gestiona tus procesos de auditoría con
              la máxima eficiencia y seguridad.
            </p>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex w-full flex-col items-center justify-center bg-surface-container-lowest p-6 sm:p-margin-page lg:w-1/2">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="mb-8 flex justify-center lg:justify-start">
            <img
              alt="Intercert Latam Logo"
              className="h-12 w-auto object-contain"
              src={LOGO_URL}
            />
          </div>

          <div className="mb-stack-lg text-center lg:text-left">
            <h1 className="mb-2 text-2xl font-bold text-on-surface md:text-headline-lg">
              Crea tu cuenta de Partner
            </h1>
            <p className="text-body-md text-on-surface-variant">
              Completa los datos a continuación para registrarte en el portal.
            </p>
          </div>

          <form className="space-y-stack-md" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-stack-md sm:grid-cols-2">
              <div className="space-y-2">
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

              <div className="space-y-2">
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
                <label
                  className="cursor-pointer text-body-md text-on-surface-variant"
                  htmlFor="terms"
                >
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

          <div className="mt-8 text-center">
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
        </div>
      </div>
    </div>
  )
}
