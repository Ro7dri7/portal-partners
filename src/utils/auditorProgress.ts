import type { ProfessionalProfile } from '../api'

export function isPartnerAuditor(role: string) {
  return role === 'partner_auditor'
}

const REVIEW1_DOCS = ['cv', 'degree', 'lead_auditor_courses', 'audits_relation']

export type AuditorPhase = {
  key: 'review1' | 'review2'
  label: string
  state: 'done' | 'active' | 'pending'
  detail: string
}

function review1DocsReady(documents: Array<{ category: string }>) {
  return REVIEW1_DOCS.every((category) => documents.some((doc) => doc.category === category))
}

export function getAuditorProgress(
  profile: ProfessionalProfile,
  documents: Array<{ category: string }>,
) {
  const review1Status = profile.review1Status || (profile.submitted ? 'in_review' : 'pending')
  const review2Status = profile.review2Status || 'locked'
  const docsReady = review1DocsReady(documents)
  const icf12Ready = documents.some((doc) => doc.category === 'icf12')

  const review1Done = review1Status === 'approved'
  const review2Done = review2Status === 'approved'
  const review2Active = review1Done && !review2Done

  const phases: AuditorPhase[] = [
    {
      key: 'review1',
      label: 'Revisión 1',
      state: review1Done ? 'done' : 'active',
      detail:
        review1Status === 'approved'
          ? 'Aprobada'
          : review1Status === 'in_review'
            ? 'En revisión'
            : review1Status === 'rejected'
              ? 'Observada'
              : docsReady
                ? 'Lista para enviar'
                : 'Documentación pendiente',
    },
    {
      key: 'review2',
      label: 'Revisión 2',
      state: review2Done ? 'done' : review2Active ? 'active' : 'pending',
      detail:
        review2Status === 'approved'
          ? 'Aprobada'
          : review2Status === 'in_review'
            ? 'En revisión'
            : review2Status === 'rejected'
              ? 'Observada'
              : review1Done
                ? icf12Ready
                  ? 'Formato listo para enviar'
                  : 'Formato IC.F.1.2 pendiente'
                : 'Bloqueada',
    },
  ]

  const submitted = review1Status === 'in_review' || review1Done
  let percent = 10
  if (docsReady) percent = 35
  if (review1Status === 'in_review') percent = 50
  if (review1Done) percent = 70
  if (review2Status === 'in_review') percent = 85
  if (review2Done) percent = 100

  let headline = 'Completa la revisión de documentación'
  let description =
    'Adjunta CV, diploma, certificados de Auditor Líder, la relación de auditorías y el detalle de cada una.'
  let badge = 'Revisión 1'

  if (review2Done) {
    headline = 'Registro aprobado'
    description = 'Las dos revisiones fueron aprobadas. Ya estás habilitado como Partner Auditor.'
    badge = 'Completado'
  } else if (review2Status === 'in_review') {
    headline = 'Formato IC.F.1.2 en revisión'
    description = 'El equipo técnico está evaluando tu Application and Auditor Registration.'
    badge = 'Revisión 2'
  } else if (review1Done) {
    headline = 'Continúa con el formato IC.F.1.2'
    description =
      'Descarga Application and Auditor Registration - Initial, complétalo y vuelve a subirlo.'
    badge = '1 de 2'
  } else if (review1Status === 'in_review') {
    headline = 'Documentación en revisión'
    description = 'Intercert está evaluando tus documentos y el historial de auditorías.'
    badge = 'En revisión'
  } else if (review1Status === 'rejected') {
    headline = 'Documentación observada'
    description = 'Corrige los puntos observados y vuelve a enviar la revisión 1.'
    badge = 'Observado'
  }

  const activity: string[] = []
  if (docsReady) activity.push('Documentos de la revisión 1 cargados.')
  if (review1Status === 'in_review') activity.push('Revisión 1 enviada al equipo técnico.')
  if (review1Done) activity.push('Revisión 1 aprobada. Formato IC.F.1.2 habilitado.')
  if (icf12Ready) activity.push('Formato IC.F.1.2 cargado.')
  if (review2Status === 'in_review') activity.push('Revisión 2 enviada.')
  if (review2Done) activity.push('Revisión 2 aprobada. Registro de auditor completado.')
  if (activity.length === 0) {
    activity.push('Aún no hay avance. Completa la documentación de Partner Auditor.')
  }

  return {
    phases,
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
