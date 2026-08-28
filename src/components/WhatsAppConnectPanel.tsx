import { useState } from 'react'
import { confirmWhatsAppLink, type ProfessionalProfile } from '../api'
import { MaterialIcon } from './MaterialIcon'

type WhatsAppConnectPanelProps = {
  profile: ProfessionalProfile | null
  onProfile: (profile: ProfessionalProfile) => void
}

export function WhatsAppConnectPanel({ profile, onProfile }: WhatsAppConnectPanelProps) {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const url = profile?.whatsappGroupUrl || ''

  async function markConfirmed() {
    if (profile?.whatsappConfirmed) return
    const result = await confirmWhatsAppLink()
    onProfile(result.profile)
  }

  async function handleCopy() {
    if (!url || saving) return
    setError('')
    setSaving(true)
    try {
      await navigator.clipboard.writeText(url)
      await markConfirmed()
      setCopied(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el link.')
    } finally {
      setSaving(false)
    }
  }

  async function handleJoin() {
    if (!url || saving) return
    setError('')
    setSaving(true)
    try {
      await markConfirmed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el link.')
    } finally {
      setSaving(false)
    }
  }

  if (!url) {
    return (
      <div className="rounded-xl border border-[#159DBC]/30 bg-[#eef3f8] px-4 py-4">
        <p className="text-body-md font-semibold text-[#0A165E]">Grupo de WhatsApp</p>
        <p className="mt-1 text-body-md text-[#64748b]">
          Mantente a la espera de que tu coordinador comercial envíe el link de grupo de WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-body-md text-[#64748b]">
        Tu coordinador comercial ya compartió el grupo. Únete o copia el link para completar esta
        etapa.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={() => void handleJoin()}
          className="inline-flex min-w-0 flex-1 items-center gap-2 truncate rounded-lg border border-[#25D366]/50 bg-[#edfdf3] px-4 py-3 text-label-md font-semibold text-[#128C4B] hover:bg-[#d9f7e5]"
        >
          <MaterialIcon name="chat" className="text-[20px]" />
          <span className="truncate">{url}</span>
        </a>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleCopy()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A165E] px-4 py-3 text-label-md font-semibold text-white hover:bg-[#0A165E]/90 disabled:opacity-60"
        >
          <MaterialIcon name="content_copy" className="text-[18px]" />
          Copiar link
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
          {error}
        </p>
      )}
      {copied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A165E]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-level-2">
            <MaterialIcon name="check_circle" filled className="text-[48px] text-[#4ECDC4]" />
            <p className="mt-3 text-headline-sm font-bold text-[#0A165E]">Link de WhatsApp copiado</p>
            <p className="mt-1 text-body-md text-[#64748b]">
              Pégalo donde quieras. Esta etapa ya quedó completada.
            </p>
            <button
              type="button"
              onClick={() => setCopied(false)}
              className="mt-5 rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#0A165E]/90"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
