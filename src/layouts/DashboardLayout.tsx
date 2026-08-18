import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MaterialIcon } from '../components/MaterialIcon'
import { AVATAR_URL, clearUser, DASHBOARD_LOGO_URL, getUser, type PartnerUser } from '../constants'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/dashboard/perfil', label: 'Mi Perfil', icon: 'person' },
  { to: '/dashboard/documentos', label: 'Documentos', icon: 'description' },
  { to: '/dashboard/estado', label: 'Estado de solicitud', icon: 'fact_check' },
  { to: '/dashboard/configuracion', label: 'Configuración', icon: 'settings' },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<PartnerUser | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const current = getUser()
    if (!current) {
      navigate('/login', { replace: true })
      return
    }
    setUser(current)
  }, [navigate])

  function handleLogout() {
    clearUser()
    navigate('/login')
  }

  if (!user) return null

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 transition-all duration-200 border-l-4 ${
      isActive
        ? 'text-secondary font-bold border-secondary bg-secondary-container/10 opacity-90'
        : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:text-secondary opacity-90'
    }`

  const sidebar = (
    <>
      <div className="mb-stack-lg flex items-center gap-3 px-margin-page">
        <img
          alt="Intercert Latam Logo"
          className="h-10 w-auto shrink-0 object-contain"
          src={DASHBOARD_LOGO_URL}
        />
        <div>
          <h1 className="text-headline-sm font-bold text-primary">Intercert Latam</h1>
          <p className="text-label-sm font-bold tracking-wider text-on-surface-variant">
            Affiliate Portal
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                <MaterialIcon name={item.icon} />
                <span className="text-label-md font-semibold">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-outline-variant px-4 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error"
        >
          <MaterialIcon name="logout" />
          <span className="text-label-md font-semibold">Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-full overflow-hidden bg-dashboard-surface text-body-md text-on-surface">
      <nav className="fixed left-0 top-0 z-20 hidden h-full w-[260px] flex-col border-r border-outline-variant bg-surface-container-lowest py-stack-lg md:flex">
        {sidebar}
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-primary/40"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="relative z-10 flex h-full w-[260px] flex-col border-r border-outline-variant bg-surface-container-lowest py-stack-lg">
            {sidebar}
          </nav>
        </div>
      )}

      <div className="relative flex h-full w-full flex-1 flex-col overflow-hidden md:ml-[260px]">
        <header className="z-10 flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-margin-page shadow-sm">
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-secondary"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <MaterialIcon name="menu" />
            </button>
          </div>

          <div className="ml-2 flex flex-1 items-center justify-start md:ml-0">
            <div className="relative hidden w-full max-w-md md:block">
              <MaterialIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full rounded-lg border border-outline-variant bg-surface py-2 pl-10 pr-4 text-body-md outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-secondary"
              aria-label="Notificaciones"
            >
              <MaterialIcon name="notifications" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-secondary"
              aria-label="Ayuda"
            >
              <MaterialIcon name="help" />
            </button>
            <Link
              to="/dashboard/perfil"
              className="h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-outline-variant bg-surface-container-high transition-all hover:ring-2 hover:ring-secondary"
            >
              <img alt="Avatar de usuario" className="h-full w-full object-cover" src={AVATAR_URL} />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-margin-page">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  )
}
