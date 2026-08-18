import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MaterialIcon } from '../components/MaterialIcon'
import { getUser, LOGIN_HERO_URL, LOGO_URL, saveUser } from '../constants'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.')
      return
    }

    const existing = getUser()
    if (existing && existing.email === email.trim().toLowerCase()) {
      navigate('/dashboard')
      return
    }

    // Demo login: allow any valid email/password and create a session
    const localPart = email.split('@')[0] || 'Partner'
    const [firstName, ...rest] = localPart.split(/[._-]/)
    saveUser({
      firstName: firstName ? capitalize(firstName) : 'Partner',
      lastName: rest.length ? rest.map(capitalize).join(' ') : '',
      email: email.trim().toLowerCase(),
    })
    navigate('/dashboard')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-on-surface">
      {/* Left brand */}
      <div className="relative hidden h-full w-1/2 flex-col items-center justify-center overflow-hidden bg-surface-container-low md:flex">
        <div className="pointer-events-none absolute inset-0 z-10 bg-primary opacity-5 mix-blend-multiply" />
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-20 grayscale"
          style={{ backgroundImage: `url('${LOGIN_HERO_URL}')` }}
        />
        <div className="z-20 max-w-lg p-12 text-center">
          <h1 className="mb-6 text-display-lg font-bold tracking-tight text-primary">
            Partner Portal
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Acceda a sus herramientas de certificación y gestión con seguridad y confianza.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex h-full w-full flex-col items-center justify-center bg-surface p-6 sm:p-12 md:w-1/2">
        <div className="w-full max-w-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <img alt="Intercert Latam Logo" className="h-16 object-contain" src={LOGO_URL} />
          </div>

          <div className="mb-8 text-center">
            <h2 className="mb-2 text-headline-lg font-bold text-on-surface">Iniciar Sesión</h2>
            <p className="text-body-md text-on-surface-variant">
              Ingrese sus credenciales para continuar
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                className="mb-2 block text-label-md font-semibold text-on-surface-variant"
                htmlFor="email"
              >
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
                  placeholder="usuario@empresa.com"
                  className="block w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-md text-on-surface transition-colors placeholder:text-outline-variant focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  className="block text-label-md font-semibold text-on-surface-variant"
                  htmlFor="password"
                >
                  Contraseña
                </label>
                <a
                  className="text-label-md font-semibold text-secondary transition-colors hover:text-secondary-container"
                  href="#"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
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
                  className="block w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-10 text-body-md text-on-surface transition-colors focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline transition-colors hover:text-on-surface-variant"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <MaterialIcon
                    name={showPassword ? 'visibility' : 'visibility_off'}
                    className="text-[20px]"
                  />
                </button>
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
                className="flex w-full justify-center rounded-lg border border-transparent bg-primary px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Iniciar sesión
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-body-md text-on-surface-variant">
            ¿No tienes cuenta?{' '}
            <Link
              to="/registro"
              className="text-label-md font-semibold text-secondary hover:underline"
            >
              Regístrate
            </Link>
          </p>
        </div>

        <div className="mt-8 flex justify-center space-x-6 text-label-sm font-bold tracking-wide text-on-surface-variant">
          <a className="transition-colors hover:text-primary" href="#">
            Términos de Servicio
          </a>
          <a className="transition-colors hover:text-primary" href="#">
            Política de Privacidad
          </a>
          <a className="transition-colors hover:text-primary" href="#">
            Soporte
          </a>
        </div>
      </div>
    </div>
  )
}

function capitalize(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
