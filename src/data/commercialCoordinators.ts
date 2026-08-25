export type CommercialCoordinator = {
  name: string
  email: string
}

export const COMMERCIAL_COORDINATORS: CommercialCoordinator[] = [
  { name: 'Cinthia Adriazola', email: 'cadriazola@intercert.com.pe' },
  { name: 'Liliana Restrepo', email: 'coordinador.comercial@intercert.co' },
  { name: 'Victor Fernandez', email: 'coordinador.comercial@intercert.mx' },
]

export const COMMERCIAL_COORDINATOR_STORAGE_KEY = 'intercert_selected_coordinator'

export function findCoordinatorByEmail(email: string | null | undefined) {
  const normalized = String(email || '').trim().toLowerCase()
  return COMMERCIAL_COORDINATORS.find((item) => item.email === normalized) || null
}
