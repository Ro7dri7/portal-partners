import { getToken } from './auth'
import type { PartnerUser } from './auth'

type AuthResponse = {
  user: PartnerUser
  token: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo completar la operación.')
  }
  return data
}

export function registerAccount(payload: {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  role: 'afiliado' | 'partner_auditor'
  terms: boolean
}) {
  return request<AuthResponse>('/api/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function loginAccount(email: string, password: string) {
  return request<AuthResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function fetchMe() {
  return request<AuthResponse>('/api/me')
}

export function requestAuditorRole() {
  return request<{ user: PartnerUser }>('/api/auditor-request', { method: 'POST' })
}

export type StoredDocument = {
  id: string
  category: string
  file_name: string
  file_size: number | null
  status: string
}

export function submitDocuments() {
  return request<{ user: PartnerUser; publicCode: string }>('/api/documents/submit', {
    method: 'POST',
  })
}

export async function uploadDocument(file: File, category: string) {
  const token = getToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const form = new FormData()
  form.append('file', file)
  form.append('category', category)
  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers,
    body: form,
    credentials: 'same-origin',
  })
  const data = (await res.json().catch(() => ({}))) as { document?: StoredDocument; error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo subir el archivo a R2.')
  }
  if (!data.document) {
    throw new Error('No se recibió el documento subido.')
  }
  return data as { document: StoredDocument }
}

export function deleteDocument(id: string) {
  return request<{ ok: boolean }>(`/api/documents/${id}`, { method: 'DELETE' })
}

export type ProfessionalProfile = {
  fullName: string
  documentId: string
  phone: string
  phoneExtension: string
  country: string
  city: string
  countryCity: string
  isLeadAuditor: boolean
  isoStandards: string[]
  yearsExperience: string | number
  certifyingBody: string
  educationTitle: string
  educationInstitution: string
  educationYear: string
  educationSpecialty: string
  leadAuditorCourses: string
  dataTreatmentAccepted: boolean
  currentStep: number
  submitted: boolean
  review1Status: ReviewStatus
  review2Status: Review2Status
}

export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected'
export type Review2Status = 'locked' | ReviewStatus

export type AuditorAudit = {
  id: string
  organization: string
  standard: string
  startDate: string
  endDate: string
  days: number | string
  auditType: string
  role: string
  iafCode: string
}

export function fetchProfile() {
  return request<{
    profile: ProfessionalProfile
    documents: Array<{ id: string; category: string; file_name: string; file_size: number | null }>
    audits: AuditorAudit[]
    application: { id: string; publicCode: string; status: string; createdAt: string } | null
    comments: Array<{
      id: string
      authorRole: 'coordinator' | 'applicant'
      authorName: string
      body: string
      createdAt: string
    }>
  }>('/api/profile')
}

export function postStatusComment(text: string) {
  return request<{
    comment: {
      id: string
      authorRole: 'coordinator' | 'applicant'
      authorName: string
      body: string
      createdAt: string
    }
  }>('/api/status/comments', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function saveProfile(payload: Partial<ProfessionalProfile> & { currentStep?: number }) {
  return request<{ profile: ProfessionalProfile }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function submitProfessionalProfile(payload: {
  dataTreatmentAccepted: boolean
}) {
  return request<{ user: PartnerUser; profile: ProfessionalProfile; publicCode: string }>(
    '/api/profile/submit',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function submitReview1() {
  return request<{ user: PartnerUser; profile: ProfessionalProfile; publicCode: string }>(
    '/api/profile/review1/submit',
    { method: 'POST' },
  )
}

export function submitReview2() {
  return request<{ user: PartnerUser; profile: ProfessionalProfile; publicCode: string }>(
    '/api/profile/review2/submit',
    { method: 'POST' },
  )
}

export function createAudit(payload: Omit<AuditorAudit, 'id'>) {
  return request<{ audit: AuditorAudit }>('/api/audits', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAudit(id: string, payload: Omit<AuditorAudit, 'id'>) {
  return request<{ audit: AuditorAudit }>(`/api/audits/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteAudit(id: string) {
  return request<{ ok: boolean }>(`/api/audits/${id}`, { method: 'DELETE' })
}

export function fetchAuditorRequests(adminToken: string) {
  return request<{
    requests: Array<{
      id: string
      status: string
      created_at: string
      reviewed_at: string | null
      review_note: string | null
      partner_id: string
      first_name: string
      last_name: string
      email: string
    }>
  }>('/api/admin/auditor-requests', {
    headers: { 'x-admin-token': adminToken },
  })
}

export function updateAvatar(image: string) {
  return request<{ user: PartnerUser }>('/api/account/avatar', {
    method: 'PUT',
    body: JSON.stringify({ image }),
  })
}

export function changePassword(payload: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}) {
  return request<{ ok: boolean }>('/api/account/password', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function sendEmailVerification() {
  return request<{ sent: boolean; previewCode?: string }>('/api/account/email/send-code', {
    method: 'POST',
  })
}

export function verifyEmailCode(code: string) {
  return request<{ user: PartnerUser }>('/api/account/email/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function reviewAuditorRequest(adminToken: string, id: string, status: 'approved' | 'rejected', note?: string) {
  return request<{ ok: boolean; status: string }>(`/api/admin/auditor-requests/${id}/review`, {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: JSON.stringify({ status, note }),
  })
}

export function fetchDocumentReviews(adminToken: string) {
  return request<{
    reviews: Array<{
      partner_id: string
      first_name: string
      last_name: string
      email: string
      review1_status: string
      review2_status: string
      review1_submitted_at: string | null
      review2_submitted_at: string | null
    }>
  }>('/api/admin/document-reviews', {
    headers: { 'x-admin-token': adminToken },
  })
}

export function reviewDocumentPackage(
  adminToken: string,
  partnerId: string,
  stage: 1 | 2,
  status: 'approved' | 'rejected',
) {
  return request<{ ok: boolean; stage: number; status: string }>(
    `/api/admin/document-reviews/${partnerId}/review`,
    {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ stage, status }),
    },
  )
}
