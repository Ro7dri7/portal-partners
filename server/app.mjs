import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import pg from 'pg'
import {
  deleteFromR2,
  documentObjectKey,
  fileExtension,
  getObjectFromR2,
  isAllowedExtension,
  isR2Configured,
  r2Config,
  sanitizeFileName,
  uploadToR2,
} from './r2.mjs'
import {
  isEmailConfigured,
  queueEmail,
  sendAuditorRequestReviewedEmail,
  sendDocsApprovedEmail,
  sendDocsReminderEmail,
  sendOpsObservationEmail,
  sendStatusChangeEmail,
  sendTrainingPendingEmail,
  sendVerifyCodeEmail,
  sendWelcomePendingDocsEmail,
} from './email.mjs'

dotenv.config()

function isPasswordValid(password) {
  const value = String(password || '')
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[!@#$%^&*]/.test(value)
  )
}

function sessionCookie(name, value, httpOnly = true) {
  const parts = [
    `${name}=${encodeURIComponent(String(value ?? ''))}`,
    'Path=/',
    'SameSite=Lax',
  ]
  if (httpOnly) parts.push('HttpOnly')
  return parts.join('; ')
}

function setSessionCookies(res, user, token) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()
  res.setHeader('Set-Cookie', [
    sessionCookie('auth_token', token, true),
    sessionCookie('partner_role', user.role, false),
    sessionCookie('partner_name', name, false),
  ])
}

function clearSessionCookies(res) {
  const expired = (name) => `${name}=; Path=/; Max-Age=0; SameSite=Lax`
  res.setHeader('Set-Cookie', [
    expired('auth_token'),
    expired('partner_role'),
    expired('partner_name'),
  ])
}

function sessionSecret() {
  return process.env.SESSION_SECRET || 'portal-partners-dev-session-secret'
}

function adminToken() {
  return process.env.ADMIN_TOKEN || 'portal-partners-dev-admin'
}

/** Afiliado y Partner Auditor comparten el flujo de perfil / documentación. */
function canUseAuditorPipeline(role) {
  return role === 'partner_auditor' || role === 'afiliado'
}

function helpdeskConfig() {
  const baseUrl = (process.env.HELPDESK_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '')
  const apiKey = (process.env.HELPDESK_INTEGRATION_API_KEY || process.env.N8N_INTEGRATION_API_KEY || '').trim()
  return { baseUrl, apiKey }
}

const COMMERCIAL_COORDINATORS = [
  { name: 'Cinthia Adriazola', email: 'cadriazola@intercert.com.pe' },
  { name: 'Liliana Restrepo', email: 'coordinador.comercial@intercert.co' },
  { name: 'Victor Fernandez', email: 'coordinador.comercial@intercert.mx' },
]

function resolveCoordinator(email) {
  const normalized = String(email || '').trim().toLowerCase()
  return COMMERCIAL_COORDINATORS.find((item) => item.email === normalized) || null
}

async function notifyHelpdeskPartnerAuditor({
  stage,
  application,
  partner,
  profile,
  documents,
}) {
  const { baseUrl, apiKey } = helpdeskConfig()
  if (!apiKey) {
    console.warn('[helpdesk] HELPDESK_INTEGRATION_API_KEY no configurada — omitiendo sync Partner Auditor')
    return null
  }
  const partnerPayload = {
    first_name: partner.first_name,
    last_name: partner.last_name,
    email: partner.email,
    document_id: profile?.document_id || '',
    phone: profile?.phone || '',
    comercial_a_cargo: partner.comercial_name || partner.comercial_email || '',
    comercial_email: partner.comercial_email || '',
  }
  const docsPayload = (documents || []).map((d) => ({
    category: d.category,
    file_name: d.file_name,
    file_size: d.file_size,
    storage_key: d.storage_key,
    mime_type: d.mime_type,
  }))
  const payload = {
    client_request_id: `portal-partners-${application.public_code}-fase${stage}`,
    stage,
    public_code: application.public_code,
    portal_partner_id: String(partner.id),
    portal_application_id: String(application.id),
    partner: partnerPayload,
    documents: docsPayload,
    title: `Partner Auditor · Fase ${stage} · ${[partner.first_name, partner.last_name].filter(Boolean).join(' ')}`.trim(),
    tags: `portal_partners,partner_auditor,fase_${stage}`,
  }
  try {
    let lastError = ''
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const resp = await fetch(`${baseUrl}/integrations/portal/partner-auditor-applications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
          },
          body: JSON.stringify(payload),
        })
        if (resp.ok) {
          const data = await resp.json().catch(() => ({ ok: true }))
          console.info('[helpdesk] partner-auditor ticket sync ok', data?.ticket_id || data?.id || '')
          return data
        }
        lastError = `${resp.status} ${await resp.text().catch(() => '')}`
        console.warn('[helpdesk] partner-auditor sync failed', lastError.slice(0, 400))
      } catch (err) {
        lastError = err?.message || String(err)
        console.warn(`[helpdesk] partner-auditor sync error (intento ${attempt}/4)`, lastError)
      }
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
      }
    }
    console.error('[helpdesk] partner-auditor sync agotó reintentos:', lastError.slice(0, 400))
    return null
  } catch (err) {
    console.warn('[helpdesk] partner-auditor sync error', err?.message || err)
    return null
  }
}

async function notifyHelpdeskPartnerComment({ publicCode, author, text }) {
  const { baseUrl, apiKey } = helpdeskConfig()
  if (!apiKey || !publicCode) return null
  try {
    const resp = await fetch(
      `${baseUrl}/integrations/portal/partner-auditor-applications/${encodeURIComponent(publicCode)}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          author,
          text,
          author_role: 'applicant',
        }),
      },
    )
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      console.warn('[helpdesk] partner comment sync failed', resp.status, body.slice(0, 300))
    }
  } catch (err) {
    console.warn('[helpdesk] partner comment sync error', err?.message || err)
  }
  return null
}

let pool

function getPool() {
  if (!pool) {
    dotenv.config()
    const host = process.env.PGHOST
    if (!host) {
      throw new Error('Falta PGHOST en el archivo .env')
    }
    pool = new pg.Pool({
      host,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      connectionTimeoutMillis: 8000,
    })
  }
  return pool
}

function databaseErrorMessage(error) {
  const code = error?.code || ''
  const host = process.env.PGHOST || '?'
  const port = process.env.PGPORT || '5432'
  const message = String(error?.message || error?.cause?.message || '')
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    /timeout|terminated/i.test(message)
  ) {
    return `No se pudo conectar a PostgreSQL en ${host}:${port}. Desde tu PC no hay acceso directo a 192.168.3.146: abre el túnel SSH (puerto 15432) o conéctate a la VPN.`
  }
  if (code === '28P01') {
    return 'Credenciales de PostgreSQL rechazadas. Revisa PGUSER y PGPASSWORD en .env.'
  }
  return 'No se pudo conectar con la base de datos.'
}

const PASSWORD_RULES = {
  minLength: (value) => value.length >= 8,
  uppercase: (value) => /[A-Z]/.test(value),
  lowercase: (value) => /[a-z]/.test(value),
  number: (value) => /[0-9]/.test(value),
  symbol: (value) => /[!@#$%^&*]/.test(value),
}

function hashEmailCode(code) {
  return crypto.createHmac('sha256', sessionSecret()).update(String(code)).digest('hex')
}

function isAvatarDataUrl(value) {
  return (
    typeof value === 'string' &&
    /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) &&
    value.length <= 800000
  )
}

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null
  const [data, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function splitLocation(row) {
  if (row?.country || row?.city) {
    return { country: row.country || '', city: row.city || '' }
  }
  const raw = row?.country_city || ''
  if (raw.includes(' / ')) {
    const [country, ...rest] = raw.split(' / ')
    return { country: country.trim(), city: rest.join(' / ').trim() }
  }
  return { country: raw, city: '' }
}

function publicProfile(row, partner) {
  const fallbackName = [partner?.first_name, partner?.last_name].filter(Boolean).join(' ').trim()
  const location = splitLocation(row)
  if (!row) {
    return {
      fullName: fallbackName,
      documentId: '',
      phone: '',
      phoneExtension: '',
      country: '',
      city: '',
      countryCity: '',
      isLeadAuditor: false,
      isoStandards: [],
      yearsExperience: '',
      certifyingBody: '',
      educationTitle: '',
      educationInstitution: '',
      educationYear: '',
      educationSpecialty: '',
      leadAuditorCourses: '',
      dataTreatmentAccepted: false,
      currentStep: 1,
      submitted: false,
      review1Status: 'pending',
      review2Status: 'locked',
      contractDownloaded: false,
      trainingCompleted: false,
      icf12Downloaded: false,
      commercialContractStatus: 'pending',
      commercialContractSubmitted: false,
      whatsappGroupUrl: '',
      whatsappConfirmed: false,
      auditReportTrainingCompleted: false,
      casaMatrizDownloaded: false,
      commercialTrainingCompleted: false,
    }
  }
  return {
    fullName: row.full_name || fallbackName,
    documentId: row.document_id || '',
    phone: row.phone || '',
    phoneExtension: row.phone_extension || '',
    country: location.country,
    city: location.city,
    countryCity: [location.country, location.city].filter(Boolean).join(' / '),
    isLeadAuditor: Boolean(row.is_lead_auditor),
    isoStandards: row.iso_standards || [],
    yearsExperience: row.years_experience ?? '',
    certifyingBody: row.certifying_body || '',
    educationTitle: row.education_title || '',
    educationInstitution: row.education_institution || '',
    educationYear: row.education_year || '',
    educationSpecialty: row.education_specialty || '',
    leadAuditorCourses: row.lead_auditor_courses || '',
    dataTreatmentAccepted: Boolean(row.data_treatment_accepted),
    currentStep: row.current_step || 1,
    submitted: Boolean(row.submitted_at || row.review1_submitted_at),
    review1Status: row.review1_status || 'pending',
    review2Status: row.review2_status || 'locked',
    contractDownloaded: Boolean(row.contract_downloaded_at),
    trainingCompleted: Boolean(row.training_completed_at),
    icf12Downloaded: Boolean(row.icf12_downloaded_at),
    commercialContractStatus: row.commercial_contract_status || 'pending',
    commercialContractSubmitted: Boolean(row.commercial_contract_submitted_at),
    whatsappGroupUrl: row.whatsapp_group_url || '',
    whatsappConfirmed: Boolean(row.whatsapp_confirmed_at),
    auditReportTrainingCompleted: Boolean(row.audit_report_training_at),
    casaMatrizDownloaded: Boolean(row.casa_matriz_downloaded_at),
    commercialTrainingCompleted: Boolean(row.commercial_training_at),
  }
}

function normalizeWhatsAppUrl(value) {
  let url = String(value || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    if (!['chat.whatsapp.com', 'wa.me', 'api.whatsapp.com', 'whatsapp.com'].includes(host)) {
      return ''
    }
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return ''
  }
}

function publicAudit(row) {
  return {
    id: row.id,
    organization: row.organization || '',
    standard: row.standard || '',
    startDate: formatSqlDate(row.start_date),
    endDate: formatSqlDate(row.end_date),
    days: row.days ?? '',
    auditType: row.audit_type || '',
    role: row.role || 'Auditor Líder',
    iafCode: row.iaf_code || '',
  }
}

function formatSqlDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).slice(0, 10)
}

function reviewFrozen(status) {
  return ['sent', 'in_review', 'validated', 'approved'].includes(String(status || ''))
}

const PORTAL_REVIEW_STATUSES = new Set([
  'pending',
  'sent',
  'in_review',
  'validated',
  'approved',
  'rejected',
  'locked',
  'ceo_signed',
])

const DOC_SLOT_LABELS = {
  cv_documentado: 'CV documentado y actualizado',
  diploma_estudio: 'Diploma de estudio técnico o universitario',
  certificados_auditor_lider: 'Certificados de curso de Auditor Líder',
  relacion_auditorias: 'Relación de auditorías realizadas como Auditor Líder',
  formato_ic_f_1_2: 'Formato IC.F.1.2',
  cv: 'CV documentado y actualizado',
  degree: 'Diploma de estudio técnico o universitario',
  lead_auditor_courses: 'Certificados de curso de Auditor Líder',
  audits_relation: 'Relación de auditorías realizadas como Auditor Líder',
  icf12: 'Formato IC.F.1.2',
  contrato_firmado: 'Contrato comercial firmado',
  commercial_contract: 'Contrato comercial firmado',
  firma_ceo: 'Firma CEO',
  advisor_rates: 'Tarifas de asesor',
  casa_matriz_contract: 'Contrato oficial CASA MATRIZ',
  identity: 'Documento de identidad',
  background: 'Antecedentes',
  data_treatment: 'Tratamiento de datos',
  experience: 'Experiencia',
  certificates: 'Certificados',
}

function labelDocSlot(key) {
  return DOC_SLOT_LABELS[key] || String(key || '').replace(/_/g, ' ')
}

function parseLegacyCommentMeta(body) {
  const text = String(body || '')
  const docsMatch = text.match(/📎\s*Documentos observados:\s*([^\n]+)/i)
  const deadlineMatch = text.match(
    /⏱\s*Fecha límite de corrección(?:\s*\(([^)]+)\))?:\s*(?:vence\s*)?([^\n]+)/i,
  )
  const referencedDocs = docsMatch
    ? docsMatch[1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
  let cleanBody = text
    .replace(/\n*\s*📎\s*Documentos observados:[^\n]*/gi, '')
    .replace(/\n*\s*⏱\s*Fecha límite de corrección[^\n]*/gi, '')
    .trim()
  return {
    cleanBody,
    referencedDocs,
    deadlineDurationLabel: deadlineMatch?.[1]?.trim() || null,
    deadlineLabel: deadlineMatch?.[2]?.trim() || null,
  }
}

function publicComment(row) {
  const legacy = parseLegacyCommentMeta(row.body)
  const storedDocs = Array.isArray(row.referenced_docs)
    ? row.referenced_docs
    : typeof row.referenced_docs === 'string'
      ? (() => {
          try {
            return JSON.parse(row.referenced_docs)
          } catch {
            return []
          }
        })()
      : []
  const referencedDocs = (storedDocs.length ? storedDocs : legacy.referencedDocs).map(String)
  const hasStructuredDeadline = Boolean(row.deadline_at)
  const body =
    storedDocs.length || hasStructuredDeadline ? String(row.body || '').trim() : legacy.cleanBody
  return {
    id: row.id,
    authorRole: row.author_role,
    authorName: row.author_name,
    body,
    referencedDocs,
    referencedDocLabels: referencedDocs.map(labelDocSlot),
    deadlineAt: row.deadline_at || null,
    deadlineDurationLabel: row.deadline_duration_label || legacy.deadlineDurationLabel,
    deadlineLabel: hasStructuredDeadline ? null : legacy.deadlineLabel,
    createdAt: row.created_at,
    track: row.track || 'auditor',
  }
}

function normalizeCommentTrack(value) {
  const raw = String(value || '').trim()
  if (raw === 'commercial' || raw === 'fase_2' || raw === 'fase_1') return raw
  return 'auditor'
}

async function createPartnerNotification(partnerId, { title, body, link }) {
  if (!partnerId) return
  await getPool().query(
    `INSERT INTO partner_notifications (partner_id, title, body, link)
     VALUES ($1, $2, $3, $4)`,
    [partnerId, title, body, link || '/dashboard/estado'],
  )
}

async function loadPartnerForEmail(partnerId) {
  if (!partnerId) return null
  const { rows } = await getPool().query(
    `SELECT id, email, first_name, last_name, role FROM partners WHERE id = $1`,
    [partnerId],
  )
  return rows[0] || null
}

function formatDeadlineLabel(deadlineAt, durationLabel) {
  if (durationLabel) return String(durationLabel)
  if (!deadlineAt) return null
  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(deadlineAt))
  } catch {
    return String(deadlineAt)
  }
}

const STATUS_EMAIL_MESSAGES = {
  1: {
    sent: 'Recibimos tu documentación de la revisión 1.',
    in_review: 'Tu documentación de la revisión 1 está en revisión por Operaciones.',
    validated: 'La documentación de la revisión 1 fue validada.',
    approved: 'La fase 1 fue aprobada. Ya puedes continuar con el formato IC.F.1.2.',
    rejected: 'La revisión 1 fue observada. Corrige los documentos marcados y vuelve a enviarla.',
  },
  2: {
    sent: 'Recibimos el formato IC.F.1.2.',
    in_review: 'Tu formato IC.F.1.2 está en revisión por Operaciones.',
    validated: 'El formato IC.F.1.2 fue validado.',
    approved: 'La fase 2 fue aprobada. Completaste el registro de auditor.',
    rejected: 'La revisión 2 fue observada. Corrige el formato IC.F.1.2 y vuelve a enviarlo.',
  },
}

function queuePartnerStatusEmails(partner, { stage, status }) {
  if (!partner?.email) return
  const phase = Number(stage) === 2 ? 2 : 1
  const message = STATUS_EMAIL_MESSAGES[phase]?.[status] || 'Hay una actualización en el estado de tu solicitud.'
  if (status === 'approved') {
    queueEmail(async () => {
      await sendDocsApprovedEmail(partner, { stage: phase })
      if (phase === 2) {
        const mailed = await sendTrainingPendingEmail(partner)
        if (mailed.sent) {
          await getPool().query(
            `UPDATE partners SET last_training_notice_at = now() WHERE id = $1`,
            [partner.id],
          )
        }
        await createPartnerNotification(partner.id, {
          title: 'Capacitación pendiente',
          body: 'Tienes capacitaciones pendientes por revisar en el Centro de Capacitación.',
          link: '/dashboard/capacitacion',
        })
      }
    })
    return
  }
  queueEmail(() => sendStatusChangeEmail(partner, { stage: phase, status, message }))
}

async function sendPendingDocsReminders() {
  if (!isEmailConfigured()) return
  await ensureMigrated()
  const { rows } = await getPool().query(
    `UPDATE partners p
     SET last_docs_reminder_at = now()
     WHERE p.id IN (
       SELECT id FROM partners
       WHERE role IN ('partner_auditor', 'afiliado')
         AND documents_unlocked = true
         AND documents_submitted_at IS NULL
         AND COALESCE(created_at, updated_at) < now() - interval '20 hours'
         AND (last_docs_reminder_at IS NULL OR last_docs_reminder_at < now() - interval '2 days')
       ORDER BY COALESCE(created_at, updated_at)
       LIMIT 40
     )
     RETURNING id, email, first_name, last_name, role`,
  )
  for (const partner of rows) {
    queueEmail(async () => {
      await sendDocsReminderEmail(partner)
      await createPartnerNotification(partner.id, {
        title: 'Documentación pendiente',
        body: 'Aún no has enviado tus documentos. Completa y envía tu solicitud para continuar.',
        link: '/dashboard/perfil',
      })
    })
  }

  const { rows: trainingDue } = await getPool().query(
    `UPDATE partners p
     SET last_training_notice_at = now()
     WHERE p.id IN (
       SELECT p2.id
       FROM partners p2
       LEFT JOIN partner_profiles pr ON pr.partner_id = p2.id
       WHERE p2.role IN ('partner_auditor', 'afiliado')
         AND p2.last_training_notice_at IS NULL
         AND (
           pr.review2_status = 'approved'
           OR (
             p2.role = 'afiliado'
             AND COALESCE(p2.created_at, p2.updated_at) < now() - interval '20 hours'
           )
         )
       LIMIT 40
     )
     RETURNING p.id, p.email, p.first_name, p.last_name, p.role`,
  )
  for (const partner of trainingDue) {
    queueEmail(async () => {
      await sendTrainingPendingEmail(partner)
      await createPartnerNotification(partner.id, {
        title: 'Capacitación pendiente',
        body: 'Tienes capacitaciones pendientes por revisar en el Centro de Capacitación.',
        link: '/dashboard/capacitacion',
      })
    })
  }
}

function startPartnerEmailJobs() {
  if (globalThis.__partnerEmailJobsStarted) return
  globalThis.__partnerEmailJobsStarted = true
  const run = () => {
    sendPendingDocsReminders().catch((err) => {
      console.warn('[email] recordatorios', err?.message || err)
    })
  }
  setTimeout(run, 60_000)
  setInterval(run, 6 * 60 * 60 * 1000)
}

function publicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    auditorRequestStatus: row.auditor_request_status,
    documentsUnlocked: row.documents_unlocked,
    documentsSubmitted: Boolean(row.documents_submitted_at),
    avatarUrl: row.avatar_url || null,
    emailVerified: Boolean(row.email_verified),
  }
}

async function migrate() {
  await getPool().query(`
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'afiliado';
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS auditor_request_status TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS documents_unlocked BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS documents_submitted_at TIMESTAMPTZ;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS email_verify_code_hash TEXT;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS email_verify_expires_at TIMESTAMPTZ;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS comercial_email TEXT;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS comercial_name TEXT;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_docs_reminder_at TIMESTAMPTZ;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_training_notice_at TIMESTAMPTZ;
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS auditor_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size BIGINT,
      status TEXT NOT NULL DEFAULT 'uploaded',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await getPool().query(`
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_check
  `)
  await getPool().query(`
    ALTER TABLE documents
      ADD CONSTRAINT documents_category_check
      CHECK (category IN (
        'cv', 'experience', 'certification', 'certificates',
        'identity', 'background', 'degree', 'lead_auditor_courses', 'data_treatment',
        'audits_relation', 'icf12', 'commercial_contract', 'ceo_signature',
        'advisor_rates', 'casa_matriz_contract'
      ))
  `)
  await getPool().query(`
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      partner_id UUID PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
      full_name TEXT,
      document_id TEXT,
      phone TEXT,
      country_city TEXT,
      is_lead_auditor BOOLEAN NOT NULL DEFAULT false,
      iso_standards TEXT[] NOT NULL DEFAULT '{}',
      years_experience INTEGER,
      certifying_body TEXT,
      education_title TEXT,
      education_institution TEXT,
      education_year TEXT,
      education_specialty TEXT,
      lead_auditor_courses TEXT,
      data_treatment_accepted BOOLEAN NOT NULL DEFAULT false,
      current_step INTEGER NOT NULL DEFAULT 1,
      submitted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await getPool().query(`
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS phone_extension TEXT;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS review1_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS review1_submitted_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS review2_status TEXT NOT NULL DEFAULT 'locked';
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS review2_submitted_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS contract_downloaded_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS training_completed_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS icf12_downloaded_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS commercial_contract_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS commercial_contract_submitted_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS whatsapp_group_url TEXT;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS whatsapp_confirmed_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS audit_report_training_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS casa_matriz_downloaded_at TIMESTAMPTZ;
    ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS commercial_training_at TIMESTAMPTZ;
  `)
  await getPool().query(`
    UPDATE partner_profiles
    SET review1_status = 'sent',
        review1_submitted_at = COALESCE(review1_submitted_at, submitted_at)
    WHERE submitted_at IS NOT NULL AND review1_status = 'pending'
  `)
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS auditor_audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      organization TEXT NOT NULL,
      standard TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      days INTEGER,
      audit_type TEXT,
      role TEXT,
      iaf_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      public_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_review',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS application_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      author_role TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      referenced_docs JSONB NOT NULL DEFAULT '[]'::jsonb,
      deadline_at TIMESTAMPTZ,
      deadline_duration_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await getPool().query(`
    ALTER TABLE application_comments ADD COLUMN IF NOT EXISTS referenced_docs JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE application_comments ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;
    ALTER TABLE application_comments ADD COLUMN IF NOT EXISTS deadline_duration_label TEXT;
    ALTER TABLE application_comments ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'auditor';
  `)

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS partner_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

let migratePromise

function ensureMigrated() {
  if (!migratePromise) migratePromise = migrate()
  return migratePromise
}

function readCookie(req, name) {
  const raw = String(req.headers.cookie || '')
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='))
      } catch {
        return rest.join('=')
      }
    }
  }
  return null
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
    const token = bearer || readCookie(req, 'auth_token')
    const payload = verifyToken(token)
    if (!payload?.id) {
      res.status(401).json({ error: 'Sesión no válida. Inicia sesión de nuevo.' })
      return
    }
    const { rows } = await getPool().query('SELECT * FROM partners WHERE id = $1', [payload.id])
    if (!rows[0]) {
      res.status(401).json({ error: 'Usuario no encontrado.' })
      return
    }
    req.partner = rows[0]
    req.token = token
    next()
  } catch (error) {
    next(error)
  }
}

const DOCUMENT_CATEGORIES = new Set([
  'cv',
  'experience',
  'certificates',
  'identity',
  'background',
  'degree',
  'lead_auditor_courses',
  'data_treatment',
  'audits_relation',
  'icf12',
  'commercial_contract',
  'advisor_rates',
  'casa_matriz_contract',
])
const SINGLE_DOCUMENT_CATEGORIES = new Set([
  'identity',
  'background',
  'data_treatment',
  'commercial_contract',
  'casa_matriz_contract',
])
const STAGE5_DOC_CATEGORIES = new Set(['advisor_rates', 'casa_matriz_contract'])
const REVIEW1_DOC_CATEGORIES = ['cv', 'degree', 'lead_auditor_courses', 'audits_relation']
const PDF_ONLY_CATEGORIES = new Set(['cv', 'data_treatment', 'audits_relation'])

async function getReviewStatuses(partnerId) {
  const { rows } = await getPool().query(
    'SELECT review1_status, review2_status, training_completed_at FROM partner_profiles WHERE partner_id = $1',
    [partnerId],
  )
  return {
    review1Status: rows[0]?.review1_status || 'pending',
    review2Status: rows[0]?.review2_status || 'locked',
    trainingCompleted: Boolean(rows[0]?.training_completed_at),
  }
}

function normalizeDocumentCategory(value) {
  const category = String(value || '')
  if (category === 'certification') return 'certificates'
  return category
}

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: r2Config().maxFileSize },
})

export function createApi() {
  const app = express()
  app.use(express.json({ limit: '4mb' }))

  app.use('/api', async (req, res, next) => {
    try {
      await ensureMigrated()
      next()
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: databaseErrorMessage(error) })
    }
  })

  app.post('/api/register', async (req, res) => {
    const firstName = String(req.body?.firstName || '').trim()
    const lastName = String(req.body?.lastName || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const confirmPassword = String(req.body?.confirmPassword || '')
    const role = req.body?.role === 'partner_auditor' ? 'partner_auditor' : 'afiliado'
    const terms = Boolean(req.body?.terms)
    const coordinator = resolveCoordinator(req.body?.comercialEmail)
    const country = String(req.body?.country || '').trim()

    if (!firstName || !lastName || !email) {
      res.status(400).json({ error: 'Completa todos los campos requeridos.' })
      return
    }
    if (!coordinator) {
      res.status(400).json({ error: 'Selecciona el coordinador comercial que te refirió.' })
      return
    }
    if (!country) {
      res.status(400).json({ error: 'Selecciona tu país de procedencia.' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Ingresa un correo electrónico válido.' })
      return
    }
    if (!isPasswordValid(password)) {
      res.status(400).json({ error: 'La contraseña no cumple los requisitos de seguridad.' })
      return
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Las contraseñas no coinciden.' })
      return
    }
    if (!terms) {
      res.status(400).json({ error: 'Debes aceptar los términos y condiciones.' })
      return
    }

    const existing = await getPool().query('SELECT id FROM partners WHERE email = $1', [email])
    if (existing.rows[0]) {
      res.status(409).json({ error: 'Ya existe una cuenta con este correo.' })
      return
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10)
      const documentsUnlocked = true
      const { rows } = await getPool().query(
      `INSERT INTO partners
        (first_name, last_name, email, password_hash, role, auditor_request_status, documents_unlocked, terms_accepted_at, comercial_email, comercial_name)
       VALUES ($1, $2, $3, $4, $5, 'none', $6, now(), $7, $8)
       RETURNING *`,
      [firstName, lastName, email, passwordHash, role, documentsUnlocked, coordinator.email, coordinator.name],
      )
      await getPool().query(
        `INSERT INTO partner_profiles (partner_id, country, country_city, updated_at)
         VALUES ($1, $2, $2, now())
         ON CONFLICT (partner_id) DO UPDATE SET
           country = EXCLUDED.country,
           country_city = CASE
             WHEN partner_profiles.city IS NULL OR partner_profiles.city = '' THEN EXCLUDED.country
             ELSE CONCAT_WS(' / ', EXCLUDED.country, partner_profiles.city)
           END,
           updated_at = now()`,
        [rows[0].id, country],
      )

      const user = publicUser(rows[0])
      const token = signToken({ id: user.id })
      setSessionCookies(res, user, token)
      queueEmail(() => sendWelcomePendingDocsEmail(rows[0]))
      res.status(201).json({ user, token })
    } catch (error) {
      if (error?.code === '23505') {
        res.status(409).json({ error: 'Ya existe una cuenta con este correo.' })
        return
      }
      throw error
    }
  })

  app.post('/api/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!email || !password) {
      res.status(400).json({ error: 'Ingresa tu correo y contraseña.' })
      return
    }

    const { rows } = await getPool().query('SELECT * FROM partners WHERE email = $1', [email])
    const partner = rows[0]
    if (!partner?.password_hash) {
      res.status(401).json({ error: 'Correo o contraseña incorrectos.' })
      return
    }

    const ok = await bcrypt.compare(password, partner.password_hash)
    if (!ok) {
      res.status(401).json({ error: 'Correo o contraseña incorrectos.' })
      return
    }

    const user = publicUser(partner)
    const token = signToken({ id: user.id })
    setSessionCookies(res, user, token)
    res.json({ user, token })
  })

  app.get('/api/me', requireAuth, (req, res) => {
    const user = publicUser(req.partner)
    setSessionCookies(res, user, req.token)
    res.json({ user, token: req.token })
  })

  app.post('/api/logout', (req, res) => {
    clearSessionCookies(res)
    res.json({ ok: true })
  })

  app.get('/api/logout', (req, res) => {
    clearSessionCookies(res)
    res.redirect('/login')
  })

  app.post('/api/auditor-request', requireAuth, async (req, res) => {
    const partner = req.partner
    if (partner.role === 'partner_auditor' || partner.documents_unlocked) {
      res.status(400).json({ error: 'Esta cuenta ya puede completar la validación de auditor.' })
      return
    }
    if (partner.auditor_request_status === 'pending') {
      res.status(409).json({ error: 'Tu solicitud ya está en revisión.' })
      return
    }

    await getPool().query(
      `INSERT INTO auditor_requests (partner_id, status) VALUES ($1, 'pending')`,
      [partner.id],
    )
    const { rows } = await getPool().query(
      `UPDATE partners
       SET auditor_request_status = 'pending', updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [partner.id],
    )

    res.json({ user: publicUser(rows[0]) })
  })

  app.post('/api/documents/upload', requireAuth, (req, res, next) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'La carga de documentos no está disponible para este rol.' })
      return
    }
    upload.single('file')(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido.' })
          return
        }
        next(error)
        return
      }
      next()
    })
  }, async (req, res) => {
    const tempPath = req.file?.path
    try {
      if (!isR2Configured()) {
        res.status(503).json({ error: 'El almacenamiento R2 no está configurado.' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'Adjunta un archivo.' })
        return
      }
      const category = normalizeDocumentCategory(req.body?.category)
      if (!DOCUMENT_CATEGORIES.has(category)) {
        res.status(400).json({ error: 'Categoría de documento no válida.' })
        return
      }
      const commercialExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
      const allowedForCategory =
        category === 'commercial_contract' ||
        category === 'ceo_signature' ||
        STAGE5_DOC_CATEGORIES.has(category)
          ? commercialExts.includes(fileExtension(req.file.originalname))
          : isAllowedExtension(req.file.originalname)
      if (!allowedForCategory) {
        const allowed =
          category === 'commercial_contract' ||
          category === 'ceo_signature' ||
          STAGE5_DOC_CATEGORIES.has(category)
            ? commercialExts.join(', ')
            : r2Config().allowedExtensions.join(', ')
        res.status(400).json({
          error: `Extensión no permitida. Usa: ${allowed}.`,
        })
        return
      }
      if (PDF_ONLY_CATEGORIES.has(category) && fileExtension(req.file.originalname) !== 'pdf') {
        res.status(400).json({ error: 'Este documento debe ser PDF.' })
        return
      }

      const reviews = await getReviewStatuses(req.partner.id)
      if (REVIEW1_DOC_CATEGORIES.includes(category) && reviewFrozen(reviews.review1Status)) {
        res.status(403).json({ error: 'La revisión 1 ya fue enviada y no se puede modificar.' })
        return
      }
      if (category === 'icf12' && reviews.review1Status !== 'approved') {
        res.status(403).json({ error: 'El formato IC.F.1.2 se habilita cuando se apruebe la revisión 1.' })
        return
      }
      if (category === 'icf12' && !reviews.trainingCompleted) {
        res.status(403).json({
          error: 'Completa el video de capacitación para habilitar la fase 2.',
        })
        return
      }
      if (category === 'icf12' && reviewFrozen(reviews.review2Status)) {
        res.status(403).json({ error: 'La revisión 2 ya fue enviada y no se puede modificar.' })
        return
      }
      if (STAGE5_DOC_CATEGORIES.has(category)) {
        const { rows: stage5 } = await getPool().query(
          `SELECT whatsapp_confirmed_at, casa_matriz_downloaded_at
           FROM partner_profiles WHERE partner_id = $1`,
          [req.partner.id],
        )
        if (!stage5[0]?.whatsapp_confirmed_at) {
          res.status(403).json({ error: 'Completa la etapa 4 para habilitar estas actividades.' })
          return
        }
        if (category === 'casa_matriz_contract' && !stage5[0]?.casa_matriz_downloaded_at) {
          res.status(403).json({
            error: 'Descarga el contrato oficial CASA MATRIZ antes de subirlo firmado.',
          })
          return
        }
      }

      if (SINGLE_DOCUMENT_CATEGORIES.has(category)) {
        const { rows: previous } = await getPool().query(
          `SELECT id, storage_key FROM documents WHERE partner_id = $1 AND category = $2`,
          [req.partner.id, category],
        )
        for (const row of previous) {
          await deleteFromR2(row.storage_key).catch(() => {})
          await getPool().query('DELETE FROM documents WHERE id = $1', [row.id])
        }
      }

      const key = documentObjectKey(req.partner.id, category, req.file.originalname)
      await uploadToR2({
        key,
        body: fs.createReadStream(tempPath),
        contentType: req.file.mimetype,
        contentLength: req.file.size,
      })

      const { rows } = await getPool().query(
        `INSERT INTO documents (
           partner_id, category, file_name, mime_type, file_size, status, storage_key, storage_bucket
         ) VALUES ($1, $2, $3, $4, $5, 'uploaded', $6, $7)
         RETURNING id, category, file_name, file_size, status, review_status`,
        [
          req.partner.id,
          category,
          req.file.originalname,
          req.file.mimetype || null,
          req.file.size,
          key,
          r2Config().bucket,
        ],
      )
      if (category === 'icf12') {
        await getPool().query(
          `UPDATE partner_profiles
           SET icf12_downloaded_at = COALESCE(icf12_downloaded_at, now()),
               updated_at = now()
           WHERE partner_id = $1`,
          [req.partner.id],
        )
      }
      res.status(201).json({ document: rows[0] })
    } catch (error) {
      console.error(error)
      const code = error?.code || error?.cause?.code
      if (code === '23514') {
        res.status(400).json({ error: 'Esta categoría de documento aún no está habilitada en la base.' })
        return
      }
      res.status(500).json({ error: 'No se pudo subir el archivo a Cloudflare R2.' })
    } finally {
      if (tempPath) {
        fs.promises.unlink(tempPath).catch(() => {})
      }
    }
  })

  app.delete('/api/documents/:id', requireAuth, async (req, res) => {
    const { rows: existing } = await getPool().query(
      `SELECT id, category, storage_key FROM documents WHERE id = $1 AND partner_id = $2`,
      [req.params.id, req.partner.id],
    )
    if (!existing[0]) {
      res.status(404).json({ error: 'Documento no encontrado.' })
      return
    }
    const reviews = await getReviewStatuses(req.partner.id)
    if (REVIEW1_DOC_CATEGORIES.includes(existing[0].category) && reviewFrozen(reviews.review1Status)) {
      res.status(403).json({ error: 'La revisión 1 ya fue enviada y no se puede modificar.' })
      return
    }
    if (existing[0].category === 'icf12' && reviewFrozen(reviews.review2Status)) {
      res.status(403).json({ error: 'La revisión 2 ya fue enviada y no se puede modificar.' })
      return
    }
    const { rows } = await getPool().query(
      `DELETE FROM documents WHERE id = $1 AND partner_id = $2 RETURNING storage_key`,
      [req.params.id, req.partner.id],
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'Documento no encontrado.' })
      return
    }
    await deleteFromR2(rows[0].storage_key).catch(() => {})
    res.json({ ok: true })
  })

  app.get('/api/documents/:id/file', requireAuth, async (req, res) => {
    const { rows } = await getPool().query(
      `SELECT id, file_name, mime_type, storage_key
       FROM documents WHERE id = $1 AND partner_id = $2`,
      [req.params.id, req.partner.id],
    )
    if (!rows[0]?.storage_key) {
      res.status(404).json({ error: 'Documento no encontrado.' })
      return
    }
    if (!isR2Configured()) {
      res.status(503).json({ error: 'Almacenamiento R2 no configurado.' })
      return
    }
    try {
      const file = await getObjectFromR2(rows[0].storage_key)
      const fileName = sanitizeFileName(rows[0].file_name || 'documento')
      const inline = String(req.query.inline || '') === '1'
      res.setHeader('Content-Type', file.contentType || rows[0].mime_type || 'application/octet-stream')
      if (file.contentLength) {
        res.setHeader('Content-Length', String(file.contentLength))
      }
      res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      )
      res.send(file.body)
    } catch (err) {
      console.error('[documents] download failed', err)
      res.status(404).json({ error: 'No se pudo descargar el documento.' })
    }
  })

  app.post('/api/documents/submit', requireAuth, async (req, res) => {
    const partner = req.partner
    if (!canUseAuditorPipeline(partner.role)) {
      res.status(403).json({ error: 'Este envío no está disponible para este rol.' })
      return
    }
    if (!partner.documents_unlocked) {
      res.status(403).json({
        error: 'El formulario de validación aún no está habilitado para tu cuenta.',
      })
      return
    }

    const { rows: docs } = await getPool().query(
      `SELECT category FROM documents
       WHERE partner_id = $1 AND storage_key IS NOT NULL`,
      [partner.id],
    )
    if (!docs.some((doc) => doc.category === 'cv')) {
      res.status(400).json({ error: 'Debes subir tu CV a R2 antes de enviar.' })
      return
    }

    const publicCode = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    await getPool().query(
      `INSERT INTO applications (partner_id, public_code, status)
       VALUES ($1, $2, 'in_review')`,
      [partner.id, publicCode],
    )
    const { rows } = await getPool().query(
      `UPDATE partners
       SET documents_submitted_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [partner.id],
    )

    res.json({ user: publicUser(rows[0]), publicCode })
  })

  app.get('/api/profile', requireAuth, async (req, res) => {
    const { rows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [req.partner.id],
    )
    const { rows: docs } = await getPool().query(
      `SELECT id, category, file_name, file_size, status, review_status, mime_type, created_at
       FROM documents WHERE partner_id = $1 ORDER BY created_at DESC`,
      [req.partner.id],
    )
    const { rows: appRows } = await getPool().query(
      `SELECT id, public_code, status, created_at
       FROM applications WHERE partner_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [req.partner.id],
    )
    const { rows: comments } = appRows[0]
      ? await getPool().query(
          `SELECT id, author_role, author_name, body, referenced_docs, deadline_at,
                  deadline_duration_label, created_at, COALESCE(track, 'auditor') AS track
           FROM application_comments WHERE application_id = $1
           ORDER BY created_at ASC`,
          [appRows[0].id],
        )
      : { rows: [] }
    const { rows: audits } = await getPool().query(
      `SELECT * FROM auditor_audits WHERE partner_id = $1 ORDER BY start_date NULLS LAST, created_at`,
      [req.partner.id],
    )
    res.json({
      profile: publicProfile(rows[0], req.partner),
      documents: docs,
      audits: audits.map(publicAudit),
      application: appRows[0]
        ? {
            id: appRows[0].id,
            publicCode: appRows[0].public_code,
            status: appRows[0].status,
            createdAt: appRows[0].created_at,
          }
        : null,
      comments: comments.map(publicComment).filter((item) => item.track !== 'commercial'),
      commercialComments: comments
        .map(publicComment)
        .filter((item) => item.track === 'commercial'),
    })
  })

  app.put('/api/profile', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Este formulario no está disponible para este rol.' })
      return
    }
    const body = req.body || {}
    const isoStandards = Array.isArray(body.isoStandards)
      ? body.isoStandards.map((item) => String(item))
      : []
    const years = body.yearsExperience === '' || body.yearsExperience == null
      ? null
      : Number(body.yearsExperience)
    const currentStep = Math.min(4, Math.max(1, Number(body.currentStep) || 1))

    const country = String(body.country || '').trim()
    const city = String(body.city || '').trim()
    const countryCity = [country, city].filter(Boolean).join(' / ') || String(body.countryCity || '').trim()

    const { rows } = await getPool().query(
      `INSERT INTO partner_profiles (
         partner_id, full_name, document_id, phone, phone_extension, country, city, country_city, is_lead_auditor,
         iso_standards, years_experience, certifying_body, education_title,
         education_institution, education_year, education_specialty, lead_auditor_courses,
         data_treatment_accepted, current_step, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now())
       ON CONFLICT (partner_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         document_id = EXCLUDED.document_id,
         phone = EXCLUDED.phone,
         phone_extension = EXCLUDED.phone_extension,
         country = EXCLUDED.country,
         city = EXCLUDED.city,
         country_city = EXCLUDED.country_city,
         is_lead_auditor = EXCLUDED.is_lead_auditor,
         iso_standards = EXCLUDED.iso_standards,
         years_experience = EXCLUDED.years_experience,
         certifying_body = EXCLUDED.certifying_body,
         education_title = EXCLUDED.education_title,
         education_institution = EXCLUDED.education_institution,
         education_year = EXCLUDED.education_year,
         education_specialty = EXCLUDED.education_specialty,
         lead_auditor_courses = EXCLUDED.lead_auditor_courses,
         data_treatment_accepted = EXCLUDED.data_treatment_accepted,
         current_step = EXCLUDED.current_step,
         updated_at = now()
       RETURNING *`,
      [
        req.partner.id,
        String(body.fullName || '').trim() || null,
        String(body.documentId || '').trim() || null,
        String(body.phone || '').trim() || null,
        String(body.phoneExtension || '').trim() || null,
        country || null,
        city || null,
        countryCity || null,
        Boolean(body.isLeadAuditor),
        isoStandards,
        Number.isFinite(years) ? years : null,
        String(body.certifyingBody || '').trim() || null,
        String(body.educationTitle || '').trim() || null,
        String(body.educationInstitution || '').trim() || null,
        String(body.educationYear || '').trim() || null,
        String(body.educationSpecialty || '').trim() || null,
        String(body.leadAuditorCourses || '').trim() || null,
        Boolean(body.dataTreatmentAccepted),
        currentStep,
      ],
    )

    res.json({ profile: publicProfile(rows[0], req.partner) })
  })

  app.post('/api/profile/stage1/contract', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta etapa no está disponible para este rol.' })
      return
    }
    await ensurePartnerProfile(req.partner.id)
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET contract_downloaded_at = COALESCE(contract_downloaded_at, now()),
           updated_at = now()
       WHERE partner_id = $1
       RETURNING *`,
      [req.partner.id],
    )
    await getPool().query(
      `INSERT INTO partner_notifications (partner_id, title, body, link)
       VALUES ($1, $2, $3, $4)`,
      [
        req.partner.id,
        'Descarga confirmada',
        'Descargaste el contrato de Partner. La etapa 1 quedó completada.',
        '/dashboard',
      ],
    )
    res.json({ profile: publicProfile(rows[0], req.partner), ok: true })
  })

  app.post('/api/profile/stage2/training', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta etapa no está disponible para este rol.' })
      return
    }
    await ensurePartnerProfile(req.partner.id)
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET training_completed_at = COALESCE(training_completed_at, now()),
           updated_at = now()
       WHERE partner_id = $1
       RETURNING *`,
      [req.partner.id],
    )
    await getPool().query(
      `INSERT INTO partner_notifications (partner_id, title, body, link)
       VALUES ($1, $2, $3, $4)`,
      [
        req.partner.id,
        'Capacitación completada',
        'Completaste el video “¿Cómo llenar tu formato IC.F.1.2?”. Ya puedes continuar con la fase 2 cuando la documentación esté aprobada.',
        '/dashboard/perfil',
      ],
    )
    res.json({ profile: publicProfile(rows[0], req.partner), ok: true })
  })

  app.post('/api/profile/stage2/icf12-download', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta etapa no está disponible para este rol.' })
      return
    }
    await ensurePartnerProfile(req.partner.id)
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET icf12_downloaded_at = COALESCE(icf12_downloaded_at, now()),
           updated_at = now()
       WHERE partner_id = $1
       RETURNING *`,
      [req.partner.id],
    )
    res.json({ profile: publicProfile(rows[0], req.partner), ok: true })
  })

  app.post('/api/profile/stage5/training', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta etapa no está disponible para este rol.' })
      return
    }
    await ensurePartnerProfile(req.partner.id)
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET audit_report_training_at = COALESCE(audit_report_training_at, now()),
           updated_at = now()
       WHERE partner_id = $1
       RETURNING *`,
      [req.partner.id],
    )
    res.json({ profile: publicProfile(rows[0], req.partner), ok: true })
  })

  app.post('/api/profile/stage5/casa-matriz-download', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta etapa no está disponible para este rol.' })
      return
    }
    await ensurePartnerProfile(req.partner.id)
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET casa_matriz_downloaded_at = COALESCE(casa_matriz_downloaded_at, now()),
           updated_at = now()
       WHERE partner_id = $1
       RETURNING *`,
      [req.partner.id],
    )
    res.json({ profile: publicProfile(rows[0], req.partner), ok: true })
  })

  app.post('/api/profile/stage6/training', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta etapa no está disponible para este rol.' })
      return
    }
    await ensurePartnerProfile(req.partner.id)
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET commercial_training_at = COALESCE(commercial_training_at, now()),
           updated_at = now()
       WHERE partner_id = $1
       RETURNING *`,
      [req.partner.id],
    )
    res.json({ profile: publicProfile(rows[0], req.partner), ok: true })
  })

  app.post('/api/profile/submit', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Este formulario no está disponible para este rol.' })
      return
    }
    if (!req.partner.documents_unlocked) {
      res.status(403).json({
        error: 'El formulario de validación aún no está habilitado para tu cuenta.',
      })
      return
    }

    const required = ['cv', 'identity', 'background', 'degree', 'data_treatment']
    const { rows: storedDocs } = await getPool().query(
      `SELECT category FROM documents
       WHERE partner_id = $1 AND storage_key IS NOT NULL`,
      [req.partner.id],
    )
    const missing = required.filter(
      (category) => !storedDocs.some((doc) => doc.category === category),
    )
    if (missing.length) {
      res.status(400).json({
        error: 'Faltan documentos obligatorios. Súbelos antes de enviar tu registro.',
      })
      return
    }
    if (!req.body?.dataTreatmentAccepted) {
      res.status(400).json({
        error: 'Debes confirmar el tratamiento de datos personales.',
      })
      return
    }

    await getPool().query(
      `INSERT INTO partner_profiles (
         partner_id, data_treatment_accepted, current_step, submitted_at, updated_at
       ) VALUES ($1, true, 4, now(), now())
       ON CONFLICT (partner_id) DO UPDATE SET
         data_treatment_accepted = true,
         current_step = 4,
         submitted_at = now(),
         updated_at = now()`,
      [req.partner.id],
    )

    const publicCode = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    const { rows: createdApp } = await getPool().query(
      `INSERT INTO applications (partner_id, public_code, status)
       VALUES ($1, $2, 'in_review')
       RETURNING id`,
      [req.partner.id, publicCode],
    )
    await getPool().query(
      `INSERT INTO application_comments (application_id, author_role, author_name, body)
       VALUES ($1, 'coordinator', 'Intercert Latam', $2)`,
      [
        createdApp[0].id,
        'Recibimos tu formulario de Partner Auditor. El equipo técnico iniciará la revisión de tus datos y documentos.',
      ],
    )
    const { rows } = await getPool().query(
      `UPDATE partners
       SET documents_submitted_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.partner.id],
    )
    const { rows: profileRows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [req.partner.id],
    )

    res.json({
      user: publicUser(rows[0]),
      profile: publicProfile(profileRows[0], rows[0]),
      publicCode,
    })
  })

  function parseAuditBody(body) {
    const daysRaw = body?.days
    const days = daysRaw === '' || daysRaw == null ? null : Number(daysRaw)
    return {
      organization: String(body?.organization || '').trim(),
      standard: String(body?.standard || '').trim(),
      startDate: String(body?.startDate || '').trim() || null,
      endDate: String(body?.endDate || '').trim() || null,
      days: Number.isFinite(days) ? days : null,
      auditType: String(body?.auditType || '').trim(),
      role: String(body?.role || 'Auditor Líder').trim() || 'Auditor Líder',
      iafCode: String(body?.iafCode || '').trim(),
    }
  }

  async function requireEditableReview1(req, res) {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta sección no está disponible para este rol.' })
      return false
    }
    const reviews = await getReviewStatuses(req.partner.id)
    if (reviewFrozen(reviews.review1Status)) {
      res.status(403).json({ error: 'La revisión 1 ya fue enviada y no se puede modificar.' })
      return false
    }
    return true
  }

  async function ensurePartnerProfile(partnerId) {
    await getPool().query(
      `INSERT INTO partner_profiles (partner_id, updated_at)
       VALUES ($1, now())
       ON CONFLICT (partner_id) DO NOTHING`,
      [partnerId],
    )
  }

  async function ensureApplication(partnerId, comment) {
    const { rows } = await getPool().query(
      `SELECT id, public_code FROM applications WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [partnerId],
    )
    if (rows[0]) {
      if (comment) {
        await getPool().query(
          `INSERT INTO application_comments (application_id, author_role, author_name, body)
           VALUES ($1, 'coordinator', 'Intercert Latam', $2)`,
          [rows[0].id, comment],
        )
      }
      return rows[0]
    }
    const publicCode = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    const { rows: created } = await getPool().query(
      `INSERT INTO applications (partner_id, public_code, status)
       VALUES ($1, $2, 'in_review')
       RETURNING id, public_code`,
      [partnerId, publicCode],
    )
    if (comment) {
      await getPool().query(
        `INSERT INTO application_comments (application_id, author_role, author_name, body)
         VALUES ($1, 'coordinator', 'Intercert Latam', $2)`,
        [created[0].id, comment],
      )
    }
    return created[0]
  }

  app.post('/api/audits', requireAuth, async (req, res) => {
    if (!(await requireEditableReview1(req, res))) return
    const audit = parseAuditBody(req.body)
    if (!audit.organization || !audit.standard) {
      res.status(400).json({ error: 'Indica la organización y la norma auditada.' })
      return
    }
    const { rows } = await getPool().query(
      `INSERT INTO auditor_audits (
         partner_id, organization, standard, start_date, end_date, days, audit_type, role, iaf_code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        req.partner.id,
        audit.organization,
        audit.standard,
        audit.startDate,
        audit.endDate,
        audit.days,
        audit.auditType || null,
        audit.role,
        audit.iafCode || null,
      ],
    )
    res.status(201).json({ audit: publicAudit(rows[0]) })
  })

  app.put('/api/audits/:id', requireAuth, async (req, res) => {
    if (!(await requireEditableReview1(req, res))) return
    const audit = parseAuditBody(req.body)
    const { rows } = await getPool().query(
      `UPDATE auditor_audits
       SET organization = $1, standard = $2, start_date = $3, end_date = $4, days = $5,
           audit_type = $6, role = $7, iaf_code = $8, updated_at = now()
       WHERE id = $9 AND partner_id = $10
       RETURNING *`,
      [
        audit.organization,
        audit.standard,
        audit.startDate,
        audit.endDate,
        audit.days,
        audit.auditType || null,
        audit.role,
        audit.iafCode || null,
        req.params.id,
        req.partner.id,
      ],
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'Auditoría no encontrada.' })
      return
    }
    res.json({ audit: publicAudit(rows[0]) })
  })

  app.delete('/api/audits/:id', requireAuth, async (req, res) => {
    if (!(await requireEditableReview1(req, res))) return
    const { rows } = await getPool().query(
      `DELETE FROM auditor_audits WHERE id = $1 AND partner_id = $2 RETURNING id`,
      [req.params.id, req.partner.id],
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'Auditoría no encontrada.' })
      return
    }
    res.json({ ok: true })
  })

  app.post('/api/profile/review1/submit', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Este envío no está disponible para este rol.' })
      return
    }
    const reviews = await getReviewStatuses(req.partner.id)
    if (reviewFrozen(reviews.review1Status)) {
      const application = await ensureApplication(req.partner.id)
      const { rows: partnerRows } = await getPool().query('SELECT * FROM partners WHERE id = $1', [
        req.partner.id,
      ])
      const { rows: profileRows } = await getPool().query(
        'SELECT * FROM partner_profiles WHERE partner_id = $1',
        [req.partner.id],
      )
      const { rows: docRows } = await getPool().query(
        `SELECT category, file_name, file_size, storage_key, mime_type
         FROM documents
         WHERE partner_id = $1
           AND category = ANY($2::text[])
           AND storage_key IS NOT NULL
         ORDER BY created_at`,
        [req.partner.id, REVIEW1_DOC_CATEGORIES],
      )
      const synced = await notifyHelpdeskPartnerAuditor({
        stage: 1,
        application,
        partner: partnerRows[0],
        profile: profileRows[0],
        documents: docRows,
      })
      if (!synced) {
        res.status(502).json({
          error: 'La fase 1 ya estaba enviada, pero no se pudo crear el ticket en Operaciones. Reintenta en unos segundos.',
        })
        return
      }
      res.json({
        user: publicUser(partnerRows[0]),
        profile: publicProfile(profileRows[0], partnerRows[0]),
        publicCode: application.public_code,
        synced: true,
      })
      return
    }

    const { rows: storedDocs } = await getPool().query(
      `SELECT category FROM documents
       WHERE partner_id = $1 AND storage_key IS NOT NULL`,
      [req.partner.id],
    )
    const missing = REVIEW1_DOC_CATEGORIES.filter(
      (category) => !storedDocs.some((doc) => doc.category === category),
    )
    if (missing.length) {
      res.status(400).json({
        error: 'Adjunta CV, diploma, certificados de Auditor Líder y la relación de auditorías.',
      })
      return
    }

    await getPool().query(
      `UPDATE documents
       SET review_status = 'pending'
       WHERE partner_id = $1 AND category = ANY($2::text[])`,
      [req.partner.id, REVIEW1_DOC_CATEGORIES],
    )
    await ensurePartnerProfile(req.partner.id)
    await getPool().query(
      `UPDATE partner_profiles
       SET review1_status = 'sent',
           review1_submitted_at = now(),
           submitted_at = COALESCE(submitted_at, now()),
           current_step = 4,
           updated_at = now()
       WHERE partner_id = $1`,
      [req.partner.id],
    )
    await getPool().query(
      `UPDATE partners SET documents_submitted_at = COALESCE(documents_submitted_at, now()), updated_at = now()
       WHERE id = $1`,
      [req.partner.id],
    )
    const application = await ensureApplication(
      req.partner.id,
      'Recibimos tu documentación de la revisión 1. El equipo técnico de Intercert evaluará CV, diploma, certificados y el historial de auditorías.',
    )
    const { rows: partnerRows } = await getPool().query('SELECT * FROM partners WHERE id = $1', [
      req.partner.id,
    ])
    const { rows: profileRows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [req.partner.id],
    )
    const { rows: docRows } = await getPool().query(
      `SELECT category, file_name, file_size, storage_key, mime_type
       FROM documents
       WHERE partner_id = $1
         AND category = ANY($2::text[])
         AND storage_key IS NOT NULL
       ORDER BY created_at`,
      [req.partner.id, REVIEW1_DOC_CATEGORIES],
    )
    await notifyHelpdeskPartnerAuditor({
      stage: 1,
      application,
      partner: partnerRows[0],
      profile: profileRows[0],
      documents: docRows,
    })
    queuePartnerStatusEmails(partnerRows[0], { stage: 1, status: 'sent' })
    res.json({
      user: publicUser(partnerRows[0]),
      profile: publicProfile(profileRows[0], partnerRows[0]),
      publicCode: application.public_code,
    })
  })

  app.post('/api/profile/review2/submit', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Este envío no está disponible para este rol.' })
      return
    }
    const reviews = await getReviewStatuses(req.partner.id)
    if (reviews.review1Status !== 'approved') {
      res.status(403).json({ error: 'La revisión 2 se habilita cuando se apruebe la revisión 1.' })
      return
    }
    if (!reviews.trainingCompleted) {
      res.status(403).json({
        error: 'Completa el video de capacitación antes de enviar la fase 2.',
      })
      return
    }
    if (reviewFrozen(reviews.review2Status)) {
      res.status(400).json({ error: 'La revisión 2 ya está en curso o fue aprobada.' })
      return
    }

    const { rows: storedDocs } = await getPool().query(
      `SELECT category FROM documents
       WHERE partner_id = $1 AND category = 'icf12' AND storage_key IS NOT NULL`,
      [req.partner.id],
    )
    if (!storedDocs[0]) {
      res.status(400).json({
        error: 'Descarga, completa y vuelve a subir el formato IC.F.1.2 antes de enviarlo.',
      })
      return
    }

    await getPool().query(
      `UPDATE documents
       SET review_status = 'pending'
       WHERE partner_id = $1 AND category = 'icf12'`,
      [req.partner.id],
    )
    await getPool().query(
      `UPDATE partner_profiles
       SET review2_status = 'sent',
           review2_submitted_at = now(),
           updated_at = now()
       WHERE partner_id = $1`,
      [req.partner.id],
    )
    const application = await ensureApplication(
      req.partner.id,
      'Recibimos el formato IC.F.1.2 Application and Auditor Registration - Initial. El equipo técnico iniciará esta segunda revisión.',
    )
    const { rows: partnerRows } = await getPool().query('SELECT * FROM partners WHERE id = $1', [
      req.partner.id,
    ])
    const { rows: profileRows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [req.partner.id],
    )
    const { rows: docRows } = await getPool().query(
      `SELECT category, file_name, file_size, storage_key, mime_type
       FROM documents
       WHERE partner_id = $1 AND category = 'icf12' AND storage_key IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.partner.id],
    )
    await notifyHelpdeskPartnerAuditor({
      stage: 2,
      application,
      partner: partnerRows[0],
      profile: profileRows[0],
      documents: docRows,
    })
    queuePartnerStatusEmails(partnerRows[0], { stage: 2, status: 'sent' })
    res.json({
      user: publicUser(partnerRows[0]),
      profile: publicProfile(profileRows[0], partnerRows[0]),
      publicCode: application.public_code,
    })
  })

  app.post('/api/profile/commercial-contract/submit', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Este envío no está disponible para este rol.' })
      return
    }
    const { rows: storedDocs } = await getPool().query(
      `SELECT category FROM documents
       WHERE partner_id = $1 AND category = 'commercial_contract' AND storage_key IS NOT NULL`,
      [req.partner.id],
    )
    if (!storedDocs[0]) {
      res.status(400).json({ error: 'Sube el contrato firmado antes de enviarlo.' })
      return
    }
    const { rows: reviewRows } = await getPool().query(
      'SELECT review2_status FROM partner_profiles WHERE partner_id = $1',
      [req.partner.id],
    )
    const review2 = reviewRows[0]?.review2_status || 'locked'
    if (!['sent', 'in_review', 'validated', 'approved'].includes(review2)) {
      res.status(403).json({
        error: 'Envía la validación de Partner Auditor (fase 2) antes del contrato comercial.',
      })
      return
    }
    await getPool().query(
      `UPDATE partner_profiles
       SET commercial_contract_status = 'sent',
           commercial_contract_submitted_at = COALESCE(commercial_contract_submitted_at, now()),
           updated_at = now()
       WHERE partner_id = $1`,
      [req.partner.id],
    )
    const application = await ensureApplication(
      req.partner.id,
      'Recibimos tu contrato comercial firmado. El equipo comercial lo revisará.',
    )
    const { rows: partnerRows } = await getPool().query('SELECT * FROM partners WHERE id = $1', [
      req.partner.id,
    ])
    const { rows: profileRows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [req.partner.id],
    )
    const { rows: docRows } = await getPool().query(
      `SELECT category, file_name, file_size, storage_key, mime_type
       FROM documents
       WHERE partner_id = $1 AND category = 'commercial_contract' AND storage_key IS NOT NULL
       ORDER BY created_at DESC`,
      [req.partner.id],
    )
    await notifyHelpdeskPartnerAuditor({
      stage: 3,
      application,
      partner: partnerRows[0],
      profile: profileRows[0],
      documents: docRows,
    })
    res.json({
      user: publicUser(partnerRows[0]),
      profile: publicProfile(profileRows[0], partnerRows[0]),
      publicCode: application.public_code,
    })
  })

  app.post('/api/profile/whatsapp/confirm', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Esta acción no está disponible para este rol.' })
      return
    }
    const { rows: profileRows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [req.partner.id],
    )
    if (!profileRows[0]?.whatsapp_group_url) {
      res.status(400).json({
        error: 'Aún no hay un link de WhatsApp. Espera a tu coordinador comercial.',
      })
      return
    }
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET whatsapp_confirmed_at = COALESCE(whatsapp_confirmed_at, now()),
           updated_at = now()
       WHERE partner_id = $1
       RETURNING *`,
      [req.partner.id],
    )
    res.json({ profile: publicProfile(rows[0], req.partner) })
  })

  app.get('/api/admin/documents/download', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const key = String(req.query.key || '').trim()
    const fileName = sanitizeFileName(String(req.query.fileName || 'documento.pdf'))
    if (!key || !key.startsWith('partners/')) {
      res.status(400).json({ error: 'storage_key inválido.' })
      return
    }
    if (!isR2Configured()) {
      res.status(503).json({ error: 'Almacenamiento R2 no configurado.' })
      return
    }
    try {
      const file = await getObjectFromR2(key)
      res.setHeader('Content-Type', file.contentType || 'application/octet-stream')
      if (file.contentLength) {
        res.setHeader('Content-Length', String(file.contentLength))
      }
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      )
      res.send(file.body)
    } catch (err) {
      console.error('[admin] document download failed', err)
      res.status(404).json({ error: 'No se pudo descargar el documento.' })
    }
  })

  app.post('/api/admin/applications/by-code/:publicCode/comments', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const publicCode = String(req.params.publicCode || '').trim()
    const authorName = String(req.body?.authorName || 'Operaciones Intercert').trim()
    const authorEmail = String(req.body?.authorEmail || '').trim()
    const body = String(req.body?.body || '').trim()
    if (!publicCode || !body) {
      res.status(400).json({ error: 'Código y comentario son obligatorios.' })
      return
    }
    const referencedDocs = Array.isArray(req.body?.referencedDocs)
      ? req.body.referencedDocs.map((item) => String(item)).filter(Boolean)
      : []
    const deadlineAt = req.body?.deadlineAt ? String(req.body.deadlineAt) : null
    const deadlineDurationLabel = req.body?.deadlineDurationLabel
      ? String(req.body.deadlineDurationLabel)
      : null
    const { rows: appRows } = await getPool().query(
      `SELECT id, partner_id, public_code
       FROM applications WHERE public_code = $1
       ORDER BY created_at DESC LIMIT 1`,
      [publicCode],
    )
    if (!appRows[0]) {
      res.status(404).json({ error: 'Solicitud no encontrada.' })
      return
    }
    const track = normalizeCommentTrack(req.body?.track)
    const { rows } = await getPool().query(
      `INSERT INTO application_comments (
         application_id, author_role, author_name, body,
         referenced_docs, deadline_at, deadline_duration_label, track
       )
       VALUES ($1, 'coordinator', $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING id, author_role, author_name, body, referenced_docs, deadline_at,
                 deadline_duration_label, created_at, COALESCE(track, 'auditor') AS track`,
      [
        appRows[0].id,
        authorName,
        body,
        JSON.stringify(referencedDocs),
        deadlineAt || null,
        deadlineDurationLabel,
        track,
      ],
    )
    const who = authorEmail ? `${authorName} (${authorEmail})` : authorName
    const notifBits = []
    if (referencedDocs.length) {
      notifBits.push(`${referencedDocs.length} documento(s) observados`)
    }
    if (deadlineAt || deadlineDurationLabel) {
      notifBits.push(
        deadlineDurationLabel
          ? `plazo de corrección: ${deadlineDurationLabel}`
          : 'plazo de corrección asignado',
      )
    }
    await createPartnerNotification(appRows[0].partner_id, {
      title: track === 'commercial' ? 'Nuevo mensaje de Comercial' : 'Nuevo mensaje de Operaciones',
      body: notifBits.length
        ? `${who} comentó en tu solicitud ${appRows[0].public_code}: ${notifBits.join(' · ')}`
        : `${who} te envió un comentario sobre tu solicitud ${appRows[0].public_code}.`,
      link: '/dashboard/estado',
    })
    const partner = await loadPartnerForEmail(appRows[0].partner_id)
    if (partner) {
      const deadlineLabel = formatDeadlineLabel(deadlineAt, deadlineDurationLabel)
      const referencedLabels = referencedDocs.map((item) => labelDocSlot(item))
      queueEmail(() =>
        sendOpsObservationEmail(partner, {
          authorName: authorName || 'Operaciones',
          body,
          referencedDocs: referencedLabels,
          deadlineLabel,
          publicCode: appRows[0].public_code,
        }),
      )
    }
    res.status(201).json({
      comment: publicComment(rows[0]),
    })
  })

  app.get('/api/admin/auditor-requests', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const { rows } = await getPool().query(
      `SELECT r.id, r.status, r.created_at, r.reviewed_at, r.review_note,
              p.id AS partner_id, p.first_name, p.last_name, p.email
       FROM auditor_requests r
       JOIN partners p ON p.id = r.partner_id
       ORDER BY r.created_at DESC`,
    )
    res.json({ requests: rows })
  })

  app.post('/api/admin/auditor-requests/:id/review', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const status = req.body?.status === 'approved' ? 'approved' : 'rejected'
    const note = String(req.body?.note || '').trim() || null
    const { rows: requestRows } = await getPool().query(
      `UPDATE auditor_requests
       SET status = $1, review_note = $2, reviewed_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, note, req.params.id],
    )
    const request = requestRows[0]
    if (!request) {
      res.status(404).json({ error: 'Solicitud no encontrada.' })
      return
    }

    await getPool().query(
      `UPDATE partners
       SET auditor_request_status = $1,
           documents_unlocked = $2,
           role = CASE WHEN $1 = 'approved' THEN 'partner_auditor' ELSE role END,
           updated_at = now()
       WHERE id = $3`,
      [status, status === 'approved', request.partner_id],
    )

    const partner = await loadPartnerForEmail(request.partner_id)
    if (partner) {
      queueEmail(() =>
        sendAuditorRequestReviewedEmail(partner, {
          approved: status === 'approved',
          note,
        }),
      )
    }

    res.json({ ok: true, status })
  })

  app.get('/api/admin/document-reviews', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const { rows } = await getPool().query(
      `SELECT p.id AS partner_id, p.first_name, p.last_name, p.email,
              pr.review1_status, pr.review2_status,
              pr.review1_submitted_at, pr.review2_submitted_at
       FROM partner_profiles pr
       JOIN partners p ON p.id = pr.partner_id
       WHERE p.role = 'partner_auditor'
         AND (
           pr.review1_status IN ('sent', 'in_review', 'validated', 'approved', 'rejected')
           OR pr.review2_status IN ('sent', 'in_review', 'validated', 'approved', 'rejected')
         )
       ORDER BY COALESCE(pr.review2_submitted_at, pr.review1_submitted_at, pr.updated_at) DESC`,
    )
    res.json({ reviews: rows })
  })

  app.post('/api/admin/partners/:partnerId/whatsapp', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const partnerId = req.params.partnerId
    const raw = req.body?.url
    const url = raw == null || String(raw).trim() === '' ? '' : normalizeWhatsAppUrl(raw)
    if (String(raw || '').trim() && !url) {
      res.status(400).json({ error: 'El link debe ser de un grupo o chat de WhatsApp.' })
      return
    }
    const { rows } = await getPool().query(
      `UPDATE partner_profiles
       SET whatsapp_group_url = $1,
           whatsapp_confirmed_at = NULL,
           updated_at = now()
       WHERE partner_id = $2
       RETURNING *`,
      [url || null, partnerId],
    )
    if (!rows[0]) {
      res.status(404).json({ error: 'Perfil no encontrado.' })
      return
    }
    res.json({ profile: publicProfile(rows[0]) })
  })

  app.post('/api/admin/document-reviews/:partnerId/review', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const stageNum = Number(req.body?.stage)
    const stage = stageNum === 3 ? 3 : stageNum === 2 ? 2 : 1
    const rawStatus = String(req.body?.status || '').trim()
    const statusAlias = {
      approved: 'approved',
      rejected: 'rejected',
      sent: 'sent',
      in_review: 'in_review',
      validated: 'validated',
      pending: 'pending',
      ceo_signed: 'ceo_signed',
    }
    const status = statusAlias[rawStatus]
    if (!status || !PORTAL_REVIEW_STATUSES.has(status) || status === 'locked') {
      res.status(400).json({ error: 'Estado de revisión inválido.' })
      return
    }
    const partnerId = req.params.partnerId
    const docsPayload = Array.isArray(req.body?.documents) ? req.body.documents : []
    const reviewAlias = {
      approved: 'approved',
      rejected: 'rejected',
      pending: 'pending',
      aprobado: 'approved',
      rechazado: 'rejected',
      observado: 'rejected',
      pendiente: 'pending',
    }

    const { rows: profileRows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [partnerId],
    )
    if (!profileRows[0]) {
      res.status(404).json({ error: 'Perfil no encontrado.' })
      return
    }

    if (stage === 1) {
      const current = profileRows[0].review1_status
      if (current === 'pending' || current === 'locked') {
        res.status(400).json({ error: 'La revisión 1 aún no fue enviada por el partner.' })
        return
      }
      await getPool().query(
        `UPDATE partner_profiles
         SET review1_status = $1,
             review2_status = CASE
               WHEN $1 = 'approved' THEN
                 CASE
                   WHEN review2_status = 'locked' OR review2_status IS NULL THEN 'pending'
                   ELSE review2_status
                 END
               ELSE review2_status
             END,
             updated_at = now()
         WHERE partner_id = $2`,
        [status, partnerId],
      )
    } else if (stage === 3) {
      const current = profileRows[0].commercial_contract_status || 'pending'
      if (current === 'pending' || current === 'locked') {
        res.status(400).json({ error: 'El contrato comercial aún no fue enviado por el partner.' })
        return
      }
      await getPool().query(
        `UPDATE partner_profiles
         SET commercial_contract_status = $1, updated_at = now()
         WHERE partner_id = $2`,
        [status, partnerId],
      )
    } else {
      if (profileRows[0].review1_status !== 'approved') {
        res.status(400).json({
          error: 'Primero debe aprobarse la revisión 1.',
        })
        return
      }
      const current = profileRows[0].review2_status
      const review2Submitted = ['sent', 'in_review', 'validated', 'approved', 'rejected'].includes(
        current,
      )
      if (!review2Submitted) {
        res.status(400).json({ error: 'La revisión 2 aún no fue enviada por el partner.' })
        return
      }
      await getPool().query(
        `UPDATE partner_profiles
         SET review2_status = $1, updated_at = now()
         WHERE partner_id = $2`,
        [status, partnerId],
      )
    }

    const previousStatus =
      stage === 1
        ? profileRows[0].review1_status
        : stage === 3
          ? profileRows[0].commercial_contract_status
          : profileRows[0].review2_status
    const statusChanged = previousStatus !== status

    const stageCategories =
      stage === 3 ? ['commercial_contract'] : stage === 2 ? ['icf12'] : REVIEW1_DOC_CATEGORIES
    for (const item of docsPayload) {
      const category = String(item?.category || '').trim()
      const mappedReview = reviewAlias[String(item?.reviewStatus || item?.review_status || '').trim().toLowerCase()]
      if (!category || !mappedReview || !stageCategories.includes(category)) continue
      await getPool().query(
        `UPDATE documents
         SET review_status = $1
         WHERE partner_id = $2 AND category = $3`,
        [mappedReview, partnerId, category],
      )
    }
    if (status === 'approved') {
      await getPool().query(
        `UPDATE documents
         SET review_status = 'approved'
         WHERE partner_id = $1 AND category = ANY($2::text[])`,
        [partnerId, stageCategories],
      )
    }

    const { rows: appRows } = await getPool().query(
      `SELECT id FROM applications WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [partnerId],
    )
    if (statusChanged && appRows[0]) {
      const messageByStatus = {
        sent: stage === 1
          ? 'Recibimos tu documentación de la revisión 1.'
          : 'Recibimos el formato IC.F.1.2.',
        in_review:
          stage === 1
            ? 'Tu documentación de la revisión 1 está en revisión por Operaciones.'
            : 'Tu formato IC.F.1.2 está en revisión por Operaciones.',
        validated:
          stage === 1
            ? 'La documentación de la revisión 1 fue validada.'
            : 'El formato IC.F.1.2 fue validado.',
        approved:
          stage === 1
            ? 'La fase 1 fue aprobada. Ya puedes continuar con el formato IC.F.1.2.'
            : 'La fase 2 fue aprobada. Completaste el registro de auditor.',
        rejected:
          stage === 1
            ? 'La revisión 1 fue observada. Corrige los documentos marcados y vuelve a enviarla.'
            : 'La revisión 2 fue observada. Corrige el formato IC.F.1.2 y vuelve a enviarlo.',
      }
      const message = messageByStatus[status]
      if (message) {
        await getPool().query(
          `INSERT INTO application_comments (application_id, author_role, author_name, body)
           VALUES ($1, 'coordinator', 'Intercert Latam', $2)`,
          [appRows[0].id, message],
        )
      }
      if (stage === 2 && status === 'approved') {
        await getPool().query(`UPDATE applications SET status = 'approved' WHERE id = $1`, [
          appRows[0].id,
        ])
      }
      if (status === 'in_review' || status === 'validated' || status === 'sent') {
        await createPartnerNotification(partnerId, {
          title:
            status === 'in_review'
              ? 'Solicitud en revisión'
              : status === 'validated'
                ? 'Documentación validada'
                : 'Solicitud actualizada',
          body: message || 'Hay una actualización en el estado de tu solicitud.',
          link: '/dashboard/estado',
        })
      }
      if (status === 'approved' || status === 'rejected') {
        await createPartnerNotification(partnerId, {
          title: status === 'approved' ? 'Fase aprobada' : 'Documentos observados',
          body: message || 'Hay una actualización sobre tu solicitud.',
          link: '/dashboard/estado',
        })
      }
      const partner = await loadPartnerForEmail(partnerId)
      queuePartnerStatusEmails(partner, { stage, status })
    }

    res.json({ ok: true, stage, status })
  })

  app.post('/api/status/comments', requireAuth, async (req, res) => {
    if (!canUseAuditorPipeline(req.partner.role)) {
      res.status(403).json({ error: 'Los comentarios de validación no están disponibles para este rol.' })
      return
    }
    const text = String(req.body?.text || '').trim()
    const track = normalizeCommentTrack(req.body?.track)
    if (!text) {
      res.status(400).json({ error: 'Escribe un comentario.' })
      return
    }
    const { rows: appRows } = await getPool().query(
      `SELECT id, public_code FROM applications WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.partner.id],
    )
    if (!appRows[0]) {
      res.status(400).json({ error: 'Envía tu formulario antes de comentar con el coordinador.' })
      return
    }
    const name = `${req.partner.first_name} ${req.partner.last_name}`.trim() || 'Partner'
    const { rows } = await getPool().query(
      `INSERT INTO application_comments (application_id, author_role, author_name, body, track)
       VALUES ($1, 'applicant', $2, $3, $4)
       RETURNING id, author_role, author_name, body, referenced_docs, deadline_at,
                 deadline_duration_label, created_at, COALESCE(track, 'auditor') AS track`,
      [appRows[0].id, name, text, track],
    )
    await notifyHelpdeskPartnerComment({
      publicCode:
        track === 'commercial'
          ? `${appRows[0].public_code}-CONTRATO`
          : track === 'fase_2'
            ? `${appRows[0].public_code}-F2`
            : appRows[0].public_code,
      author: name,
      text,
    })
    res.status(201).json({
      comment: publicComment(rows[0]),
    })
  })

  app.get('/api/notifications', requireAuth, async (req, res) => {
    const { rows } = await getPool().query(
      `SELECT id, title, body, link, read_at, created_at
       FROM partner_notifications
       WHERE partner_id = $1
       ORDER BY created_at DESC
       LIMIT 40`,
      [req.partner.id],
    )
    const unreadCount = rows.filter((item) => !item.read_at).length
    res.json({
      unreadCount,
      notifications: rows.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        link: item.link || '/dashboard/estado',
        read: Boolean(item.read_at),
        createdAt: item.created_at,
      })),
    })
  })

  app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
    await getPool().query(
      `UPDATE partner_notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND partner_id = $2`,
      [req.params.id, req.partner.id],
    )
    res.json({ ok: true })
  })

  app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
    await getPool().query(
      `UPDATE partner_notifications
       SET read_at = COALESCE(read_at, now())
       WHERE partner_id = $1 AND read_at IS NULL`,
      [req.partner.id],
    )
    res.json({ ok: true })
  })

  app.put('/api/account/avatar', requireAuth, async (req, res) => {
    const image = String(req.body?.image || '')
    if (!isAvatarDataUrl(image)) {
      res.status(400).json({ error: 'La foto debe ser una imagen JPG, PNG o WEBP válida.' })
      return
    }
    const { rows } = await getPool().query(
      `UPDATE partners SET avatar_url = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [image, req.partner.id],
    )
    res.json({ user: publicUser(rows[0]) })
  })

  app.put('/api/account/contact', requireAuth, async (req, res) => {
    const documentId = String(req.body?.documentId || '').trim()
    const phone = String(req.body?.phone || '').trim()
    const phoneExtension = String(req.body?.phoneExtension || '').trim()
    const country = String(req.body?.country || '').trim()
    const { rows } = await getPool().query(
      `INSERT INTO partner_profiles (partner_id, document_id, phone, phone_extension, country, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (partner_id) DO UPDATE SET
         document_id = EXCLUDED.document_id,
         phone = EXCLUDED.phone,
         phone_extension = EXCLUDED.phone_extension,
         country = EXCLUDED.country,
         country_city = CASE
           WHEN EXCLUDED.country IS NULL OR EXCLUDED.country = '' THEN partner_profiles.country_city
           ELSE CONCAT_WS(' / ', EXCLUDED.country, partner_profiles.city)
         END,
         updated_at = now()
       RETURNING *`,
      [req.partner.id, documentId || null, phone || null, phoneExtension || null, country || null],
    )
    res.json({ profile: publicProfile(rows[0], req.partner) })
  })

  app.put('/api/account/password', requireAuth, async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '')
    const newPassword = String(req.body?.newPassword || '')
    const confirmPassword = String(req.body?.confirmPassword || '')
    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'Completa todos los campos de contraseña.' })
      return
    }
    if (!req.partner.password_hash) {
      res.status(400).json({ error: 'Esta cuenta no tiene contraseña para actualizar.' })
      return
    }
    const matches = await bcrypt.compare(currentPassword, req.partner.password_hash)
    if (!matches) {
      res.status(400).json({ error: 'La contraseña actual no es correcta.' })
      return
    }
    if (!isPasswordValid(newPassword)) {
      res.status(400).json({ error: 'La nueva contraseña no cumple los requisitos de seguridad.' })
      return
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Las contraseñas nuevas no coinciden.' })
      return
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: 'La nueva contraseña debe ser distinta a la actual.' })
      return
    }
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await getPool().query(
      `UPDATE partners SET password_hash = $1, updated_at = now() WHERE id = $2`,
      [passwordHash, req.partner.id],
    )
    res.json({ ok: true })
  })

  app.post('/api/account/email/send-code', requireAuth, async (req, res) => {
    if (req.partner.email_verified) {
      res.status(400).json({ error: 'Tu correo ya está verificado.' })
      return
    }
    const code = String(crypto.randomInt(100000, 1000000))
    const hash = hashEmailCode(code)
    await getPool().query(
      `UPDATE partners
       SET email_verify_code_hash = $1, email_verify_expires_at = now() + interval '15 minutes', updated_at = now()
       WHERE id = $2`,
      [hash, req.partner.id],
    )
    const mailed = await sendVerifyCodeEmail(req.partner, code)
    if (!mailed.sent) {
      console.info(`Código de verificación para ${req.partner.email}: ${code}`)
    }
    res.json({ sent: mailed.sent || true, previewCode: mailed.sent ? undefined : code })
  })

  app.post('/api/account/email/verify', requireAuth, async (req, res) => {
    const code = String(req.body?.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Ingresa un código de 6 dígitos.' })
      return
    }
    if (req.partner.email_verified) {
      res.json({ user: publicUser(req.partner) })
      return
    }
    if (!req.partner.email_verify_code_hash || !req.partner.email_verify_expires_at) {
      res.status(400).json({ error: 'Primero solicita un código de verificación.' })
      return
    }
    if (new Date(req.partner.email_verify_expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.' })
      return
    }
    const expected = hashEmailCode(code)
    const a = Buffer.from(String(req.partner.email_verify_code_hash))
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(400).json({ error: 'El código no es válido.' })
      return
    }
    const { rows } = await getPool().query(
      `UPDATE partners
       SET email_verified = true,
           email_verify_code_hash = NULL,
           email_verify_expires_at = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.partner.id],
    )
    res.json({ user: publicUser(rows[0]) })
  })

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' })
  })

  app.use((error, _req, res, _next) => {
    console.error(error)
    res.status(500).json({ error: 'Error interno del servidor.' })
  })

  startPartnerEmailJobs()

  return (req, res, next) => {
    if (!req.url?.startsWith('/api')) {
      next()
      return
    }
    return app(req, res, next)
  }
}
