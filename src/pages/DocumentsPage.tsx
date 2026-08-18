import { useCallback, useState } from 'react'
import { MaterialIcon } from '../components/MaterialIcon'
import {
  formatFileSize,
  UploadZone,
  type UploadedFile,
} from '../components/UploadZone'

export function DocumentsPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [submitted, setSubmitted] = useState(false)

  const addFiles = useCallback((incoming: UploadedFile[]) => {
    setSubmitted(false)
    setFiles((prev) => {
      const next = [...prev]
      for (const file of incoming) {
        if (file.category === 'cv') {
          // CV is single: replace previous CV
          const withoutCv = next.filter((f) => f.category !== 'cv')
          withoutCv.push(file)
          return withoutCv
        }
        next.push(file)
      }
      return next
    })
  }, [])

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setSubmitted(false)
  }

  const validFiles = files.filter((f) => f.status === 'uploaded')
  const hasCv = validFiles.some((f) => f.category === 'cv')
  const canSubmit = hasCv

  function handleSubmit() {
    if (!canSubmit) return
    setSubmitted(true)
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
              Formatos aceptados: PDF, JPG, PNG. Máximo 10MB por archivo.
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
                            {file.status === 'error' ? file.error ?? 'Error' : 'Cargado'}
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
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{submitted ? 'Solicitud enviada' : 'Enviar solicitud'}</span>
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
