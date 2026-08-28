import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from '../app-router'
import {
  deleteDocument,
  fetchDocumentFile,
  fetchProfile,
  type Review2Status,
  type ReviewStatus,
} from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import { formatFileSize, UploadZone, type UploadedFile } from '../components/UploadZone'
import type { PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
}

type RepoFolder = 'all' | 'fase1' | 'fase2' | 'library'
type ReviewBadge = 'pending' | 'approved' | 'rejected'
type ViewMode = 'grid' | 'list'

type RepoDoc = {
  id: string
  name: string
  size: number
  category: string
  reviewStatus: ReviewBadge
  createdAt?: string
  mimeType?: string
}

const FASE1_CATEGORIES = ['cv', 'degree', 'lead_auditor_courses', 'audits_relation']
const FASE2_CATEGORIES = ['icf12']

const CATEGORY_META: Record<string, { label: string; folder: RepoFolder; icon: string }> = {
  cv: { label: 'CV documentado', folder: 'fase1', icon: 'badge' },
  degree: { label: 'Diploma de estudio', folder: 'fase1', icon: 'school' },
  lead_auditor_courses: { label: 'Certificados Auditor Líder', folder: 'fase1', icon: 'workspace_premium' },
  audits_relation: { label: 'Relación de auditorías', folder: 'fase1', icon: 'assignment' },
  icf12: { label: 'Formato IC.F.1.2', folder: 'fase2', icon: 'description' },
  experience: { label: 'Constancias de experiencia', folder: 'library', icon: 'work' },
  certificates: { label: 'Certificados adicionales', folder: 'library', icon: 'verified' },
  identity: { label: 'Identidad', folder: 'library', icon: 'id_card' },
  background: { label: 'Antecedentes', folder: 'library', icon: 'policy' },
  data_treatment: { label: 'Tratamiento de datos', folder: 'library', icon: 'gavel' },
  library: { label: 'Biblioteca', folder: 'library', icon: 'folder' },
}

const FOLDERS: Array<{ key: RepoFolder; label: string; icon: string }> = [
  { key: 'all', label: 'Todos', icon: 'folder_copy' },
  { key: 'fase1', label: 'Fase 1', icon: 'fact_check' },
  { key: 'fase2', label: 'Fase 2', icon: 'description' },
  { key: 'library', label: 'Biblioteca', icon: 'inventory_2' },
]

function folderOf(category: string): RepoFolder {
  return CATEGORY_META[category]?.folder || 'library'
}

function categoryLabel(category: string) {
  return CATEGORY_META[category]?.label || category
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'picture_as_pdf'
  if (['doc', 'docx'].includes(ext)) return 'description'
  if (['xls', 'xlsx'].includes(ext)) return 'table_chart'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (ext === 'zip') return 'folder_zip'
  return 'insert_drive_file'
}

function isPreviewable(doc: RepoDoc) {
  const ext = doc.name.split('.').pop()?.toLowerCase() || ''
  const mime = doc.mimeType || ''
  return (
    ext === 'pdf' ||
    mime.includes('pdf') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ||
    mime.startsWith('image/')
  )
}

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function reviewLabel(status: ReviewBadge) {
  if (status === 'approved') return 'Aprobado'
  if (status === 'rejected') return 'Observado'
  return 'Pendiente'
}

function canDeleteDoc(
  category: string,
  docReview: ReviewBadge,
  review1Status: ReviewStatus,
  review2Status: Review2Status,
) {
  const phase = FASE1_CATEGORIES.includes(category)
    ? review1Status
    : FASE2_CATEGORIES.includes(category)
      ? review2Status
      : 'pending'
  if (phase === 'rejected') return docReview === 'rejected'
  return !['sent', 'in_review', 'validated', 'approved'].includes(String(phase))
}

export function DocumentsPage() {
  const { user } = useOutletContext<DashboardContext>()
  const [docs, setDocs] = useState<RepoDoc[]>([])
  const [folder, setFolder] = useState<RepoFolder>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [review1Status, setReview1Status] = useState<ReviewStatus>('pending')
  const [review2Status, setReview2Status] = useState<Review2Status>('locked')
  const [preview, setPreview] = useState<{ doc: RepoDoc; url: string; type: string } | null>(null)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setReview1Status(data.profile.review1Status || 'pending')
        setReview2Status(data.profile.review2Status || 'locked')
        setDocs(
          data.documents.map((doc) => ({
            id: String(doc.id),
            name: doc.file_name,
            size: doc.file_size || 0,
            category: doc.category,
            reviewStatus: doc.review_status || 'pending',
            createdAt: doc.created_at,
            mimeType: doc.mime_type || undefined,
          })),
        )
      })
      .catch(() => {
        setError('No se pudo cargar el repositorio.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const addFiles = useCallback((incoming: UploadedFile[]) => {
    setError('')
    setDocs((prev) => {
      let next = [...prev]
      for (const file of incoming) {
        const mapped: RepoDoc = {
          id: file.documentId || file.id,
          name: file.name,
          size: file.size,
          category: file.category,
          reviewStatus: 'pending',
        }
        if (file.status === 'error') {
          next = next.filter((item) => item.id !== file.id)
          continue
        }
        const index = next.findIndex((item) => item.id === file.id || item.id === file.documentId)
        if (file.status === 'uploading') {
          if (index < 0) next = [{ ...mapped, id: file.id }, ...next]
          continue
        }
        if (index >= 0) next[index] = mapped
        else next = [mapped, ...next.filter((item) => item.id !== file.id)]
      }
      return next
    })
  }, [])

  const counts = useMemo(() => {
    return {
      all: docs.length,
      fase1: docs.filter((doc) => folderOf(doc.category) === 'fase1').length,
      fase2: docs.filter((doc) => folderOf(doc.category) === 'fase2').length,
      library: docs.filter((doc) => folderOf(doc.category) === 'library').length,
      approved: docs.filter((doc) => doc.reviewStatus === 'approved').length,
      rejected: docs.filter((doc) => doc.reviewStatus === 'rejected').length,
      pending: docs.filter((doc) => doc.reviewStatus === 'pending').length,
    }
  }, [docs])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return docs.filter((doc) => {
      if (folder !== 'all' && folderOf(doc.category) !== folder) return false
      if (!needle) return true
      return (
        doc.name.toLowerCase().includes(needle) ||
        categoryLabel(doc.category).toLowerCase().includes(needle)
      )
    })
  }, [docs, folder, query])

  async function handleDownload(doc: RepoDoc) {
    setError('')
    setBusyId(doc.id)
    try {
      const file = await fetchDocumentFile(doc.id, false)
      const url = URL.createObjectURL(file.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.fileName || doc.name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el archivo.')
    } finally {
      setBusyId('')
    }
  }

  async function handlePreview(doc: RepoDoc) {
    setError('')
    setBusyId(doc.id)
    try {
      const file = await fetchDocumentFile(doc.id, true)
      if (preview?.url) URL.revokeObjectURL(preview.url)
      setPreview({
        doc,
        url: URL.createObjectURL(file.blob),
        type: file.contentType,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo.')
    } finally {
      setBusyId('')
    }
  }

  async function handleDelete(doc: RepoDoc) {
    if (!canDeleteDoc(doc.category, doc.reviewStatus, review1Status, review2Status)) return
    setError('')
    setDocs((prev) => prev.filter((item) => item.id !== doc.id))
    try {
      await deleteDocument(doc.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el archivo.')
      setDocs((prev) => [doc, ...prev])
    }
  }

  if (user.role !== 'partner_auditor') {
    return (
      <div className="mx-auto max-w-container-max">
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1">
          <MaterialIcon name="lock" className="mb-3 text-4xl text-outline" />
          <h2 className="mb-2 text-headline-lg font-bold text-on-surface">Repositorio no habilitado</h2>
          <p className="mb-4 max-w-2xl text-body-md text-on-surface-variant">
            El repositorio de documentos es exclusivo del rol Partner Auditor.
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
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="mb-1 text-headline-lg font-bold text-on-surface">Repositorio de documentos</h2>
          <p className="max-w-2xl text-body-md text-on-surface-variant">
            Consulta, descarga y organiza los archivos de tu proceso. La documentación de Fase 1 y
            Fase 2 se carga desde{' '}
            <Link to="/dashboard/perfil" className="font-semibold text-secondary hover:underline">
              Mi perfil
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`rounded-lg p-2 ${view === 'grid' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}
            aria-label="Vista en cuadrícula"
          >
            <MaterialIcon name="grid_view" className="text-[20px]" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`rounded-lg p-2 ${view === 'list' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}
            aria-label="Vista en lista"
          >
            <MaterialIcon name="view_list" className="text-[20px]" />
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon="inventory_2" label="Archivos" value={counts.all} />
        <StatCard icon="check_circle" label="Aprobados" value={counts.approved} tone="success" />
        <StatCard icon="cancel" label="Observados" value={counts.rejected} tone="error" />
        <StatCard icon="schedule" label="Pendientes" value={counts.pending} />
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-level-1">
            <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
              Carpetas
            </p>
            <nav className="space-y-1">
              {FOLDERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFolder(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    folder === item.key
                      ? 'bg-secondary-container/30 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <MaterialIcon name={item.icon} filled={folder === item.key} />
                  <span className="flex-1 text-label-md font-semibold">{item.label}</span>
                  <span className="text-label-sm font-bold">{counts[item.key]}</span>
                </button>
              ))}
            </nav>
            <div className="mt-4 border-t border-outline-variant/30 px-2 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                Expediente
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Fase 1: {reviewLabel(review1Status === 'approved' ? 'approved' : review1Status === 'rejected' ? 'rejected' : 'pending')}
              </p>
              <p className="text-sm text-on-surface-variant">
                Fase 2:{' '}
                {review2Status === 'locked'
                  ? 'Bloqueada'
                  : reviewLabel(
                      review2Status === 'approved'
                        ? 'approved'
                        : review2Status === 'rejected'
                          ? 'rejected'
                          : 'pending',
                    )}
              </p>
            </div>
          </div>
        </aside>

        <section className="space-y-4 lg:col-span-9">
          <div className="relative">
            <MaterialIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o tipo de documento..."
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none transition-colors focus:border-secondary"
            />
          </div>

          {folder === 'library' && (
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-level-1">
              <h3 className="mb-1 text-headline-sm font-semibold text-on-surface">Agregar a la biblioteca</h3>
              <p className="mb-3 text-body-md text-on-surface-variant">
                Archivos de apoyo que no forman parte de la solicitud oficial.
              </p>
              <UploadZone
                icon="cloud_upload"
                category="certificates"
                multiple
                buttonLabel="Subir archivos"
                buttonVariant="primary"
                compact
                onFiles={addFiles}
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
              {error}
            </p>
          )}

          {loading ? (
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-10 text-center text-on-surface-variant">
              Cargando repositorio...
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center">
              <MaterialIcon name="folder_off" className="mb-3 text-5xl text-outline" />
              <h3 className="text-headline-sm font-semibold text-on-surface">Sin documentos en esta carpeta</h3>
              <p className="mt-1 max-w-md text-body-md text-on-surface-variant">
                {folder === 'library'
                  ? 'Sube certificados o constancias para guardarlos aquí.'
                  : 'Carga la documentación oficial desde Mi perfil para verla en el repositorio.'}
              </p>
              {folder !== 'library' && (
                <Link
                  to="/dashboard/perfil"
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90"
                >
                  Ir a Mi perfil
                </Link>
              )}
            </div>
          ) : view === 'grid' ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((doc) => (
                <li key={doc.id}>
                  <DocCard
                    doc={doc}
                    busy={busyId === doc.id}
                    canDelete={canDeleteDoc(doc.category, doc.reviewStatus, review1Status, review2Status)}
                    onPreview={isPreviewable(doc) ? handlePreview : undefined}
                    onDownload={() => handleDownload(doc)}
                    onDelete={() => handleDelete(doc)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-level-1">
              {visible.map((doc, index) => (
                <li
                  key={doc.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    index < visible.length - 1 ? 'border-b border-outline-variant/20' : ''
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-container/10">
                    <MaterialIcon name={fileIcon(doc.name)} className="text-error" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-md font-semibold text-on-surface">{doc.name}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {categoryLabel(doc.category)} · {formatFileSize(doc.size)} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <StatusChip status={doc.reviewStatus} />
                  <DocActions
                    busy={busyId === doc.id}
                    canPreview={isPreviewable(doc)}
                    canDelete={canDeleteDoc(doc.category, doc.reviewStatus, review1Status, review2Status)}
                    onPreview={() => handlePreview(doc)}
                    onDownload={() => handleDownload(doc)}
                    onDelete={() => handleDelete(doc)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/70 p-4"
          onClick={() => {
            URL.revokeObjectURL(preview.url)
            setPreview(null)
          }}
        >
          <div
            className="flex h-[min(90vh,840px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-level-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-label-md font-semibold text-on-surface">{preview.doc.name}</p>
                <p className="text-xs text-on-surface-variant">{categoryLabel(preview.doc.category)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(preview.doc)}
                  className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-md font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Descargar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(preview.url)
                    setPreview(null)
                  }}
                  className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container"
                  aria-label="Cerrar vista previa"
                >
                  <MaterialIcon name="close" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-[#0a0c18]">
              {preview.type.startsWith('image/') ? (
                <img src={preview.url} alt={preview.doc.name} className="h-full w-full object-contain" />
              ) : (
                <iframe title={preview.doc.name} src={preview.url} className="h-full w-full border-0 bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string
  label: string
  value: number
  tone?: 'success' | 'error'
}) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-level-1">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <MaterialIcon
          name={icon}
          className={tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'text-secondary'}
        />
        <span className="text-label-sm font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-headline-md font-bold text-primary">{value}</p>
    </div>
  )
}

function StatusChip({ status }: { status: ReviewBadge }) {
  const styles =
    status === 'approved'
      ? 'bg-success/15 text-success'
      : status === 'rejected'
        ? 'bg-error-container text-on-error-container'
        : 'bg-warning-bg text-warning'
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${styles}`}>
      {reviewLabel(status)}
    </span>
  )
}

function DocActions({
  busy,
  canPreview,
  canDelete,
  onPreview,
  onDownload,
  onDelete,
}: {
  busy: boolean
  canPreview: boolean
  canDelete: boolean
  onPreview: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {canPreview && (
        <button
          type="button"
          disabled={busy}
          onClick={onPreview}
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-secondary disabled:opacity-40"
          title="Vista previa"
        >
          <MaterialIcon name="visibility" className="text-[20px]" />
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onDownload}
        className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-secondary disabled:opacity-40"
        title="Descargar"
      >
        <MaterialIcon name="download" className="text-[20px]" />
      </button>
      {canDelete && (
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-error-container/40 hover:text-error disabled:opacity-40"
          title="Eliminar"
        >
          <MaterialIcon name="delete" className="text-[20px]" />
        </button>
      )}
    </div>
  )
}

function DocCard({
  doc,
  busy,
  canDelete,
  onPreview,
  onDownload,
  onDelete,
}: {
  doc: RepoDoc
  busy: boolean
  canDelete: boolean
  onPreview?: (doc: RepoDoc) => void
  onDownload: () => void
  onDelete: () => void
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-level-1">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-error-container/10">
          <MaterialIcon name={fileIcon(doc.name)} className="text-[26px] text-error" />
        </div>
        <StatusChip status={doc.reviewStatus} />
      </div>
      <h3 className="line-clamp-2 min-h-10 text-label-md font-semibold text-on-surface">{doc.name}</h3>
      <p className="mt-1 text-xs text-on-surface-variant">{categoryLabel(doc.category)}</p>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        {formatFileSize(doc.size)} · {formatDate(doc.createdAt)}
      </p>
      <div className="mt-auto flex items-center justify-end pt-3">
        <DocActions
          busy={busy}
          canPreview={Boolean(onPreview)}
          canDelete={canDelete}
          onPreview={() => onPreview?.(doc)}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}
