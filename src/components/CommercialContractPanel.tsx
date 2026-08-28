import { useCallback, useEffect, useState } from 'react'
import {
  deleteDocument,
  fetchProfile,
  submitCommercialContract,
  type ProfessionalProfile,
} from '../api'
import { MaterialIcon } from './MaterialIcon'
import { formatFileSize, UploadZone, type UploadedFile } from './UploadZone'

type CommercialContractPanelProps = {
  onProfile: (profile: ProfessionalProfile) => void
}

export function CommercialContractPanel({ onProfile }: CommercialContractPanelProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const load = useCallback(() => {
    fetchProfile()
      .then((data) => {
        onProfile(data.profile)
        setSubmitted(Boolean(data.profile.commercialContractSubmitted))
        setFiles(
          data.documents
            .filter((doc) => doc.category === 'commercial_contract')
            .map((doc) => ({
              id: String(doc.id),
              name: doc.file_name,
              size: doc.file_size || 0,
              category: doc.category,
              status: 'uploaded' as const,
              documentId: String(doc.id),
              reviewStatus: doc.review_status || 'pending',
            })),
        )
      })
      .catch(() => {})
  }, [onProfile])

  useEffect(() => {
    load()
  }, [load])

  const ready = files.some((file) => file.status === 'uploaded')

  async function handleSubmit() {
    setError('')
    if (files.some((file) => file.status === 'uploading')) {
      setError('Espera a que terminen de subirse los archivos.')
      return
    }
    if (!ready) {
      setError('Sube el contrato firmado antes de enviarlo.')
      return
    }
    setSaving(true)
    try {
      const result = await submitCommercialContract()
      onProfile(result.profile)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el contrato.')
    } finally {
      setSaving(false)
    }
  }

  function removeFile(id: string) {
    if (submitted) return
    const current = files.find((file) => file.id === id)
    setFiles((prev) => prev.filter((file) => file.id !== id))
    if (current?.documentId) {
      void deleteDocument(current.documentId).catch(() => {})
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-body-md text-[#64748b]">
        Sube tu contrato comercial firmado. Al enviarlo, esta etapa queda completada al 100% y
        Comercial lo revisa en Helpdesk.
      </p>
      {!submitted && (
        <UploadZone
          compact
          icon="upload_file"
          category="commercial_contract"
          required
          buttonLabel="Seleccionar contrato"
          buttonVariant="primary"
          onFiles={(incoming) => {
            setFiles((prev) => {
              let next = [...prev]
              for (const file of incoming) {
                const index = next.findIndex((item) => item.id === file.id)
                if (index >= 0) next[index] = { ...next[index], ...file }
                else next.push(file)
              }
              return next
            })
            const failed = incoming.find((file) => file.status === 'error')
            if (failed) setError(failed.error || 'No se pudo subir el archivo.')
            if (incoming.some((file) => file.status === 'uploaded')) setError('')
          }}
        />
      )}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-white px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-label-md font-semibold text-on-surface">
                  {file.name}
                </span>
                <span className="text-body-md text-on-surface-variant">
                  {formatFileSize(file.size)}
                  {file.status === 'uploading' ? ' · Subiendo…' : ''}
                  {file.status === 'error' ? ` · ${file.error || 'Error al subir'}` : ''}
                </span>
              </span>
              {!submitted && (
                <button
                  type="button"
                  className="rounded-lg p-1 text-on-surface-variant hover:bg-error-container/40 hover:text-error"
                  onClick={() => removeFile(file.id)}
                  aria-label="Quitar archivo"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
          {error}
        </p>
      )}
      {submitted ? (
        <p className="rounded-xl border border-[#4ECDC4]/40 bg-[#d9f0e3] px-4 py-3 text-body-md text-[#146c43]">
          Contrato enviado. Esta etapa ya está al 100%. El seguimiento está en Estado de solicitud
          → Contrato Comercial.
        </p>
      ) : (
        <button
          type="button"
          disabled={saving || !ready}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Enviando...' : 'Enviar contrato firmado'}
        </button>
      )}
    </div>
  )
}
