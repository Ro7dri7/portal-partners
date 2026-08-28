import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from '../app-router'
import { confirmStage1Contract, fetchProfile, type ProfessionalProfile } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import { RegistrationPhases } from '../components/RegistrationPhases'
import { JOURNEY_STAGES } from '../utils/auditorProgress'
import type { PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
  setUser: (user: PartnerUser) => void
}

const CONTRACT_URL = '/formats/Contrato-Partner-Intercert.html'

export function ProfilePage() {
  const { user, setUser } = useOutletContext<DashboardContext>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [openKey, setOpenKey] = useState('account')
  const [saving, setSaving] = useState(false)
  const [askConfirm, setAskConfirm] = useState(false)
  const [donePopup, setDonePopup] = useState(false)
  const [error, setError] = useState('')
  const isAuditor = user.role === 'partner_auditor'
  const stage1Done = Boolean(profile?.contractDownloaded)
  const handleProfile = useCallback((next: ProfessionalProfile) => {
    setProfile(next)
  }, [])

  useEffect(() => {
    if (!isAuditor) return
    const etapa = new URLSearchParams(window.location.search).get('etapa')
    fetchProfile()
      .then((data) => {
        setProfile(data.profile)
        if (etapa === 'account' || etapa === '1') setOpenKey('account')
        else if (etapa === 'profile' || etapa === '2' || data.profile.contractDownloaded) {
          setOpenKey('profile')
        }
      })
      .catch(() => {
        /* keep defaults */
      })
  }, [isAuditor])

  function goBack() {
    navigate('/dashboard')
  }

  function handleDownloadContract() {
    setError('')
    const link = document.createElement('a')
    link.href = CONTRACT_URL
    link.download = 'Contrato-Partner-Intercert.html'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => {
      setAskConfirm(true)
    }, 400)
  }

  async function handleConfirmDownload() {
    setError('')
    setSaving(true)
    try {
      const data = await confirmStage1Contract()
      setProfile(data.profile)
      setAskConfirm(false)
      setDonePopup(true)
      window.setTimeout(() => {
        navigate('/dashboard')
      }, 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la descarga.')
    } finally {
      setSaving(false)
    }
  }

  if (!isAuditor) {
    return (
      <div className="mx-auto pb-12">
        <header className="mb-6">
          <button
            type="button"
            onClick={goBack}
            className="mb-3 inline-flex items-center gap-1 text-label-md font-semibold text-secondary hover:underline"
          >
            <MaterialIcon name="arrow_back" className="text-[18px]" />
            Volver
          </button>
          <h2 className="text-headline-lg font-bold tracking-tight text-primary">Mi perfil</h2>
        </header>
      </div>
    )
  }

  return (
    <div className="w-full pb-12">
      {askConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A165E]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-level-2">
            <MaterialIcon name="download" className="text-[48px] text-[#159DBC]" />
            <p className="mt-3 text-headline-sm font-bold text-[#0A165E]">¿Descargaste el contrato?</p>
            <p className="mt-1 text-body-md text-[#64748b]">
              Confirma que el archivo se descargó en tu equipo para completar la etapa 1.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirmDownload()}
                className="rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#0A165E]/90 disabled:opacity-60"
              >
                {saving ? 'Confirmando...' : 'Sí, confirmo la descarga'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setAskConfirm(false)}
                className="rounded-lg px-4 py-2 text-label-md font-semibold text-[#64748b] hover:bg-[#eef3f8]"
              >
                Aún no
              </button>
            </div>
          </div>
        </div>
      )}

      {donePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A165E]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-level-2">
            <MaterialIcon name="check_circle" filled className="text-[48px] text-[#4ECDC4]" />
            <p className="mt-3 text-headline-sm font-bold text-[#0A165E]">Descarga confirmada</p>
            <p className="mt-1 text-body-md text-[#64748b]">
              Te llevamos de vuelta al dashboard con la etapa 1 completada.
            </p>
          </div>
        </div>
      )}

      <header className="mb-6">
        <button
          type="button"
          onClick={goBack}
          className="mb-3 inline-flex items-center gap-1 text-label-md font-semibold text-secondary hover:underline"
        >
          <MaterialIcon name="arrow_back" className="text-[18px]" />
          Volver
        </button>
        <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.16em] text-secondary">
          Partner Auditor
        </p>
        <h2 className="text-headline-lg font-bold tracking-tight text-[#0A165E]">Etapas del proceso</h2>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {JOURNEY_STAGES.map((stage, index) => {
          const unlocked = index === 0 || stage1Done
          const done = index === 0 && stage1Done
          const open = openKey === stage.key && unlocked
          return (
            <section
              key={stage.key}
              className={`overflow-hidden rounded-xl border bg-white transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                open
                  ? 'border-[#159DBC]/50 shadow-[0_12px_28px_rgba(10,22,94,0.12)]'
                  : 'border-outline-variant/40 shadow-none'
              }`}
            >
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => setOpenKey(open ? '' : stage.key)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left disabled:cursor-not-allowed"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-label-md font-black transition-colors duration-300"
                    style={{
                      background: done ? '#4ECDC4' : unlocked ? '#0A165E' : '#8A9199',
                      color: done || unlocked ? '#fff' : '#e5e7eb',
                    }}
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span
                      className="block text-label-md font-bold"
                      style={{ color: unlocked ? '#0A165E' : '#8A9199' }}
                    >
                      {index + 1}: {stage.label}
                    </span>
                    <span className="text-sm" style={{ color: unlocked ? '#64748b' : '#8A9199' }}>
                      {done ? 'Completada' : unlocked ? 'Disponible' : 'Bloqueada'}
                    </span>
                  </span>
                </span>
                <MaterialIcon
                  name="expand_more"
                  className={`text-[22px] transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    open ? 'rotate-180 text-[#159DBC]' : 'rotate-0'
                  }`}
                />
              </button>

              <div className="stage-panel" data-open={open ? 'true' : 'false'}>
                <div className="stage-panel-inner">
                  <div className="stage-panel-body border-t border-outline-variant/30 px-5 py-5">
                    {stage.key === 'account' ? (
                      <>
                        <p className="text-body-md text-[#64748b]">
                          Descarga tu contrato de Partner para completar esta etapa.
                        </p>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleDownloadContract()}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0A165E] px-4 py-2 text-label-md font-semibold text-white transition-transform duration-200 hover:scale-[1.02] hover:bg-[#0A165E]/90 disabled:opacity-60"
                        >
                          <MaterialIcon name="download" className="text-[20px]" />
                          Descargar contrato
                        </button>
                      </>
                    ) : stage.key === 'profile' ? (
                      <RegistrationPhases setUser={setUser} onProfile={handleProfile} />
                    ) : (
                      <p className="text-body-md text-[#64748b]">
                        Este apartado se habilitará cuando completes las etapas anteriores.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
