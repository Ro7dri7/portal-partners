import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from '../app-router'
import { deleteDocument, fetchProfile, submitDocuments } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import {
  formatFileSize,
  UploadZone,
  type UploadedFile,
} from '../components/UploadZone'
import { saveUser, type PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
  setUser: (user: PartnerUser) => void
}

export function DocumentsPage() {
  const { user, setUser } = useOutletContext<DashboardContext>()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [submitted, setSubmitted] = useState(user.documentsSubmitted)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setFiles(
          data.documents.map((doc) => ({
            id: String(doc.id),
            name: doc.file_name,
            size: doc.file_size || 0,
            category: doc.category,
            status: 'uploaded' as const,
            documentId: String(doc.id),
          })),
        )
      })
      .catch(() => {
        /* keep local list */
      })
  }, [])

  const addFiles = useCallback((incoming: UploadedFile[]) => {
    setSubmitted(false)
    setFiles((prev) => {
      let next = [...prev]
      for (const file of incoming) {
        if (file.category === 'cv') {
          next = next.filter((item) => item.category !== 'cv' || item.id === file.id)
        }
        const index = next.findIndex((item) => item.id === file.id)
        if (index >= 0) next[index] = { ...next[index], ...file }
        else next.push(file)
      }
      return next
    })
  }, [])

  function removeFile(id: string) {
    const current = files.find((file) => file.id === id)
    setFiles((prev) => prev.filter((file) => file.id !== id))
    setSubmitted(false)
    if (current?.documentId) {
      void deleteDocument(current.documentId).catch(() => {
        /* already removed from the list */
      })
    }
  }

  const validFiles = files.filter((f) => f.status === 'uploaded')
  const hasCv = validFiles.some((f) => f.category === 'cv')
  const uploading = files.some((f) => f.status === 'uploading')
  const canSubmit = hasCv && !sending && !uploading

  async function handleSubmit() {
    if (!canSubmit) return
    setError('')
    setSending(true)
    try {
      const result = await submitDocuments()
      saveUser(result.user)
      setUser(result.user)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    } finally {
      setSending(false)
    }
  }

  if (user.role !== 'partner_auditor') {
    return (
      <div className="mx-auto max-w-container-max">
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1">
          <MaterialIcon name="lock" className="mb-3 text-4xl text-outline" />
          <h2 className="mb-2 text-headline-lg font-bold text-on-surface">
            Formulario no habilitado
          </h2>
          <p className="mb-4 max-w-2xl text-body-md text-on-surface-variant">
            El formulario de validación de documentos es exclusivo del rol Partner Auditor.
          </p>
          <Link to="/dashboard" className="text-label-md font-semibold text-secondary hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-container-max">
      <header className="mb-8">
        <h2 className="mb-2 text-headline-lg font-bold text-on-surface">Sube tu documentación</h2>
        <p className="max-w-2xl text-body-md text-on-surface-variant">
          Sube tu documentación de sustento para completar tu afiliación. Asegúrate de que los
          documentos sean legibles y cumplan con los requisitos.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-start gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
            <MaterialIcon name="info" className="mt-0.5 text-secondary" />
            <p className="text-body-md text-on-surface-variant">
              Los archivos se guardan en Cloudflare R2. Formatos: PDF, DOC, XLS, JPG, PNG, GIF y ZIP.
            </p>
          </div>

          <UploadZone
            title="CV / Hoja de vida"
            description="Solo formato PDF. Obligatorio."
            icon="upload_file"
            category="cv"
            required
            acceptPdfOnly
            buttonLabel="Seleccionar Archivo"
            buttonVariant="primary"
            onFiles={addFiles}
          />

          <UploadZone
            title="Constancias de experiencia"
            description="Múltiples archivos permitidos."
            icon="folder_open"
            category="experience"
            multiple
            buttonLabel="Explorar Archivos"
            onFiles={addFiles}
          />

          <UploadZone
            title="Certificados adicionales"
            description="Opcional."
            icon="workspace_premium"
            category="certificates"
            multiple
            buttonLabel="Explorar Archivos"
            onFiles={addFiles}
          />
        </div>

        <div className="space-y-6 lg:col-span-1">
          <div className="sticky top-6 rounded-xl border border-outline-variant/50 bg-surface p-6 shadow-level-1">
            <h3 className="mb-4 border-b border-outline-variant/30 pb-4 text-headline-sm font-semibold text-on-surface">
              Archivos Cargados
            </h3>

            <div className="mb-8 min-h-[200px] space-y-4">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                  <MaterialIcon name="insert_drive_file" className="mb-2 text-4xl" />
                  <p className="text-body-md">Aún no hay archivos</p>
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-lg border border-outline-variant/50 p-3 transition-colors hover:bg-surface-container-lowest"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${
                          file.status === 'error'
                            ? 'bg-error-container/30'
                            : 'bg-error-container/10'
                        }`}
                      >
                        <MaterialIcon
                          name={
                            file.name.toLowerCase().endsWith('.pdf')
                              ? 'picture_as_pdf'
                              : 'image'
                          }
                          className="text-error"
                        />
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-label-md font-semibold text-on-surface">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant">
                            {formatFileSize(file.size)}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-outline-variant" />
                          <span
                            className={`text-label-sm font-bold tracking-wide ${
                              file.status === 'error' ? 'text-error' : 'text-secondary'
                            }`}
                          >
                            {file.status === 'error'
                              ? file.error ?? 'Error'
                              : file.status === 'uploading'
                                ? 'Subiendo...'
                                : 'Guardado en R2'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Eliminar"
                      className="p-1 text-on-surface-variant transition-colors hover:text-error"
                      onClick={() => removeFile(file.id)}
                    >
                      <MaterialIcon name="delete" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-outline-variant/30 pt-4">
              {error && (
                <p className="mb-3 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {submitted ? 'Solicitud enviada' : sending ? 'Enviando...' : 'Enviar solicitud'}
                </span>
                <MaterialIcon name={submitted ? 'check_circle' : 'send'} className="text-sm" />
              </button>
              <p className="mt-3 text-center text-label-sm font-bold tracking-wide text-on-surface-variant">
                {submitted
                  ? 'Tu documentación fue enviada para revisión.'
                  : canSubmit
                    ? 'Listo para enviar tu documentación.'
                    : 'Falta subir el documento obligatorio (CV).'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
