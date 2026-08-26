import type { ProfessionalProfile } from '../api'

export function isPartnerAuditor(role: string) {
  return role === 'partner_auditor'
}

const REVIEW1_DOCS = ['cv', 'degree', 'lead_auditor_courses', 'audits_relation']

export type PipelineStepKey = 'sent' | 'in_review' | 'validated'

export type DocReviewOutcome = {
  category: string
  label: string
  fileName?: string
  status: 'approved' | 'rejected' | 'pending'
}

export type PipelineStep = {
  key: PipelineStepKey
  label: string
  state: 'done' | 'active' | 'pending' | 'rejected'
  docs?: DocReviewOutcome[]
}

export type AuditorPhaseTrack = {
  key: 'review1' | 'review2'
  label: string
  subtitle: string
  unlocked: boolean
  complete: boolean
  steps: PipelineStep[]
}

export type JourneyStepState = 'done' | 'active' | 'pending' | 'locked' | 'rejected'

export type JourneyStep = {
  key: 'account' | 'profile' | 'documents' | 'review1' | 'icf12' | 'approved'
  label: string
  hint: string
  state: JourneyStepState
  fillPercent?: number
  href?: string
  shine?: boolean
}

export const DEFAULT_JOURNEY: JourneyStep[] = [
  { key: 'account', label: 'Cuenta', hint: 'Registro completado', state: 'done' },
  { key: 'profile', label: 'Perfil', hint: 'Datos personales', state: 'active' },
  {
    key: 'documents',
    label: 'Documentos',
    hint: 'CV y evidencias',
    state: 'pending',
    fillPercent: 0,
    href: '/dashboard/perfil',
  },
  { key: 'review1', label: 'Fase 1', hint: 'Verificación', state: 'pending' },
  { key: 'icf12', label: 'IC.F.1.2', hint: 'Formato de registro', state: 'locked' },
  { key: 'approved', label: 'Aprobado', hint: 'Partner habilitado', state: 'pending' },
]

const REVIEW1_DOC_LABELS: Record<string, string> = {
  cv: 'CV documentado y actualizado',
  degree: 'Diploma de estudio técnico o universitario',
  lead_auditor_courses: 'Certificados de Auditor Líder',
  audits_relation: 'Relación de auditorías',
  icf12: 'Formato IC.F.1.2',
}

function review1DocsReady(documents: Array<{ category: string }>) {
  return REVIEW1_DOCS.every((category) => documents.some((doc) => doc.category === category))
}

function docOutcomeStatus(raw: string | undefined) {
  if (raw === 'approved' || raw === 'aprobado') return 'approved' as const
  if (raw === 'rejected' || raw === 'rechazado' || raw === 'observed') return 'rejected' as const
  return 'pending' as const
}

function phaseDocOutcomes(
  categories: string[],
  documents: Array<{ category: string; file_name?: string; review_status?: string; reviewStatus?: string; status?: string }>,
): DocReviewOutcome[] {
  return categories.map((category) => {
    const match = documents.find((doc) => doc.category === category)
    const raw = match?.review_status || match?.reviewStatus || ''
    return {
      category,
      label: REVIEW1_DOC_LABELS[category] || category,
      fileName: match?.file_name,
      status: docOutcomeStatus(raw),
    }
  })
}

/**
 * 3-step chain per phase:
 * Enviado → En revisión → Validada
 *
 * - Enviado: auto al enviar desde el portal
 * - En revisión: cuando Operaciones toma la solicitud
 * - Validada: check verde si Operaciones aprueba; X roja si marca Observado
 */
function buildPipeline(status: string, unlocked: boolean, docs: DocReviewOutcome[] = []): PipelineStep[] {
  const defs: Array<{ key: PipelineStepKey; label: string }> = [
    { key: 'sent', label: 'Enviado' },
    { key: 'in_review', label: 'En revisión' },
    { key: 'validated', label: 'Validada' },
  ]

  if (!unlocked || status === 'pending' || status === 'locked') {
    return defs.map((d) => ({
      ...d,
      state: 'pending' as const,
      docs: d.key === 'validated' ? docs : undefined,
    }))
  }

  let furthest = 0
  if (status === 'sent') furthest = 0
  else if (status === 'in_review') furthest = 1
  else if (status === 'validated') furthest = 2
  else if (status === 'approved' || status === 'rejected') furthest = 2
  else furthest = 0

  const observed = status === 'rejected'
  const fullyApproved = status === 'approved'

  return defs.map((def, index) => {
    const reached = index <= furthest
    const withDocs = reached ? docs : undefined
    if (index < furthest) return { ...def, state: 'done' as const, docs: withDocs }
    if (index > furthest) return { ...def, state: 'pending' as const, docs: withDocs }
    if (def.key === 'sent') return { ...def, state: 'done' as const, docs: withDocs }
    if (def.key === 'validated' && observed) {
      return { ...def, state: 'rejected' as const, docs: withDocs }
    }
    if (def.key === 'validated' && fullyApproved) {
      return { ...def, state: 'done' as const, docs: withDocs }
    }
    if (fullyApproved) return { ...def, state: 'done' as const, docs: withDocs }
    return { ...def, state: 'active' as const, docs: withDocs }
  })
}

export function getAuditorProgress(
  profile: ProfessionalProfile,
  documents: Array<{
    category: string
    file_name?: string
    review_status?: string
    reviewStatus?: string
    status?: string
  }>,
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

  const review1Docs = phaseDocOutcomes(REVIEW1_DOCS, documents)
  const review2Docs = phaseDocOutcomes(['icf12'], documents)

  const phaseTracks: AuditorPhaseTrack[] = [
    {
      key: 'review1',
      label: 'Fase 1 · Verificación de documentación',
      subtitle: 'CV, diploma, certificados y relación de auditorías',
      unlocked: true,
      complete: review1Done,
      steps: buildPipeline(review1Status, true, review1Docs),
    },
    {
      key: 'review2',
      label: 'Fase 2 · Registro de auditor (IC.F.1.2)',
      subtitle: 'Application and Auditor Registration - Initial',
      unlocked: review2Unlocked,
      complete: review2Done,
      steps: buildPipeline(review2Status, review2Unlocked, review2Docs),
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
    description = 'Operaciones validó tu formato. Pendiente de aprobación.'
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
    description = 'Operaciones validó tus documentos. Pendiente de aprobación de la fase 1.'
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

  const profileStarted = Boolean(profile.documentId || profile.phone || profile.country)
  const review1Started = ['sent', 'in_review', 'validated', 'approved', 'rejected'].includes(
    review1Status,
  )
  const review2Started = ['sent', 'in_review', 'validated', 'approved', 'rejected'].includes(
    review2Status,
  )

  const documentsFill = review2Done
    ? 100
    : review2Started || icf12Ready
      ? 60
      : review1Done
        ? 40
        : review1Started
          ? 20
          : 0

  const journey: JourneyStep[] = [
    {
      key: 'account',
      label: 'Cuenta',
      hint: 'Registro completado',
      state: 'done',
    },
    {
      key: 'profile',
      label: 'Perfil',
      hint: 'Datos personales',
      state: profileStarted ? 'done' : 'pending',
    },
    {
      key: 'documents',
      label: 'Documentos',
      hint: documentsFill === 0 ? 'Sube tu documentación' : 'Avance de documentación',
      state: documentsFill >= 100 ? 'done' : 'pending',
      fillPercent: documentsFill,
      href: documentsFill === 0 ? '/dashboard/perfil' : '/dashboard/estado',
    },
    {
      key: 'review1',
      label: 'Fase 1',
      hint: 'Verificación',
      state: review1Done ? 'done' : review1Status === 'rejected' ? 'rejected' : 'pending',
    },
    {
      key: 'icf12',
      label: 'IC.F.1.2',
      hint: 'Formato de registro',
      state: !review1Done ? 'locked' : review2Done ? 'done' : 'pending',
    },
    {
      key: 'approved',
      label: 'Aprobado',
      hint: 'Partner habilitado',
      state: review2Done ? 'done' : review2Status === 'rejected' ? 'rejected' : 'pending',
    },
  ]

  const currentKey =
    !profileStarted && documentsFill === 0
      ? 'profile'
      : documentsFill < 100
        ? 'documents'
        : journey.find((step) => step.state === 'pending')?.key || null

  if (currentKey) {
    const currentIndex = journey.findIndex((step) => step.key === currentKey)
    if (currentIndex >= 0) {
      journey[currentIndex] = { ...journey[currentIndex], state: 'active', shine: true }
      for (let i = currentIndex + 1; i < journey.length; i += 1) {
        if (journey[i].state !== 'done' && journey[i].state !== 'rejected') {
          journey[i] = { ...journey[i], state: 'locked', shine: false }
        }
      }
    }
  }

  const activity: string[] = []
  if (docsReady) activity.push('Documentos de la revisión 1 cargados.')
  if (submitted) activity.push('Revisión 1 enviada.')
  if (review1Status === 'in_review') activity.push('Revisión 1 en revisión por Operaciones.')
  if (review1Status === 'validated') activity.push('Revisión 1 validada.')
  if (review1Done) activity.push('Fase 1 aprobada. Fase 2 habilitada.')
  if (icf12Ready) activity.push('Formato IC.F.1.2 cargado.')
  if (['sent', 'in_review', 'validated', 'approved'].includes(review2Status)) {
    activity.push('Revisión 2 enviada.')
  }
  if (review2Status === 'in_review') activity.push('Revisión 2 en revisión por Operaciones.')
  if (review2Status === 'validated') activity.push('Revisión 2 validada.')
  if (review2Done) activity.push('Fase 2 aprobada. Registro completado.')
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
    journey,
    review1Done,
    review2Done,
    datos: docsReady,
    formacion: docsReady,
    documentos: docsReady,
  }
}
