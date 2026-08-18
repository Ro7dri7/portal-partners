import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { MaterialIcon } from './MaterialIcon'

export type UploadedFile = {
  id: string
  name: string
  size: number
  category: 'cv' | 'experience' | 'certificates'
  status: 'uploaded' | 'error'
  error?: string
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']
const ACCEPTED_EXT = ['.pdf', '.jpg', '.jpeg', '.png']

type UploadZoneProps = {
  title: string
  description: string
  icon: string
  category: UploadedFile['category']
  required?: boolean
  multiple?: boolean
  acceptPdfOnly?: boolean
  buttonLabel: string
  buttonVariant?: 'primary' | 'outline'
  onFiles: (files: UploadedFile[]) => void
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File, pdfOnly: boolean): string | null {
  const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
  if (pdfOnly) {
    if (file.type !== 'application/pdf' && ext !== '.pdf') {
      return 'Solo se permite PDF'
    }
  } else if (!ACCEPTED.includes(file.type) && !ACCEPTED_EXT.includes(ext)) {
    return 'Formato no permitido'
  }
  if (file.size > MAX_SIZE) return 'Máximo 10MB por archivo'
  return null
}

export function UploadZone({
  title,
  description,
  icon,
  category,
  required = false,
  multiple = false,
  acceptPdfOnly = false,
  buttonLabel,
  buttonVariant = 'outline',
  onFiles,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      const selected = multiple ? files : files.slice(0, 1)
      const mapped: UploadedFile[] = selected.map((file) => {
        const error = validateFile(file, acceptPdfOnly)
        return {
          id: `${category}-${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          category,
          status: error ? 'error' : 'uploaded',
          error: error ?? undefined,
        }
      })
      onFiles(mapped)
    },
    [acceptPdfOnly, category, multiple, onFiles],
  )

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) processFiles(e.target.files)
    e.target.value = ''
  }

  const accept = acceptPdfOnly ? '.pdf,application/pdf' : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface p-6 shadow-level-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-headline-sm font-semibold text-on-surface">{title}</h3>
          <p className="text-body-md text-on-surface-variant">{description}</p>
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
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? 'border-secondary bg-secondary-container/5'
            : 'border-outline-variant bg-surface-container-lowest hover:border-secondary'
        }`}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high transition-colors group-hover:bg-secondary-container/20">
          <MaterialIcon
            name={icon}
            className="text-[28px] text-outline transition-colors group-hover:text-secondary"
          />
        </div>
        <p className="mb-1 text-label-md font-semibold text-on-surface">
          Arrastra y suelta {multiple ? 'tus archivos' : 'tu archivo'} aquí
        </p>
        {!multiple && (
          <p className="mb-4 text-body-md text-on-surface-variant">o haz clic para explorar</p>
        )}
        <button
          type="button"
          className={
            buttonVariant === 'primary'
              ? 'rounded-lg bg-secondary px-6 py-2 text-label-md font-semibold text-on-secondary shadow-sm transition-colors hover:bg-secondary/90'
              : 'mt-4 rounded-lg border border-outline-variant px-6 py-2 text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container'
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

export function formatFileSize(bytes: number) {
  return formatSize(bytes)
}
