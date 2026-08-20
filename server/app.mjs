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
  isAllowedExtension,
  isR2Configured,
  r2Config,
  uploadToR2,
} from './r2.mjs'

dotenv.config()

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

let pool

function getPool() {
  if (!pool) {
    dotenv.config()
    pool = new pg.Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
    })
  }
  return pool
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

function isAuditComplete(audit) {
  const days = Number(audit.days)
  return Boolean(
    String(audit.organization || '').trim() &&
      String(audit.standard || '').trim() &&
      String(audit.startDate || audit.start_date || '').trim() &&
      String(audit.endDate || audit.end_date || '').trim() &&
      Number.isFinite(days) &&
      days > 0 &&
      String(audit.auditType || audit.audit_type || '').trim() &&
      String(audit.role || '').trim() &&
      String(audit.iafCode || audit.iaf_code || '').trim(),
  )
}

function reviewFrozen(status) {
  return status === 'in_review' || status === 'approved'
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
        'audits_relation', 'icf12'
      ))
  `)
  await getPool().query(`
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
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
  `)
  await getPool().query(`
    UPDATE partner_profiles
    SET review1_status = 'in_review',
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
])
const SINGLE_DOCUMENT_CATEGORIES = new Set([
  'cv',
  'identity',
  'background',
  'degree',
  'data_treatment',
  'audits_relation',
  'icf12',
])
const REVIEW1_DOC_CATEGORIES = ['cv', 'degree', 'lead_auditor_courses', 'audits_relation']
const PDF_ONLY_CATEGORIES = new Set(['cv', 'data_treatment', 'audits_relation'])

async function getReviewStatuses(partnerId) {
  const { rows } = await getPool().query(
    'SELECT review1_status, review2_status FROM partner_profiles WHERE partner_id = $1',
    [partnerId],
  )
  return {
    review1Status: rows[0]?.review1_status || 'pending',
    review2Status: rows[0]?.review2_status || 'locked',
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
      res.status(500).json({ error: 'No se pudo conectar con la base de datos.' })
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

    if (!firstName || !lastName || !email) {
      res.status(400).json({ error: 'Completa todos los campos requeridos.' })
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
      const documentsUnlocked = role === 'partner_auditor'
      const { rows } = await getPool().query(
        `INSERT INTO partners
          (first_name, last_name, email, password_hash, role, auditor_request_status, documents_unlocked, terms_accepted_at)
         VALUES ($1, $2, $3, $4, $5, 'none', $6, now())
         RETURNING *`,
        [firstName, lastName, email, passwordHash, role, documentsUnlocked],
      )

      const user = publicUser(rows[0])
      const token = signToken({ id: user.id })
      setSessionCookies(res, user, token)
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
    if (req.partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'La carga de documentos es exclusiva para Partner Auditor.' })
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
      if (!isAllowedExtension(req.file.originalname)) {
        res.status(400).json({
          error: `Extensión no permitida. Usa: ${r2Config().allowedExtensions.join(', ')}.`,
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
      if (category === 'icf12' && reviewFrozen(reviews.review2Status)) {
        res.status(403).json({ error: 'La revisión 2 ya fue enviada y no se puede modificar.' })
        return
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
         RETURNING id, category, file_name, file_size, status`,
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
      res.status(201).json({ document: rows[0] })
    } catch (error) {
      console.error(error)
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

  app.post('/api/documents/submit', requireAuth, async (req, res) => {
    const partner = req.partner
    if (partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'Este envío es exclusivo para Partner Auditor.' })
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
      `SELECT id, category, file_name, file_size, status
       FROM documents WHERE partner_id = $1 ORDER BY created_at`,
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
          `SELECT id, author_role, author_name, body, created_at
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
      comments: comments.map((item) => ({
        id: item.id,
        authorRole: item.author_role,
        authorName: item.author_name,
        body: item.body,
        createdAt: item.created_at,
      })),
    })
  })

  app.put('/api/profile', requireAuth, async (req, res) => {
    if (req.partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'Este formulario solo está disponible para Partner Auditor.' })
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

  app.post('/api/profile/submit', requireAuth, async (req, res) => {
    if (req.partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'Este formulario solo está disponible para Partner Auditor.' })
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
    if (req.partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'Esta sección es exclusiva para Partner Auditor.' })
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
    if (req.partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'Este envío es exclusivo para Partner Auditor.' })
      return
    }
    const reviews = await getReviewStatuses(req.partner.id)
    if (reviewFrozen(reviews.review1Status)) {
      res.status(400).json({ error: 'La revisión 1 ya está en curso o fue aprobada.' })
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

    const { rows: audits } = await getPool().query(
      `SELECT * FROM auditor_audits WHERE partner_id = $1`,
      [req.partner.id],
    )
    const completeAudits = audits.filter((row) =>
      isAuditComplete({
        organization: row.organization,
        standard: row.standard,
        startDate: row.start_date,
        endDate: row.end_date,
        days: row.days,
        auditType: row.audit_type,
        role: row.role,
        iafCode: row.iaf_code,
      }),
    )
    if (!completeAudits.length) {
      res.status(400).json({
        error: 'Registra al menos una auditoría con organización, norma, fechas, días, tipo, rol y código IAF.',
      })
      return
    }

    await ensurePartnerProfile(req.partner.id)
    await getPool().query(
      `UPDATE partner_profiles
       SET review1_status = 'in_review',
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
    res.json({
      user: publicUser(partnerRows[0]),
      profile: publicProfile(profileRows[0], partnerRows[0]),
      publicCode: application.public_code,
    })
  })

  app.post('/api/profile/review2/submit', requireAuth, async (req, res) => {
    if (req.partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'Este envío es exclusivo para Partner Auditor.' })
      return
    }
    const reviews = await getReviewStatuses(req.partner.id)
    if (reviews.review1Status !== 'approved') {
      res.status(403).json({ error: 'La revisión 2 se habilita cuando se apruebe la revisión 1.' })
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
      `UPDATE partner_profiles
       SET review2_status = 'in_review',
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
    res.json({
      user: publicUser(partnerRows[0]),
      profile: publicProfile(profileRows[0], partnerRows[0]),
      publicCode: application.public_code,
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
           pr.review1_status IN ('in_review', 'approved', 'rejected')
           OR pr.review2_status IN ('in_review', 'approved', 'rejected')
         )
       ORDER BY COALESCE(pr.review2_submitted_at, pr.review1_submitted_at, pr.updated_at) DESC`,
    )
    res.json({ reviews: rows })
  })

  app.post('/api/admin/document-reviews/:partnerId/review', async (req, res) => {
    if (req.headers['x-admin-token'] !== adminToken()) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const stage = Number(req.body?.stage) === 2 ? 2 : 1
    const status = req.body?.status === 'approved' ? 'approved' : 'rejected'
    const partnerId = req.params.partnerId

    const { rows: profileRows } = await getPool().query(
      'SELECT * FROM partner_profiles WHERE partner_id = $1',
      [partnerId],
    )
    if (!profileRows[0]) {
      res.status(404).json({ error: 'Perfil no encontrado.' })
      return
    }

    if (stage === 1) {
      if (profileRows[0].review1_status !== 'in_review' && profileRows[0].review1_status !== 'rejected') {
        res.status(400).json({ error: 'Esta revisión 1 no está lista para aprobar o rechazar.' })
        return
      }
      await getPool().query(
        `UPDATE partner_profiles
         SET review1_status = $1,
             review2_status = CASE WHEN $1 = 'approved' THEN 'pending' ELSE 'locked' END,
             updated_at = now()
         WHERE partner_id = $2`,
        [status, partnerId],
      )
    } else {
      if (profileRows[0].review1_status !== 'approved') {
        res.status(400).json({ error: 'Primero debe aprobarse la revisión 1.' })
        return
      }
      if (profileRows[0].review2_status !== 'in_review' && profileRows[0].review2_status !== 'rejected') {
        res.status(400).json({ error: 'Esta revisión 2 no está lista para aprobar o rechazar.' })
        return
      }
      await getPool().query(
        `UPDATE partner_profiles
         SET review2_status = $1, updated_at = now()
         WHERE partner_id = $2`,
        [status, partnerId],
      )
    }

    const { rows: appRows } = await getPool().query(
      `SELECT id FROM applications WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [partnerId],
    )
    if (appRows[0]) {
      const message =
        stage === 1
          ? status === 'approved'
            ? 'La revisión 1 de documentación fue aprobada. Ya puedes descargar, completar y subir el formato IC.F.1.2 Application and Auditor Registration - Initial.'
            : 'La revisión 1 de documentación no fue aprobada. Corrige los puntos observados y vuelve a enviarla.'
          : status === 'approved'
            ? 'El formato IC.F.1.2 Application and Auditor Registration - Initial fue aprobado. Completaste las dos revisiones.'
            : 'El formato IC.F.1.2 no fue aprobado. Descárgalo de nuevo, corrígelo y vuelve a subirlo.'
      await getPool().query(
        `INSERT INTO application_comments (application_id, author_role, author_name, body)
         VALUES ($1, 'coordinator', 'Intercert Latam', $2)`,
        [appRows[0].id, message],
      )
      if (stage === 2 && status === 'approved') {
        await getPool().query(
          `UPDATE applications SET status = 'approved' WHERE id = $1`,
          [appRows[0].id],
        )
      }
    }

    res.json({ ok: true, stage, status })
  })

  app.post('/api/status/comments', requireAuth, async (req, res) => {
    if (req.partner.role !== 'partner_auditor') {
      res.status(403).json({ error: 'Los comentarios de validación son para Partner Auditor.' })
      return
    }
    const text = String(req.body?.text || '').trim()
    if (!text) {
      res.status(400).json({ error: 'Escribe un comentario.' })
      return
    }
    const { rows: appRows } = await getPool().query(
      `SELECT id FROM applications WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.partner.id],
    )
    if (!appRows[0]) {
      res.status(400).json({ error: 'Envía tu formulario antes de comentar con el coordinador.' })
      return
    }
    const name = `${req.partner.first_name} ${req.partner.last_name}`.trim() || 'Partner'
    const { rows } = await getPool().query(
      `INSERT INTO application_comments (application_id, author_role, author_name, body)
       VALUES ($1, 'applicant', $2, $3)
       RETURNING id, author_role, author_name, body, created_at`,
      [appRows[0].id, name, text],
    )
    res.status(201).json({
      comment: {
        id: rows[0].id,
        authorRole: rows[0].author_role,
        authorName: rows[0].author_name,
        body: rows[0].body,
        createdAt: rows[0].created_at,
      },
    })
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
    console.info(`Código de verificación para ${req.partner.email}: ${code}`)
    res.json({ sent: true, previewCode: code })
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

  return (req, res, next) => {
    if (!req.url?.startsWith('/api')) {
      next()
      return
    }
    return app(req, res, next)
  }
}
