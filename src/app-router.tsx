import {
  createContext,
  useCallback,
  useContext,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { PartnerUser } from './auth'

type DashboardContextValue = {
  user: PartnerUser
  setUser: (user: PartnerUser) => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({
  user,
  setUser,
  children,
}: DashboardContextValue & { children: ReactNode }) {
  return <DashboardContext.Provider value={{ user, setUser }}>{children}</DashboardContext.Provider>
}

export function useOutletContext<T = DashboardContextValue>() {
  const value = useContext(DashboardContext)
  if (!value) {
    throw new Error('Dashboard context is not available.')
  }
  return value as T
}

function getPathname() {
  if (typeof window === 'undefined') return ''
  return window.location.pathname
}

export function useNavigate() {
  return useCallback((to: string, options?: { replace?: boolean; state?: unknown }) => {
    if (typeof window === 'undefined') return
    if (options?.state !== undefined) {
      sessionStorage.setItem('intercert_nav_state', JSON.stringify(options.state))
    }
    if (options?.replace) {
      window.location.replace(to)
      return
    }
    window.location.assign(to)
  }, [])
}

export function useLocation() {
  let state: unknown = null
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('intercert_nav_state')
      if (raw) state = JSON.parse(raw) as unknown
    } catch {
      state = null
    }
  }
  return {
    pathname: getPathname(),
    state,
  }
}

type LinkProps = {
  to: string
  children: ReactNode
  className?: string
  replace?: boolean
}

export function Link({ to, children, className }: LinkProps) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  )
}

type NavLinkProps = {
  to: string
  end?: boolean
  children: ReactNode
  className?: string | ((props: { isActive: boolean }) => string)
  onClick?: () => void
}

export function NavLink({ to, end = false, children, className, onClick }: NavLinkProps) {
  const pathname = getPathname()
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  const resolved = typeof className === 'function' ? className({ isActive }) : className

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.()
    if (event.defaultPrevented) return
  }

  return (
    <a href={to} className={resolved} onClick={handleClick}>
      {children}
    </a>
  )
}
