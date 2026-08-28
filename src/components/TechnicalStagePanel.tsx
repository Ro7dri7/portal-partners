import { useCallback, useEffect, useState } from 'react'
import { Link } from '../app-router'
import {
  confirmCasaMatrizDownload,
  deleteDocument,
  fetchProfile,
  type ProfessionalProfile,
} from '../api'
import { MaterialIcon } from './MaterialIcon'
import { ReviewTaskCard, type ReviewTaskStatus } from './ReviewTaskCard'
import { formatFileSize, UploadZone, type UploadedFile } from './UploadZone'

type TechnicalStagePanelProps = {
  profile: ProfessionalProfile | null
  onProfile: (profile: ProfessionalProfile) => void
}

const CASA_MATRIZ_URL = '/formats/Contrato-Oficial-Casa-Matriz.html'
const AUDIT_REPORT_VIDEO = '/dashboard/capacitacion?video=audit-report'

function statusOf(done: boolean, unlocked: boolean): ReviewTaskStatus {
  if (done) return 'completed'
  if (!unlocked) return 'locked'
  return 'pending'
}

export function TechnicalStagePanel({ profile, onProfile }: TechnicalStagePanelProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [extraZones, setExtraZones] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [askConfirm, setAskConfirm] = useState(false)

  const load = useCallback(() => {
    fetchProfile()
      .then((data) => {
        onProfile(data.profile)
        setFiles(
          data.documents
            .filter((doc) => doc.category === 'advisor_rates' || doc.category === 'casa_matriz_contract')
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

  const videoDone = Boolean(profile?.auditReportTrainingCompleted)
  const ratesReady = files.some((file) => file.category === 'advisor_rates' && file.status === 'uploaded')
  const downloadDone = Boolean(profile?.casaMatrizDownloaded)
  const contractReady = files.some(
    (file) => file.category === 'casa_matriz_contract' && file.status === 'uploaded',
  )

  function addFiles(incoming: UploadedFile[]) {
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
    if (incoming.some((file) => file.status === 'uploaded')) {
      setError('')
      load()
    }
  }

  function removeFile(id: string) {
    const current = files.find((file) => file.id === id)
    setFiles((prev) => prev.filter((file) => file.id !== id))
    if (current?.documentId) {
      void deleteDocument(current.documentId).catch(() => {})
    }
  }

  function handleDownload() {
    setError('')
    const link = document.createElement('a')
    link.href = CASA_MATRIZ_URL
    link.download = 'Contrato-Oficial-Casa-Matriz.html'
    document.body.appendChild(link)
    link.click()
    link.remove()
    if (!downloadDone) window.setTimeout(() => setAskConfirm(true), 400)
  }

  async function handleConfirmDownload() {
    setError('')
    setSaving(true)
    try {
      const data = await confirmCasaMatrizDownload()
      onProfile(data.profile)
      setAskConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la descarga.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {askConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A165E]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-level-2">
            <MaterialIcon name="download" className="text-[48px] text-[#159DBC]" />
            <p className="mt-3 text-headline-sm font-bold text-[#0A165E]">
              ¿Descargaste el contrato CASA MATRIZ?
            </p>
            <p className="mt-1 text-body-md text-[#64748b]">
              Confirma la descarga para habilitar la carga del contrato firmado.
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

      <p className="text-body-md text-[#64748b]">
        Completa estas 4 actividades en orden. Al subir el contrato oficial CASA MATRIZ, la etapa 5
        queda al 100%.
      </p>
      {error && (
        <p className="rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
          {error}
        </p>
      )}

      <ReviewTaskCard
        title="Capacitación de Llenado de Reporte de Auditoria"
        description="Mira el video en Capacitación. Al terminarlo se habilita la siguiente actividad."
        icon="play_circle"
        status={statusOf(videoDone, true)}
        defaultOpen={!videoDone}
      >
        <Link
          to={AUDIT_REPORT_VIDEO}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#0A165E]/90"
        >
          <MaterialIcon name="play_arrow" filled className="text-[20px]" />
          Ver video de capacitación
        </Link>
      </ReviewTaskCard>

      <ReviewTaskCard
        title="Sube tus tarifas de asesor"
        description="Puedes adjuntar uno o más archivos con tus tarifas."
        icon="request_quote"
        status={statusOf(ratesReady, videoDone)}
        defaultOpen={videoDone && !ratesReady}
      >
        {!videoDone ? (
          <p className="text-body-md text-on-surface-variant">
            Completa el video de capacitación para habilitar esta carga.
          </p>
        ) : (
          <>
            {!contractReady && (
              <>
                {Array.from({ length: 1 + extraZones }).map((_, zoneIndex) => (
                  <div key={`rates-zone-${zoneIndex}`} className={zoneIndex > 0 ? 'mt-3' : ''}>
                    <UploadZone
                      compact
                      icon="upload_file"
                      category="advisor_rates"
                      required={zoneIndex === 0}
                      multiple
                      buttonLabel="Seleccionar archivo"
                      buttonVariant="primary"
                      onFiles={addFiles}
                      onRemoveZone={zoneIndex > 0 ? () => setExtraZones((n) => Math.max(0, n - 1)) : undefined}
                    />
                  </div>
                ))}
                {extraZones < 4 && (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-secondary/50 bg-white px-3 py-2 text-label-md font-semibold text-secondary hover:bg-secondary-container/10"
                    onClick={() => setExtraZones((n) => n + 1)}
                  >
                    <MaterialIcon name="add" className="text-[18px]" />
                    Añadir otro archivo
                  </button>
                )}
              </>
            )}
            <FileList
              files={files.filter((file) => file.category === 'advisor_rates')}
              canRemove={!contractReady}
              onRemove={removeFile}
            />
          </>
        )}
      </ReviewTaskCard>

      <ReviewTaskCard
        title="Descarga contrato oficial CASA MATRIZ"
        description="Descarga el documento oficial y confírmalo para continuar."
        icon="download"
        status={statusOf(downloadDone, ratesReady)}
        defaultOpen={ratesReady && !downloadDone}
      >
        {!ratesReady ? (
          <p className="text-body-md text-on-surface-variant">
            Sube tus tarifas de asesor para habilitar la descarga.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#0A165E]/90"
          >
            <MaterialIcon name="download" className="text-[20px]" />
            {downloadDone ? 'Volver a descargar' : 'Descargar contrato'}
          </button>
        )}
      </ReviewTaskCard>

      <ReviewTaskCard
        title="Sube tu contrato Oficial CASA MATRIZ"
        description="Al subirlo, esta etapa queda completada al 100%."
        icon="upload_file"
        status={statusOf(contractReady, downloadDone)}
        defaultOpen={downloadDone && !contractReady}
      >
        {!downloadDone ? (
          <p className="text-body-md text-on-surface-variant">
            Descarga el contrato oficial CASA MATRIZ para habilitar esta carga.
          </p>
        ) : (
          <>
            {!contractReady && (
              <UploadZone
                compact
                icon="upload_file"
                category="casa_matriz_contract"
                required
                buttonLabel="Seleccionar contrato"
                buttonVariant="primary"
                onFiles={addFiles}
              />
            )}
            <FileList
              files={files.filter((file) => file.category === 'casa_matriz_contract')}
              canRemove={!contractReady}
              onRemove={removeFile}
            />
            {contractReady && (
              <p className="mt-3 rounded-xl border border-[#4ECDC4]/40 bg-[#d9f0e3] px-4 py-3 text-body-md text-[#146c43]">
                Contrato subido. La etapa 5 ya está completada.
              </p>
            )}
          </>
        )}
      </ReviewTaskCard>
    </div>
  )
}

function FileList({
  files,
  canRemove,
  onRemove,
}: {
  files: UploadedFile[]
  canRemove: boolean
  onRemove: (id: string) => void
}) {
  if (files.length === 0) return null
  return (
    <ul className="mt-3 space-y-2">
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
          {canRemove && (
            <button
              type="button"
              className="rounded-lg p-1 text-on-surface-variant hover:bg-error-container/40 hover:text-error"
              onClick={() => onRemove(file.id)}
              aria-label="Quitar archivo"
            >
              <MaterialIcon name="close" className="text-[18px]" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
