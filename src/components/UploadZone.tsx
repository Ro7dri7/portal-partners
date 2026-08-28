import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { uploadDocument } from '../api'
import { MaterialIcon } from './MaterialIcon'

export type UploadedFile = {
  id: string
  name: string
  size: number
  category: string
  status: 'uploading' | 'uploaded' | 'error'
  error?: string
  documentId?: string
  reviewStatus?: 'pending' | 'approved' | 'rejected'
}

const MAX_SIZE = Number(import.meta.env.VITE_MAX_FILE_SIZE || 524288000)
const ACCEPTED_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.zip']

type UploadZoneProps = {
  title?: string
  description?: string
  icon: string
  category: string
  required?: boolean
  multiple?: boolean
  acceptPdfOnly?: boolean
  buttonLabel: string
  buttonVariant?: 'primary' | 'outline'
  compact?: boolean
  disabled?: boolean
  onFiles: (files: UploadedFile[]) => void
  onRemoveZone?: () => void
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
  } else if (!ACCEPTED_EXT.includes(ext)) {
    return 'Formato no permitido'
  }
  if (file.size > MAX_SIZE) return `Máximo ${formatSize(MAX_SIZE)} por archivo`
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
  compact = false,
  disabled = false,
  onFiles,
  onRemoveZone,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (disabled) return
      const files = Array.from(fileList)
      const selected = multiple ? files : files.slice(0, 1)
      for (const file of selected) {
        const localId = `${category}-${file.name}-${file.size}-${Date.now()}-${Math.random()}`
        const validationError = validateFile(file, acceptPdfOnly)
        const base = {
          id: localId,
          name: file.name,
          size: file.size,
          category,
        }
        if (validationError) {
          onFiles([{ ...base, status: 'error', error: validationError }])
          continue
        }
        onFiles([{ ...base, status: 'uploading' }])
        try {
          const result = await uploadDocument(file, category)
          onFiles([
            {
              ...base,
              documentId: String(result.document.id),
              size: result.document.file_size || file.size,
              status: 'uploaded',
            },
          ])
        } catch (err) {
          onFiles([
            {
              ...base,
              status: 'error',
              error: err instanceof Error ? err.message : 'No se pudo subir el archivo.',
            },
          ])
        }
      }
    },
    [acceptPdfOnly, category, disabled, multiple, onFiles],
  )

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) void processFiles(e.dataTransfer.files)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) void processFiles(e.target.files)
    e.target.value = ''
  }

  const accept = acceptPdfOnly
    ? '.pdf,application/pdf'
    : '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.zip'

  const dropClass = `group flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${
    disabled
      ? 'cursor-not-allowed border-outline-variant/50 bg-surface-container-low opacity-70'
      : dragging
        ? 'border-secondary bg-secondary-container/10'
        : 'border-outline-variant/70 bg-white hover:border-secondary hover:bg-secondary-container/5'
  } ${compact ? 'flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:text-left' : 'flex-col p-8'}`

  const dropZone = (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={dropClass}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-secondary-container/20 text-secondary ${
          compact ? 'h-11 w-11' : 'mb-4 h-12 w-12'
        }`}
      >
        <MaterialIcon name={icon} className={compact ? 'text-[22px]' : 'text-[28px]'} />
      </div>
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <p className="mb-0.5 text-label-md font-semibold text-on-surface">
          Arrastra y suelta {multiple ? 'tus archivos' : 'tu archivo'} aquí
        </p>
        <p className="text-body-md text-on-surface-variant">
          {acceptPdfOnly ? 'Solo PDF.' : 'PDF, Word o imagen. O haz clic para explorar.'}
        </p>
      </div>
      <div className={`flex items-center gap-2 ${compact ? 'shrink-0' : 'mt-4'}`}>
        <button
          type="button"
          disabled={disabled}
          className={
            buttonVariant === 'primary'
              ? 'rounded-lg bg-secondary px-5 py-2 text-label-md font-semibold text-on-secondary shadow-sm transition-colors hover:bg-secondary/90 disabled:opacity-50'
              : 'rounded-lg border border-outline-variant px-5 py-2 text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50'
          }
          onClick={(e) => {
            e.stopPropagation()
            if (!disabled) inputRef.current?.click()
          }}
        >
          {buttonLabel}
        </button>
        {onRemoveZone && (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error"
            aria-label="Quitar este espacio de carga"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveZone()
            }}
          >
            <MaterialIcon name="close" className="text-[20px]" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  )

  if (compact) {
    return dropZone
  }

  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface p-6 shadow-level-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-headline-sm font-semibold text-on-surface">
            {title}
            {required && <span className="text-error"> *</span>}
          </h3>
          <p className="text-body-md text-on-surface-variant">{description}</p>
        </div>
        {required && (
          <span className="shrink-0 rounded-full border border-error/20 bg-error-container/20 px-3 py-1 text-label-sm font-bold tracking-wide text-error">
            Requerido
          </span>
        )}
      </div>
      {dropZone}
    </div>
  )
}

export function formatFileSize(bytes: number) {
  return formatSize(bytes)
}
