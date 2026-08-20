import { useEffect, useState, type ReactNode } from 'react'
import { DashboardProvider, Link, NavLink, useLocation, useNavigate } from '../app-router'
import { fetchMe } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import {
  AVATAR_URL,
  clearUser,
  DASHBOARD_LOGO_URL,
  getUser,
  saveSession,
  type PartnerUser,
} from '../constants'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home', end: true },
  { to: '/dashboard/perfil', label: 'Mi Perfil', icon: 'account_circle' },
  { to: '/dashboard/documentos', label: 'Documentos', icon: 'folder_open', auditorOnly: true },
  { to: '/dashboard/estado', label: 'Estado de solicitud', icon: 'assignment_turned_in', auditorOnly: true },
  { to: '/dashboard/capacitacion', label: 'Capacitación', icon: 'play_lesson' },
  { to: '/dashboard/configuracion', label: 'Configuración', icon: 'settings' },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<PartnerUser | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isHome = location.pathname === '/dashboard'

  useEffect(() => {
    let cancelled = false
    const current = getUser()
    if (current) setUser(current)

    fetchMe()
      .then((result) => {
        if (cancelled) return
        saveSession(result.user, result.token)
        setUser(result.user)
      })
      .catch(() => {
        if (cancelled) return
        clearUser()
        void fetch('/api/logout', { method: 'POST' }).finally(() => {
          if (!cancelled) window.location.replace('/login')
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      /* still clear local session */
    }
    clearUser()
    navigate('/login')
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center text-body-md text-on-surface-variant">
        Cargando panel...
      </div>
    )
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.auditorOnly || user.role === 'partner_auditor',
  )

  const pathname = location.pathname
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
      isActive
        ? 'bg-white/12 font-bold text-white'
        : 'text-white/75 hover:bg-white/8 hover:text-white'
    }`

  const sidebar = (
    <>
      <div className="mb-stack-lg flex items-center px-margin-page">
        <img
          alt="Partners Logo"
          className="h-10 w-auto shrink-0 object-contain"
          src={DASHBOARD_LOGO_URL}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        <ul className="space-y-1">
          {visibleNav.map((item) => {
            const isActive = item.end
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(`${item.to}/`)
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  <MaterialIcon
                    name={item.icon}
                    filled={isActive}
                    className={`text-[22px] ${isActive ? 'text-[#6fddfe]' : ''}`}
                  />
                  <span className="text-label-md font-semibold">{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="border-t border-white/15 px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/75 transition-colors hover:bg-white/8 hover:text-white"
        >
          <MaterialIcon name="logout" className="text-[22px]" />
          <span className="text-label-md font-semibold">Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <DashboardProvider user={user} setUser={setUser}>
    <div className="flex h-full overflow-hidden bg-dashboard-surface text-body-md text-on-surface">
      <nav className="fixed left-0 top-0 z-20 hidden h-full w-[260px] flex-col border-r border-transparent bg-[#0A165E] py-stack-lg md:flex">
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
          <nav className="relative z-10 flex h-full w-[260px] flex-col border-r border-transparent bg-[#0A165E] py-stack-lg">
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
            <h2 className="text-headline-sm font-bold text-primary">Partner Portal</h2>
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
              to="/dashboard/configuracion"
              className="h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-outline-variant bg-surface-container-high transition-all hover:ring-2 hover:ring-secondary"
            >
              <img
                alt="Avatar de usuario"
                className="h-full w-full object-cover"
                src={user.avatarUrl || AVATAR_URL}
              />
            </Link>
          </div>
        </header>

        <main
          className={`min-h-0 flex-1 p-4 md:px-margin-page md:py-5 ${
            isHome ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
    </DashboardProvider>
  )
}
