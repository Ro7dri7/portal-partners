const AUTH_KEY = 'intercert_partner_user'
const TOKEN_KEY = 'intercert_partner_token'

export type UserRole = 'afiliado' | 'partner_auditor'
export type AuditorRequestStatus = 'none' | 'pending' | 'approved' | 'rejected'

export type PartnerUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  auditorRequestStatus: AuditorRequestStatus
  documentsUnlocked: boolean
  documentsSubmitted: boolean
  avatarUrl: string | null
  emailVerified: boolean
}

export function saveSession(user: PartnerUser, token: string) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  localStorage.setItem(TOKEN_KEY, token)
}

export function saveUser(user: PartnerUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

export function getUser(): PartnerUser | null {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PartnerUser
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearUser() {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

export function postLoginPath(user: PartnerUser) {
  if (user.role === 'partner_auditor' && !user.documentsSubmitted) {
    return '/dashboard/perfil'
  }
  return '/dashboard'
}
