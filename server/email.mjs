const RESEND_API_URL = 'https://api.resend.com/emails'

function apiKey() {
  const key = String(process.env.RESEND_API_KEY || '').trim()
  if (!key || key.startsWith('re_local')) return ''
  return key
}

export function isEmailConfigured() {
  return Boolean(apiKey())
}

export function portalBaseUrl() {
  return String(process.env.PORTAL_PUBLIC_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

function fromAddress() {
  const email = String(process.env.FROM_EMAIL || 'support@intercertlatam.com').trim()
  return `Portal Partners Intercert <${email}>`
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nl2br(value) {
  return escapeHtml(value).replace(/\r\n|\n|\r/g, '<br />')
}

export function roleLabel(role) {
  return role === 'afiliado' ? 'Afiliado' : 'Partner Auditor'
}

export const REVIEW_STATUS_LABELS = {
  pending: 'Pendiente de envío',
  sent: 'Enviada',
  in_review: 'En revisión',
  validated: 'Validada',
  approved: 'Aprobada',
  rejected: 'Observada',
  locked: 'Bloqueada',
}

export function reviewStatusLabel(status) {
  return REVIEW_STATUS_LABELS[status] || String(status || 'Actualizada')
}

function layout({ title, greeting, intro, extraHtml = '', ctaLabel, ctaHref, footerNote }) {
  const safeTitle = escapeHtml(title)
  const safeGreeting = escapeHtml(greeting)
  const cta = ctaLabel && ctaHref
    ? `<p style="margin: 28px 0 8px; text-align: center;">
        <a href="${escapeHtml(ctaHref)}" style="display: inline-block; background: #0a165e; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 22px; border-radius: 8px;">
          ${escapeHtml(ctaLabel)}
        </a>
      </p>`
    : ''
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #f8fafc; padding: 24px 16px;">
    <div style="background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(10, 22, 94, 0.08);">
      <div style="background: linear-gradient(135deg, #0a165e 0%, #159dbc 100%); padding: 28px 24px; text-align: center;">
        <p style="margin: 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.85); font-weight: 600;">INTERCERT LATAM</p>
        <h1 style="margin: 10px 0 0; font-size: 22px; line-height: 1.35; color: #ffffff; font-weight: 700;">${safeTitle}</h1>
      </div>
      <div style="padding: 28px 24px;">
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hola <strong>${safeGreeting}</strong>,</p>
        <div style="margin: 0 0 8px; font-size: 15px; line-height: 1.6;">${intro}</div>
        ${extraHtml}
        ${cta}
      </div>
      <div style="background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">${escapeHtml(footerNote || '© Intercert LATAM · Portal Partners')}</p>
      </div>
    </div>
  </div>`
}

export async function sendEmail({ to, subject, html }) {
  const key = apiKey()
  const recipient = String(to || '').trim()
  if (!recipient) return { sent: false, reason: 'missing_to' }
  if (!key) {
    console.warn(`[email] RESEND_API_KEY no configurada — omitiendo "${subject}" a ${recipient}`)
    return { sent: false, reason: 'not_configured' }
  }
  try {
    const resp = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [recipient],
        subject,
        html,
      }),
    })
    const payload = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      console.warn('[email] Resend error', resp.status, payload)
      return { sent: false, reason: payload?.message || `http_${resp.status}` }
    }
    console.info(`[email] enviado a ${recipient}: ${subject}`)
    return { sent: true, id: payload?.id }
  } catch (err) {
    console.warn('[email] fallo', err?.message || err)
    return { sent: false, reason: err?.message || 'send_failed' }
  }
}

export function queueEmail(task) {
  Promise.resolve()
    .then(() => task())
    .catch((err) => {
      console.warn('[email]', err?.message || err)
    })
}

function displayName(partner) {
  const name = `${partner?.first_name || partner?.firstName || ''} ${partner?.last_name || partner?.lastName || ''}`.trim()
  return name || 'Partner'
}

function dashboardUrl(path = '/dashboard') {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${portalBaseUrl()}${suffix}`
}

export async function sendWelcomePendingDocsEmail(partner) {
  const name = displayName(partner)
  const role = roleLabel(partner.role)
  const html = layout({
    title: 'Bienvenido a Portal Partners',
    greeting: name,
    intro: `
      <p style="margin: 0 0 12px;">Tu cuenta de <strong>${escapeHtml(role)}</strong> fue creada correctamente.</p>
      <p style="margin: 0;">Aún tienes <strong>pendiente enviar tu documentación</strong> para que Operaciones pueda revisar tu solicitud. Completa tu perfil, adjunta los archivos requeridos y envía la fase 1 cuando estén listos.</p>
    `,
    extraHtml: `
      <div style="background: #f1f5f9; border-left: 4px solid #159dbc; border-radius: 8px; padding: 16px 18px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #0a165e;">Documentos de la fase 1</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.55;">CV actualizado, diploma, certificados de Auditor Líder y relación de auditorías.</p>
      </div>
    `,
    ctaLabel: 'Completar documentación',
    ctaHref: dashboardUrl('/dashboard/perfil'),
  })
  return sendEmail({
    to: partner.email,
    subject: 'Bienvenido — pendiente enviar tu documentación | Portal Partners',
    html,
  })
}

export async function sendDocsReminderEmail(partner) {
  const name = displayName(partner)
  const role = roleLabel(partner.role)
  const html = layout({
    title: 'Recordatorio: documentación pendiente',
    greeting: name,
    intro: `
      <p style="margin: 0 0 12px;">Como <strong>${escapeHtml(role)}</strong> todavía no has enviado tu documentación al equipo de Operaciones.</p>
      <p style="margin: 0;">Ingresa al portal, carga los archivos requeridos y envía tu solicitud para continuar con la revisión.</p>
    `,
    ctaLabel: 'Enviar mis documentos',
    ctaHref: dashboardUrl('/dashboard/perfil'),
  })
  return sendEmail({
    to: partner.email,
    subject: 'Recordatorio: tienes documentos pendientes por enviar | Portal Partners',
    html,
  })
}

export async function sendOpsObservationEmail(partner, { authorName, body, referencedDocs = [], deadlineLabel, publicCode }) {
  const name = displayName(partner)
  const docs = (referencedDocs || []).filter(Boolean)
  const docsHtml = docs.length
    ? `<p style="margin: 16px 0 0; font-size: 14px;"><strong>Documentos observados:</strong> ${escapeHtml(docs.join(', '))}</p>`
    : ''
  const deadlineHtml = deadlineLabel
    ? `<p style="margin: 8px 0 0; font-size: 14px;"><strong>Plazo de corrección:</strong> ${escapeHtml(deadlineLabel)}</p>`
    : ''
  const codeHtml = publicCode
    ? `<p style="margin: 0 0 12px; font-size: 14px; color: #64748b;">Solicitud ${escapeHtml(publicCode)}</p>`
    : ''
  const html = layout({
    title: 'Nueva observación de Operaciones',
    greeting: name,
    intro: `
      ${codeHtml}
      <p style="margin: 0;">El área de Operaciones te envió un comentario sobre tu solicitud. Revísalo en el chat de estado y responde o corrige lo indicado.</p>
    `,
    extraHtml: `
      <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #159dbc; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; font-weight: 700;">${escapeHtml(authorName || 'Operaciones')}</p>
        <div style="font-size: 14px; line-height: 1.55;">${nl2br(body)}</div>
        ${docsHtml}
        ${deadlineHtml}
      </div>
    `,
    ctaLabel: 'Ver el chat de mi solicitud',
    ctaHref: dashboardUrl('/dashboard/estado'),
  })
  return sendEmail({
    to: partner.email,
    subject: `Operaciones te envió una observación${publicCode ? ` (${publicCode})` : ''} | Portal Partners`,
    html,
  })
}

export async function sendStatusChangeEmail(partner, { stage, status, message }) {
  const name = displayName(partner)
  const statusText = reviewStatusLabel(status)
  const phase = Number(stage) === 2 ? 'Fase 2' : 'Fase 1'
  const html = layout({
    title: `Actualización de tu solicitud · ${phase}`,
    greeting: name,
    intro: `
      <p style="margin: 0 0 12px;">El estado de tu <strong>${escapeHtml(phase)}</strong> cambió a <strong>${escapeHtml(statusText)}</strong>.</p>
      <p style="margin: 0;">${escapeHtml(message || 'Hay una actualización en el seguimiento de tu registro.')}</p>
    `,
    extraHtml: `
      <div style="background: #f1f5f9; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>Nuevo estado:</strong> ${escapeHtml(statusText)}</p>
      </div>
    `,
    ctaLabel: 'Ver estado de la solicitud',
    ctaHref: dashboardUrl('/dashboard/estado'),
  })
  return sendEmail({
    to: partner.email,
    subject: `${phase} ${statusText.toLowerCase()} | Portal Partners`,
    html,
  })
}

export async function sendDocsApprovedEmail(partner, { stage }) {
  const name = displayName(partner)
  const isFase2 = Number(stage) === 2
  const intro = isFase2
    ? `
      <p style="margin: 0 0 12px;">¡Felicitaciones! El equipo de Operaciones <strong>aprobó tus documentos</strong> y completaste el registro de auditor.</p>
      <p style="margin: 0;">Estos son los siguientes pasos para continuar con Intercert:</p>
    `
    : `
      <p style="margin: 0 0 12px;">¡Felicitaciones! La <strong>fase 1</strong> de tu documentación fue aprobada.</p>
      <p style="margin: 0;">Sigue con estos pasos para habilitar la fase 2:</p>
    `
  const steps = isFase2
    ? [
        'Revisa las capacitaciones pendientes en el Centro de Capacitación.',
        'Completa los videos de Operaciones y Comercial.',
        'Mantén tu perfil y expediente actualizados.',
        'Coordina con tu comercial a cargo cualquier siguiente gestión.',
      ]
    : [
        'Descarga el formato IC.F.1.2 Application and Auditor Registration.',
        'Complétalo y súbelo en la sección de fase 2.',
        'Envía la fase 2 para que Operaciones la revise.',
      ]
  const items = steps
    .map(
      (step, index) =>
        `<li style="margin: 0 0 8px; font-size: 14px; line-height: 1.5;"><strong>${index + 1}.</strong> ${escapeHtml(step)}</li>`,
    )
    .join('')
  const html = layout({
    title: isFase2 ? 'Documentos aprobados' : 'Fase 1 aprobada',
    greeting: name,
    intro,
    extraHtml: `
      <ol style="margin: 20px 0 8px; padding-left: 20px; color: #1e293b;">${items}</ol>
    `,
    ctaLabel: isFase2 ? 'Ir a capacitaciones' : 'Continuar con la fase 2',
    ctaHref: dashboardUrl(isFase2 ? '/dashboard/capacitacion' : '/dashboard/perfil'),
  })
  return sendEmail({
    to: partner.email,
    subject: isFase2
      ? '¡Felicitaciones! Tus documentos fueron aprobados | Portal Partners'
      : 'Fase 1 aprobada — siguientes pasos | Portal Partners',
    html,
  })
}

export async function sendTrainingPendingEmail(partner) {
  const name = displayName(partner)
  const html = layout({
    title: 'Capacitación pendiente',
    greeting: name,
    intro: `
      <p style="margin: 0 0 12px;">Tienes <strong>capacitaciones pendientes</strong> por revisar en el portal.</p>
      <p style="margin: 0;">En el Centro de Capacitación encontrarás materiales de Operaciones (flujo ISO, gestión de clientes) y Comercial (speech de ventas y cotización).</p>
    `,
    extraHtml: `
      <div style="background: #f1f5f9; border-left: 4px solid #0a165e; border-radius: 8px; padding: 16px 18px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; line-height: 1.55;">Completar estas capacitaciones te permite operar con los procesos vigentes de Intercert Latam.</p>
      </div>
    `,
    ctaLabel: 'Ver capacitaciones',
    ctaHref: dashboardUrl('/dashboard/capacitacion'),
  })
  return sendEmail({
    to: partner.email,
    subject: 'Tienes una capacitación pendiente por ver | Portal Partners',
    html,
  })
}

export async function sendVerifyCodeEmail(partner, code) {
  const name = displayName(partner)
  const html = layout({
    title: 'Código de verificación',
    greeting: name,
    intro: `<p style="margin: 0;">Usa este código para verificar tu correo en Portal Partners. Caduca en 15 minutos.</p>`,
    extraHtml: `
      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 28px; letter-spacing: 8px; font-weight: 800; color: #0a165e;">${escapeHtml(code)}</p>
      </div>
    `,
    ctaLabel: 'Abrir configuración',
    ctaHref: dashboardUrl('/dashboard/configuracion'),
  })
  return sendEmail({
    to: partner.email,
    subject: 'Tu código de verificación | Portal Partners',
    html,
  })
}

export async function sendAuditorRequestReviewedEmail(partner, { approved, note }) {
  const name = displayName(partner)
  const html = layout({
    title: approved ? 'Solicitud de Partner Auditor aprobada' : 'Solicitud de Partner Auditor no aprobada',
    greeting: name,
    intro: approved
      ? `<p style="margin: 0;">Tu solicitud para ser Partner Auditor fue <strong>aprobada</strong>. Ya puedes completar y enviar tu documentación.</p>`
      : `<p style="margin: 0;">Por ahora tu solicitud para ser Partner Auditor <strong>no fue aprobada</strong>. Puedes volver a enviarla más adelante.</p>`,
    extraHtml: note
      ? `<div style="background: #f8fafc; padding: 15px; border-left: 4px solid #159dbc; margin: 20px 0; border-radius: 4px; font-size: 14px;">${nl2br(note)}</div>`
      : '',
    ctaLabel: approved ? 'Completar documentación' : 'Ir al dashboard',
    ctaHref: dashboardUrl(approved ? '/dashboard/perfil' : '/dashboard'),
  })
  return sendEmail({
    to: partner.email,
    subject: approved
      ? 'Tu solicitud de Partner Auditor fue aprobada | Portal Partners'
      : 'Actualización de tu solicitud de Partner Auditor | Portal Partners',
    html,
  })
}
