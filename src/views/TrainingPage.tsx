import { useEffect, useState } from 'react'
import { Link, useOutletContext } from '../app-router'
import {
  confirmStage2Training,
  confirmStage5Training,
  confirmStage6Training,
  fetchProfile,
} from '../api'
import TrainingCatalog, { type TrainingItem } from '../components/TrainingCatalog'
import { MaterialIcon } from '../components/MaterialIcon'
import type { PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
}

export const ICF12_TRAINING_ID = 'icf12-format'
export const AUDIT_REPORT_TRAINING_ID = 'audit-report-fill'
export const COMMERCIAL_TRAINING_ID = 'commercial-training'
const ICF12_VIDEO_SRC = '/videos/icf12-formato.mp4'
const AUDIT_REPORT_VIDEO_SRC = `/videos/${encodeURIComponent('videoplayback (1).mp4')}`
const COVER_OPS =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAk604ldHs9fYP8K4K0ep2srOT9FGqIwhOiQPpCt8vnU-1EivLJAE-u696eO7843DoUQREOwZTdtFrG0UlGlEgcgEdmiD5sRQg1qDR2c0ifCGgr_WEP9zpuiXtaWFa8jNf1KoSJaLDbn84sTzP7W0-kxEYZmZcZJAGY6ZCskENUg01xyRQUTPpsJP_BuBViTGxlHVZLSX8bRVXIIS-zxoEckupVmU852xSVZlXyXN653WAEOptnbyYCQw'
const COVER_COM =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCCG2riP3FP6gAFSJ7vddktcB3C8ZnGP8INezzmrrEZNLTWK1naB8gQXt7O5Y0SJLNs0x_cbSdsCqsuIMYA2-ImaL4ZJ0RpuloS2z_xrw-ydJG_c_HNaN3urmyyTD3iyfrvtFfDowkqmc8i3a2XU1p38itFgDSHtKgtrA-aDrk5p_swmR-6rnCbpmDikM3CE3yqQC9ToMz1zGDfp77f2O9Ytrtvpyn5R-RHmW-YshwjExcRrb9UXb1hIw'

const TRAINING_ITEMS: TrainingItem[] = [
  {
    id: AUDIT_REPORT_TRAINING_ID,
    area: 'operaciones',
    title: 'Capacitación de Llenado de Reporte de Auditoria',
    description:
      'Aprende a completar el reporte de auditoría para continuar la etapa técnica de Intercert.',
    tag: 'Operaciones',
    tagTone: 'iso',
    duration: '',
    durationSeconds: 0,
    image: COVER_OPS,
    action: 'play',
    videoSrc: AUDIT_REPORT_VIDEO_SRC,
    tracksCompletion: true,
  },
  {
    id: ICF12_TRAINING_ID,
    area: 'operaciones',
    title: '¿Cómo llenar tu formato IC.F.1.2?',
    description:
      'Aprende a completar el formato Application and Auditor Registration - Initial para continuar tu registro como Partner Auditor.',
    tag: 'Registro',
    tagTone: 'iso',
    duration: '',
    durationSeconds: 0,
    image: COVER_OPS,
    action: 'play',
    videoSrc: ICF12_VIDEO_SRC,
    tracksCompletion: true,
  },
  {
    id: 'iso-flow',
    area: 'operaciones',
    title: 'Flujo de Emisión ISO',
    description:
      'Aprenda el proceso paso a paso para la correcta emisión y validación de certificados bajo los estándares ISO 9001.',
    tag: 'Proceso ISO',
    tagTone: 'iso',
    duration: '12:45',
    durationSeconds: 12,
    image: COVER_OPS,
    action: 'play',
  },
  {
    id: 'portal-clients',
    area: 'operaciones',
    title: 'Gestión de Clientes en el Portal',
    description:
      'Tutorial detallado sobre cómo dar de alta nuevos clientes, actualizar datos y subir documentación probatoria.',
    tag: 'Gestión',
    tagTone: 'gestion',
    duration: '08:20',
    durationSeconds: 8,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBAxUytCjKLkjjlp4u8ro5CsR9EsLiFGZFRhnB-_P78UwrPNnV1_86LFarjJUKdD3cz26-57iUR4505_DVJECM0CRsqDVsIz6gFLhpkoKVOov7QzkKpAyiwQ-KSP0Et5dEjmjwkI-okn_YWvsijHO7KklTlXDVB3yeKEdtRaiSDvnUvtxLKhikuATIfW69fhHKTas6SMGj3hdozk8DugAH2LYLe7kV0AvJ1mtlaueYGSde5xdP_ZtsgDg',
    action: 'download',
  },
  {
    id: COMMERCIAL_TRAINING_ID,
    area: 'comercial',
    title: 'Capacitación comercial',
    description:
      'Capacitación comercial de Intercert para completar la etapa 6 de tu proceso como Partner.',
    tag: 'Ventas',
    tagTone: 'ventas',
    duration: '',
    durationSeconds: 0,
    image: COVER_COM,
    action: 'play',
    videoSrc: AUDIT_REPORT_VIDEO_SRC,
    tracksCompletion: true,
  },
  {
    id: 'sales-speech',
    area: 'comercial',
    title: 'Speech de Ventas Efectivo',
    description:
      'Técnicas de argumentación y manejo de objeciones para ofrecer certificaciones ISO a prospectos B2B.',
    tag: 'Ventas',
    tagTone: 'ventas',
    duration: '15:10',
    durationSeconds: 15,
    image: COVER_COM,
    action: 'play',
  },
  {
    id: 'quoting',
    area: 'comercial',
    title: 'Cómo Cotizar Proyectos',
    description:
      'Guía sobre el uso del cotizador interno, cálculo de márgenes y estructuración de propuestas comerciales formales.',
    tag: 'Administración',
    tagTone: 'admin',
    duration: '22:05',
    durationSeconds: 22,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBtd-MaNZeNEg52dhuEYiL8AReNAODqO29oTO_gJAn64PQzTaXq-atfUYP98XqRo5pNc91H6lNiO6rcVjWSJoC6vRqxQ8iRS5BrW4HsVE-nYNjG85S7vfPQBRXw958jdXRh25cd3c5fFgZmSp-TX7bK7YgieulZyC2zriKWFe80o8vOjdmMgC3WNXH4Vz4uQ-0CfV_6mz40OoUd67ftc04qpmLgYEcejdpUnJGmj16AIw_9NEXncoDOAw',
    action: 'play',
  },
]

const AUDITOR_VIDEO_IDS = new Set([
  ICF12_TRAINING_ID,
  AUDIT_REPORT_TRAINING_ID,
  COMMERCIAL_TRAINING_ID,
])

function videoFromQuery(video: string | null) {
  if (video === 'icf12' || video === ICF12_TRAINING_ID) return ICF12_TRAINING_ID
  if (video === 'audit-report' || video === AUDIT_REPORT_TRAINING_ID) return AUDIT_REPORT_TRAINING_ID
  if (video === 'commercial' || video === COMMERCIAL_TRAINING_ID) return COMMERCIAL_TRAINING_ID
  return null
}

export function TrainingPage() {
  const { user } = useOutletContext<DashboardContext>()
  const isAuditor = user.role === 'partner_auditor'
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [donePopup, setDonePopup] = useState<string | null>(null)
  const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const autoOpenId = isAuditor ? videoFromQuery(query.get('video')) : null

  useEffect(() => {
    if (!isAuditor) return
    fetchProfile()
      .then((data) => {
        const ids: string[] = []
        if (data.profile.trainingCompleted) ids.push(ICF12_TRAINING_ID)
        if (data.profile.auditReportTrainingCompleted) ids.push(AUDIT_REPORT_TRAINING_ID)
        if (data.profile.commercialTrainingCompleted) ids.push(COMMERCIAL_TRAINING_ID)
        setCompletedIds(ids)
      })
      .catch(() => {})
  }, [isAuditor])

  useEffect(() => {
    if (!autoOpenId) return
    const timer = window.setTimeout(() => {
      document.getElementById('training-player')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [autoOpenId])

  async function handleTrackedVideoComplete(id: string) {
    if (!AUDITOR_VIDEO_IDS.has(id)) return
    setDonePopup(id)
    if (!isAuditor || completedIds.includes(id) || saving) return
    setSaving(true)
    setError('')
    try {
      if (id === ICF12_TRAINING_ID) await confirmStage2Training()
      else if (id === AUDIT_REPORT_TRAINING_ID) await confirmStage5Training()
      else if (id === COMMERCIAL_TRAINING_ID) await confirmStage6Training()
      setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la capacitación.')
    } finally {
      setSaving(false)
    }
  }

  const popupCopy =
    donePopup === AUDIT_REPORT_TRAINING_ID
      ? {
          body: 'Completaste la capacitación de llenado de reporte. Continúa con las actividades de la etapa 5.',
          to: '/dashboard/perfil?etapa=icf12',
          label: 'Volver a la etapa 5',
        }
      : donePopup === COMMERCIAL_TRAINING_ID
        ? {
            body: 'Completaste la capacitación comercial. La etapa 6 quedó al 100%.',
            to: '/dashboard',
            label: 'Volver al dashboard',
          }
        : {
            body: 'Completaste la capacitación. Ya puedes continuar tu registro en Mi Perfil.',
            to: '/dashboard/perfil?etapa=profile',
            label: 'Volver a Mi Perfil',
          }

  return (
    <div className="mx-auto w-full max-w-container-max space-y-4">
      {donePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A165E]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-level-2">
            <MaterialIcon name="check_circle" filled className="text-[48px] text-[#4ECDC4]" />
            <p className="mt-3 text-headline-sm font-bold text-[#0A165E]">Video Culminado</p>
            <p className="mt-1 text-body-md text-[#64748b]">{popupCopy.body}</p>
            {error && (
              <p className="mt-2 text-body-md text-on-error-container">{error}</p>
            )}
            <Link
              to={popupCopy.to}
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#0A165E]/90"
            >
              {popupCopy.label}
            </Link>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-1 text-headline-md font-bold text-primary">Centro de Capacitación</h2>
        <p className="text-body-md text-on-surface-variant">
          Materiales para optimizar tu gestión como Partner: procesos operativos y estrategias
          comerciales.
        </p>
      </section>

      <TrainingCatalog
        items={
          isAuditor
            ? TRAINING_ITEMS
            : TRAINING_ITEMS.filter((item) => !AUDITOR_VIDEO_IDS.has(item.id))
        }
        autoOpenId={autoOpenId}
        completedIds={completedIds}
        onTrackedVideoComplete={(id) => void handleTrackedVideoComplete(id)}
      />
    </div>
  )
}
