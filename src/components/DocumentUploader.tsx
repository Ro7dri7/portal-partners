import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { MaterialIcon } from './MaterialIcon'

export type DocumentStatus = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado'
type DocCategory = 'cv' | 'experience' | 'certificates'

type UploadedItem = {
  id: string
  name: string
  size: number
  category: DocCategory
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

type DocumentUploaderProps = {
  initialStatus?: DocumentStatus
  maxSizeMb?: number
}

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']
const ACCEPTED_EXT = ['.pdf', '.jpg', '.jpeg', '.png']

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File, maxBytes: number, pdfOnly: boolean): string | null {
  const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
  if (pdfOnly && file.type !== 'application/pdf' && ext !== '.pdf') return 'Solo se permite PDF'
  if (!pdfOnly && !ACCEPTED.includes(file.type) && !ACCEPTED_EXT.includes(ext)) {
    return 'Formato no permitido'
  }
  if (file.size > maxBytes) return `Máximo ${Math.round(maxBytes / (1024 * 1024))}MB`
  return null
}

export default function DocumentUploader({
  initialStatus = 'pendiente',
  maxSizeMb = 10,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedItem[]>([])
  const [submitted, setSubmitted] = useState(false)
  const maxBytes = maxSizeMb * 1024 * 1024

  const simulateUpload = useCallback((item: UploadedItem) => {
    let progress = 0
    const timer = window.setInterval(() => {
      progress += Math.floor(Math.random() * 25) + 10
      if (progress >= 100) {
        window.clearInterval(timer)
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, progress: 100, status: 'done' } : f)),
        )
        return
      }
      setFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, progress } : f)))
    }, 200)
  }, [])

  const addFiles = useCallback(
    (list: FileList | File[], category: DocCategory, pdfOnly: boolean, multiple: boolean) => {
      const selected = multiple ? Array.from(list) : Array.from(list).slice(0, 1)
      const nextItems: UploadedItem[] = selected.map((file) => {
        const error = validateFile(file, maxBytes, pdfOnly)
        return {
          id: `${category}-${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          category,
          progress: error ? 0 : 5,
          status: error ? 'error' : 'uploading',
          error: error ?? undefined,
        }
      })

      setSubmitted(false)
      setFiles((prev) => {
        if (category === 'cv') {
          return [...prev.filter((f) => f.category !== 'cv'), ...nextItems]
        }
        return [...nextItems, ...prev]
      })
      nextItems.filter((f) => f.status === 'uploading').forEach(simulateUpload)
    },
    [maxBytes, simulateUpload],
  )

  const hasCv = files.some((f) => f.category === 'cv' && f.status === 'done')
  const canSubmit = hasCv

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex items-start gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
          <MaterialIcon name="info" className="mt-0.5 text-[18px] text-secondary" />
          <p className="text-body-md text-on-surface-variant">
            Formatos: PDF, JPG, PNG. Máximo {maxSizeMb}MB. Expediente:{' '}
            <span className="font-semibold text-secondary">{initialStatus}</span>
          </p>
        </div>

        <UploadZone
          title="CV / Hoja de vida"
          description="Solo formato PDF. Obligatorio."
          icon="upload_file"
          required
          pdfOnly
          buttonLabel="Seleccionar Archivo"
          buttonVariant="primary"
          extraHint="o haz clic para explorar"
          onFiles={(list) => addFiles(list, 'cv', true, false)}
        />

        <UploadZone
          title="Constancias de experiencia"
          description="Múltiples archivos permitidos."
          icon="folder_open"
          multiple
          buttonLabel="Explorar Archivos"
          onFiles={(list) => addFiles(list, 'experience', false, true)}
        />

        <UploadZone
          title="Certificados adicionales"
          description="Opcional."
          icon="workspace_premium"
          multiple
          buttonLabel="Explorar Archivos"
          onFiles={(list) => addFiles(list, 'certificates', false, true)}
        />
      </div>

      <div className="lg:col-span-1">
        <div className="rounded-xl border border-outline-variant/50 bg-surface p-3 shadow-level-1 lg:sticky lg:top-0">
          <h3 className="mb-2 border-b border-outline-variant/30 pb-2 text-label-md font-semibold text-on-surface">
            Archivos Cargados
          </h3>
          <div className="mb-3 max-h-[220px] space-y-2 overflow-y-auto">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center opacity-50">
                <MaterialIcon name="insert_drive_file" className="mb-1 text-2xl" />
                <p className="text-body-md">Aún no hay archivos</p>
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border border-outline-variant/50 p-3 transition-colors hover:bg-surface-container-lowest"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-error-container/10">
                      <MaterialIcon
                        name={file.name.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                        className="text-error"
                      />
                    </div>
                    <div className="overflow-hidden">
                      <p className="truncate text-label-md font-semibold text-on-surface">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-on-surface-variant">{formatSize(file.size)}</span>
                        <span className="h-1 w-1 rounded-full bg-outline-variant" />
                        <span
                          className={`text-label-sm font-bold tracking-wide ${
                            file.status === 'error' ? 'text-error' : 'text-secondary'
                          }`}
                        >
                          {file.status === 'error'
                            ? file.error
                            : file.status === 'done'
                              ? 'Cargado'
                              : `${file.progress}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Eliminar"
                    className="p-1 text-on-surface-variant transition-colors hover:text-error"
                    onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
                  >
                    <MaterialIcon name="delete" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-outline-variant/30 pt-3">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => setSubmitted(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{submitted ? 'Solicitud enviada' : 'Enviar solicitud'}</span>
              <MaterialIcon name={submitted ? 'check_circle' : 'send'} className="text-sm" />
            </button>
            <p className="mt-2 text-center text-label-sm font-bold tracking-wide text-on-surface-variant">
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
  )
}

function UploadZone({
  title,
  description,
  icon,
  required = false,
  multiple = false,
  pdfOnly = false,
  buttonLabel,
  buttonVariant = 'outline',
  extraHint,
  onFiles,
}: {
  title: string
  description: string
  icon: string
  required?: boolean
  multiple?: boolean
  pdfOnly?: boolean
  buttonLabel: string
  buttonVariant?: 'primary' | 'outline'
  extraHint?: string
  onFiles: (files: FileList) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) onFiles(e.target.files)
    e.target.value = ''
  }

  const accept = pdfOnly
    ? '.pdf,application/pdf'
    : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface p-3 shadow-level-1">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-label-md font-semibold text-on-surface">{title}</h3>
          <p className="text-[12px] text-on-surface-variant">{description}</p>
        </div>
        {required && (
          <span className="shrink-0 rounded-full border border-error/20 bg-error-container/20 px-3 py-1 text-label-sm font-bold tracking-wide text-error">
            Requerido
          </span>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group flex cursor-pointer items-center justify-center gap-4 rounded-lg border-2 border-dashed px-4 py-3 text-left transition-colors ${
          dragging
            ? 'border-secondary bg-secondary-container/5'
            : 'border-outline-variant bg-surface-container-lowest hover:border-secondary'
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high transition-colors group-hover:bg-secondary-container/20">
          <MaterialIcon
            name={icon}
            className="text-[20px] text-outline transition-colors group-hover:text-secondary"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-label-md font-semibold text-on-surface">
            Arrastra {multiple ? 'tus archivos' : 'tu archivo'} aquí
            {extraHint ? ` ${extraHint}` : ''}
          </p>
        </div>
        <button
          type="button"
          className={
            buttonVariant === 'primary'
              ? 'shrink-0 rounded-lg bg-secondary px-3 py-1.5 text-label-md font-semibold text-on-secondary shadow-sm transition-colors hover:bg-secondary/90'
              : 'shrink-0 rounded-lg border border-outline-variant px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container'
          }
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
        >
          {buttonLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
