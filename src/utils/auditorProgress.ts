import type { ProfessionalProfile } from '../api'

export function isPartnerAuditor(role: string) {
  return role === 'partner_auditor'
}

const REVIEW1_DOCS = ['cv', 'degree', 'lead_auditor_courses', 'audits_relation']

export type PipelineStepKey = 'sent' | 'in_review' | 'validated' | 'final'

export type PipelineStep = {
  key: PipelineStepKey
  label: string
  state: 'done' | 'active' | 'pending' | 'rejected'
}

export type AuditorPhaseTrack = {
  key: 'review1' | 'review2'
  label: string
  subtitle: string
  unlocked: boolean
  complete: boolean
  steps: PipelineStep[]
}

function review1DocsReady(documents: Array<{ category: string }>) {
  return REVIEW1_DOCS.every((category) => documents.some((doc) => doc.category === category))
}

/**
 * 4-step chain per phase:
 * Enviado → En revisión → Validada → Respuesta final
 *
 * - Enviado: auto al enviar desde el portal
 * - En revisión: cuando Operaciones pone en_revision
 * - Validada: cuando Operaciones pone validado
 * - Respuesta final: cuando Operaciones pone aprobado (o rechazado)
 */
function buildPipeline(status: string, unlocked: boolean): PipelineStep[] {
  const defs: Array<{ key: PipelineStepKey; label: string }> = [
    { key: 'sent', label: 'Enviado' },
    { key: 'in_review', label: 'En revisión' },
    { key: 'validated', label: 'Validada' },
    { key: 'final', label: 'Respuesta final' },
  ]

  if (!unlocked || status === 'pending' || status === 'locked') {
    return defs.map((d) => ({ ...d, state: 'pending' as const }))
  }

  // furthest reached index
  let furthest = 0
  if (status === 'sent') furthest = 0
  else if (status === 'in_review') furthest = 1
  else if (status === 'validated') furthest = 2
  else if (status === 'approved' || status === 'rejected') furthest = 3
  else furthest = 0

  const rejected = status === 'rejected'
  const fullyApproved = status === 'approved'

  return defs.map((def, index) => {
    if (index < furthest) return { ...def, state: 'done' as const }
    if (index > furthest) return { ...def, state: 'pending' as const }
    // index === furthest
    if (def.key === 'sent') return { ...def, state: 'done' as const }
    if (fullyApproved) return { ...def, state: 'done' as const }
    if (rejected && def.key === 'final') return { ...def, state: 'rejected' as const }
    return { ...def, state: 'active' as const }
  })
}

export function getAuditorProgress(
  profile: ProfessionalProfile,
  documents: Array<{ category: string }>,
) {
  let review1Status = profile.review1Status || (profile.submitted ? 'sent' : 'pending')
  // Legacy submits stored in_review immediately → treat as al menos enviado;
  // if still literally in_review without ops sync of "sent", keep in_review (both step1 done + step2 active)
  const review2Status = profile.review2Status || 'locked'
  const docsReady = review1DocsReady(documents)
  const icf12Ready = documents.some((doc) => doc.category === 'icf12')

  const review1Done = review1Status === 'approved'
  const review2Done = review2Status === 'approved'
  const review2Unlocked = review1Done

  const phaseTracks: AuditorPhaseTrack[] = [
    {
      key: 'review1',
      label: 'Fase 1 · Verificación de documentación',
      subtitle: 'CV, diploma, certificados y relación de auditorías',
      unlocked: true,
      complete: review1Done,
      steps: buildPipeline(review1Status, true),
    },
    {
      key: 'review2',
      label: 'Fase 2 · Registro de auditor (IC.F.1.2)',
      subtitle: 'Application and Auditor Registration - Initial',
      unlocked: review2Unlocked,
      complete: review2Done,
      steps: buildPipeline(review2Status, review2Unlocked),
    },
  ]

  const phases = phaseTracks.map((track) => {
    const active = track.steps.find((s) => s.state === 'active')
    const rejected = track.steps.find((s) => s.state === 'rejected')
    return {
      key: track.key,
      label: track.key === 'review1' ? 'Revisión 1' : 'Revisión 2',
      state: track.complete
        ? ('done' as const)
        : !track.unlocked
          ? ('pending' as const)
          : ('active' as const),
      detail: rejected
        ? 'Rechazada'
        : active
          ? active.label
          : track.complete
            ? 'Aprobada'
            : track.unlocked
              ? 'En curso'
              : 'Bloqueada',
    }
  })

  const submitted = ['sent', 'in_review', 'validated', 'approved', 'rejected'].includes(
    review1Status,
  )

  let percent = 5
  if (docsReady) percent = 15
  if (submitted) percent = 25
  if (review1Status === 'in_review') percent = 40
  if (review1Status === 'validated') percent = 50
  if (review1Done) percent = 55
  if (['sent', 'in_review', 'validated', 'approved', 'rejected'].includes(review2Status)) {
    percent = 70
  }
  if (review2Status === 'in_review') percent = 82
  if (review2Status === 'validated') percent = 92
  if (review2Done) percent = 100

  let headline = 'Completa la revisión de documentación'
  let description =
    'Adjunta CV, diploma, certificados de Auditor Líder, la relación de auditorías y el detalle de cada una.'
  let badge = 'Fase 1'

  if (review2Done) {
    headline = 'Registro aprobado'
    description = 'Las dos fases fueron aprobadas. Ya estás habilitado como Partner Auditor.'
    badge = 'Completado'
  } else if (review2Status === 'rejected') {
    headline = 'Formato IC.F.1.2 observado'
    description = 'Corrige el formato y vuelve a enviar la fase 2.'
    badge = 'Observado'
  } else if (review2Status === 'validated') {
    headline = 'Fase 2 validada'
    description = 'Operaciones validó tu formato. Pronto recibirás la respuesta final.'
    badge = 'Validada'
  } else if (review2Status === 'in_review') {
    headline = 'Fase 2 en revisión'
    description = 'Operaciones está revisando tu formato IC.F.1.2.'
    badge = 'En revisión'
  } else if (review2Status === 'sent') {
    headline = 'Formato IC.F.1.2 enviado'
    description = 'Tu solicitud de fase 2 fue enviada. Esperando que Operaciones la tome en revisión.'
    badge = 'Enviado'
  } else if (review1Done) {
    headline = 'Continúa con el formato IC.F.1.2'
    description =
      'Descarga Application and Auditor Registration - Initial, complétalo y vuelve a subirlo.'
    badge = 'Fase 2'
  } else if (review1Status === 'rejected') {
    headline = 'Documentación observada'
    description = 'Corrige los puntos observados y vuelve a enviar la revisión 1.'
    badge = 'Observado'
  } else if (review1Status === 'validated') {
    headline = 'Documentación validada'
    description = 'Operaciones validó tus documentos. Pronto recibirás la respuesta final de la fase 1.'
    badge = 'Validada'
  } else if (review1Status === 'in_review') {
    headline = 'Documentación en revisión'
    description = 'Operaciones está evaluando tus documentos y el historial de auditorías.'
    badge = 'En revisión'
  } else if (review1Status === 'sent') {
    headline = 'Documentación enviada'
    description = 'Tu solicitud fue enviada. Cuando Operaciones la tome, pasará a “En revisión”.'
    badge = 'Enviado'
  }

  const activity: string[] = []
  if (docsReady) activity.push('Documentos de la revisión 1 cargados.')
  if (submitted) activity.push('Revisión 1 enviada.')
  if (review1Status === 'in_review') activity.push('Revisión 1 en revisión por Operaciones.')
  if (review1Status === 'validated') activity.push('Revisión 1 validada.')
  if (review1Done) activity.push('Respuesta final de la revisión 1: aprobada. Fase 2 habilitada.')
  if (icf12Ready) activity.push('Formato IC.F.1.2 cargado.')
  if (['sent', 'in_review', 'validated', 'approved'].includes(review2Status)) {
    activity.push('Revisión 2 enviada.')
  }
  if (review2Status === 'in_review') activity.push('Revisión 2 en revisión por Operaciones.')
  if (review2Status === 'validated') activity.push('Revisión 2 validada.')
  if (review2Done) activity.push('Respuesta final de la revisión 2: aprobada. Registro completado.')
  if (activity.length === 0) {
    activity.push('Aún no hay avance. Completa la documentación de Partner Auditor.')
  }

  return {
    phases,
    phaseTracks,
    percent,
    headline,
    description,
    badge,
    submitted,
    step: review1Done ? 2 : 1,
    activity,
    review1Status,
    review2Status,
    review1Docs: docsReady,
    icf12Ready,
    review1Done,
    review2Done,
    datos: docsReady,
    formacion: docsReady,
    documentos: docsReady,
  }
}
