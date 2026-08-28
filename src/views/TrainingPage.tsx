import { useEffect, useState } from 'react'
import { Link, useOutletContext } from '../app-router'
import { confirmStage2Training, fetchProfile } from '../api'
import TrainingCatalog, { type TrainingItem } from '../components/TrainingCatalog'
import { MaterialIcon } from '../components/MaterialIcon'
import type { PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
}

const INTRO_VIDEO_SRC = '/videos/introduccion-partner.mp4'

const TRAINING_ITEMS: TrainingItem[] = [
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
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAk604ldHs9fYP8K4K0ep2srOT9FGqIwhOiQPpCt8vnU-1EivLJAE-u696eO7843DoUQREOwZTdtFrG0UlGlEgcgEdmiD5sRQg1qDR2c0ifCGgr_WEP9zpuiXtaWFa8jNf1KoSJaLDbn84sTzP7W0-kxEYZmZcZJAGY6ZCskENUg01xyRQUTPpsJP_BuBViTGxlHVZLSX8bRVXIIS-zxoEckupVmU852xSVZlXyXN653WAEOptnbyYCQw',
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
    id: 'sales-speech',
    area: 'comercial',
    title: 'Speech de Ventas Efectivo',
    description:
      'Técnicas de argumentación y manejo de objeciones para ofrecer certificaciones ISO a prospectos B2B.',
    tag: 'Ventas',
    tagTone: 'ventas',
    duration: '15:10',
    durationSeconds: 15,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCCG2riP3FP6gAFSJ7vddktcB3C8ZnGP8INezzmrrEZNLTWK1naB8gQXt7O5Y0SJLNs0x_cbSdsCqsuIMYA2-ImaL4ZJ0RpuloS2z_xrw-ydJG_c_HNaN3urmyyTD3iyfrvtFfDowkqmc8i3a2XU1p38itFgDSHtKgtrA-aDrk5p_swmR-6rnCbpmDikM3CE3yqQC9ToMz1zGDfp77f2O9Ytrtvpyn5R-RHmW-YshwjExcRrb9UXb1hIw',
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

export function TrainingPage() {
  const { user } = useOutletContext<DashboardContext>()
  const isAuditor = user.role === 'partner_auditor'
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justDone, setJustDone] = useState(false)

  useEffect(() => {
    if (!isAuditor) return
    fetchProfile()
      .then((data) => {
        setCompleted(Boolean(data.profile.trainingCompleted))
      })
      .catch(() => {})
  }, [isAuditor])

  async function handleVideoEnded() {
    if (completed || saving) return
    setSaving(true)
    setError('')
    try {
      await confirmStage2Training()
      setCompleted(true)
      setJustDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la capacitación.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-container-max space-y-4">
      <section>
        <h2 className="mb-1 text-headline-md font-bold text-primary">Centro de Capacitación</h2>
        <p className="text-body-md text-on-surface-variant">
          Materiales para optimizar tu gestión como Partner: procesos operativos y estrategias
          comerciales.
        </p>
      </section>

      {isAuditor && (
        <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-level-1">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-label-md font-semibold text-[#0A165E]">
                Video de inducción al registro
              </p>
              <p className="text-sm text-on-surface-variant">
                Debes verlo completo para habilitar la fase 2.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-label-sm font-bold ${
                completed ? 'bg-[#d9f0e3] text-[#146c43]' : 'bg-warning-bg text-warning'
              }`}
            >
              {completed ? 'Completado' : saving ? 'Registrando...' : 'Pendiente'}
            </span>
          </div>
          <video
            className="max-h-[420px] w-full bg-black object-contain"
            controls
            playsInline
            poster="/partners-logo-blanco.png"
            onEnded={() => void handleVideoEnded()}
          >
            <source src={INTRO_VIDEO_SRC} type="video/mp4" />
          </video>
          {error && (
            <p className="px-4 py-3 text-body-md text-on-error-container">{error}</p>
          )}
          {justDone && (
            <div className="flex flex-col gap-3 border-t border-outline-variant/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body-md text-[#146c43]">
                Capacitación completada. Ya puedes continuar con la fase 2 en tu registro.
              </p>
              <Link
                to="/dashboard/perfil"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#0A165E] px-4 py-2 text-label-md font-semibold text-white"
              >
                Volver al registro
              </Link>
            </div>
          )}
        </section>
      )}

      <TrainingCatalog items={TRAINING_ITEMS} />
    </div>
  )
}
