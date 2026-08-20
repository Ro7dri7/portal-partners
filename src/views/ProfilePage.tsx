import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useOutletContext } from '../app-router'
import {
  createAudit,
  deleteAudit,
  deleteDocument,
  fetchProfile,
  submitReview1,
  submitReview2,
  updateAudit,
  type AuditorAudit,
  type ProfessionalProfile,
  type Review2Status,
  type ReviewStatus,
} from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import { ReviewBanner } from '../components/ReviewBanner'
import { ReviewTaskCard, type ReviewTaskStatus } from '../components/ReviewTaskCard'
import { formatFileSize, UploadZone, type UploadedFile } from '../components/UploadZone'
import { saveUser, type PartnerUser } from '../constants'

type DashboardContext = {
  user: PartnerUser
  setUser: (user: PartnerUser) => void
}

const REVIEW1_DOCS = [
  {
    key: 'cv',
    category: 'cv',
    title: 'CV documentado y actualizado',
    description: 'Adjunta tu hoja de vida vigente en PDF.',
    icon: 'badge',
    acceptPdfOnly: true,
    multiple: false,
  },
  {
    key: 'degree',
    category: 'degree',
    title: 'Diploma de estudio técnico o universitario',
    description: 'Título o constancia de egreso de formación técnica o universitaria.',
    icon: 'school',
    acceptPdfOnly: false,
    multiple: false,
  },
  {
    key: 'lead_auditor_courses',
    category: 'lead_auditor_courses',
    title: 'Certificados de cursos de Auditor Líder',
    description: 'Puedes adjuntar uno o varios certificados de Auditor Líder.',
    icon: 'workspace_premium',
    acceptPdfOnly: false,
    multiple: true,
  },
  {
    key: 'audits_relation',
    category: 'audits_relation',
    title: 'Relación de auditorías realizadas como Auditor Líder',
    description: 'Documento con el listado de auditorías ejecutadas como Auditor Líder. Solo PDF.',
    icon: 'assignment',
    acceptPdfOnly: true,
    multiple: false,
  },
] as const

const AUDIT_TYPES = ['Inicial', 'Seguimiento', 'Recertificación', 'Transición', 'Extraordinaria']

const ICF12_URL = '/formats/IC.F.1.2-Application-and-Auditor-Registration-Initial.docx'

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-body-md text-on-surface outline-none transition-colors placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary'

const emptyAuditDraft: Omit<AuditorAudit, 'id'> = {
  organization: '',
  standard: '',
  startDate: '',
  endDate: '',
  days: '',
  auditType: '',
  role: 'Auditor Líder',
  iafCode: '',
}

function itemStatus(
  ready: boolean,
  reviewStatus: ReviewStatus | Review2Status,
  locked = false,
): ReviewTaskStatus {
  if (locked) return 'locked'
  if (reviewStatus === 'approved') return 'approved'
  if (reviewStatus === 'in_review') return ready ? 'in_review' : 'pending'
  if (reviewStatus === 'rejected') return ready ? 'ready' : 'rejected'
  return ready ? 'ready' : 'pending'
}

function isAuditComplete(audit: Omit<AuditorAudit, 'id'> | AuditorAudit) {
  const days = Number(audit.days)
  return Boolean(
    audit.organization.trim() &&
      audit.standard.trim() &&
      audit.startDate.trim() &&
      audit.endDate.trim() &&
      Number.isFinite(days) &&
      days > 0 &&
      audit.auditType.trim() &&
      audit.role.trim() &&
      audit.iafCode.trim(),
  )
}

export function ProfilePage() {
  const { user, setUser } = useOutletContext<DashboardContext>()
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [audits, setAudits] = useState<AuditorAudit[]>([])
  const [draft, setDraft] = useState(emptyAuditDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isAuditor = user.role === 'partner_auditor'

  useEffect(() => {
    if (!isAuditor) return
    fetchProfile()
      .then((data) => {
        setProfile(data.profile)
        setAudits(data.audits || [])
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
        /* keep local defaults */
      })
  }, [isAuditor])

  const addFiles = useCallback((incoming: UploadedFile[]) => {
    setFiles((prev) => {
      let next = [...prev]
      for (const file of incoming) {
        const spec = REVIEW1_DOCS.find((item) => item.category === file.category)
        const single = file.category === 'icf12' || (spec && !spec.multiple)
        if (single) {
          next = next.filter((item) => item.category !== file.category || item.id === file.id)
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
    if (current?.documentId) {
      void deleteDocument(current.documentId).catch(() => {
        /* already removed from the list */
      })
    }
  }

  const validFiles = files.filter((file) => file.status === 'uploaded')
  const review1Status = profile?.review1Status || 'pending'
  const review2Status = profile?.review2Status || 'locked'
  const review1Locked = review1Status === 'in_review' || review1Status === 'approved'
  const review2Locked = review2Status === 'locked'
  const review2Frozen = review2Status === 'in_review' || review2Status === 'approved'
  const review2Open = review1Status === 'approved'

  const review1Ready = useMemo(() => {
    const docsReady = REVIEW1_DOCS.every((doc) =>
      validFiles.some((file) => file.category === doc.category),
    )
    return docsReady && audits.some((audit) => isAuditComplete(audit))
  }, [validFiles, audits])

  const icf12Ready = validFiles.some((file) => file.category === 'icf12')

  async function handleSaveAudit() {
    setError('')
    if (!isAuditComplete(draft)) {
      setError('Completa todos los campos de la auditoría, incluido el código IAF.')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const result = await updateAudit(editingId, draft)
        setAudits((prev) => prev.map((item) => (item.id === editingId ? result.audit : item)))
      } else {
        const result = await createAudit(draft)
        setAudits((prev) => [...prev, result.audit])
      }
      setDraft(emptyAuditDraft)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la auditoría.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAudit(id: string) {
    setError('')
    try {
      await deleteAudit(id)
      setAudits((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) {
        setDraft(emptyAuditDraft)
        setEditingId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la auditoría.')
    }
  }

  async function handleSubmitReview1() {
    setError('')
    if (files.some((file) => file.status === 'uploading')) {
      setError('Espera a que terminen de subirse los archivos.')
      return
    }
    if (!review1Ready) {
      setError('Completa los cinco puntos de la revisión 1 antes de enviarla.')
      return
    }
    setSaving(true)
    try {
      const result = await submitReview1()
      saveUser(result.user)
      setUser(result.user)
      setProfile(result.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la revisión 1.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitReview2() {
    setError('')
    if (!icf12Ready) {
      setError('Sube el formato IC.F.1.2 completado antes de enviarlo.')
      return
    }
    setSaving(true)
    try {
      const result = await submitReview2()
      saveUser(result.user)
      setUser(result.user)
      setProfile(result.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el formato IC.F.1.2.')
    } finally {
      setSaving(false)
    }
  }

  if (!isAuditor) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.16em] text-secondary">
            Afiliado
          </p>
          <h2 className="text-headline-lg font-bold tracking-tight text-primary">Mi perfil</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            El formulario de validación es exclusivo para Partner Auditor.
          </p>
        </header>
        <div className="max-w-xl rounded-2xl border border-outline-variant/40 bg-white p-6 shadow-level-1">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container/30 text-secondary">
              <MaterialIcon name="person" />
            </span>
            <div>
              <p className="text-body-lg font-bold text-on-surface">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-body-md text-on-surface-variant">{user.email}</p>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-label-md font-semibold text-on-surface-variant">Rol</dt>
              <dd className="text-body-md text-on-surface">Afiliado</dd>
            </div>
            <div>
              <dt className="text-label-md font-semibold text-on-surface-variant">
                Solicitud Partner Auditor
              </dt>
              <dd className="text-body-md text-on-surface">
                {user.auditorRequestStatus === 'pending'
                  ? 'En revisión'
                  : user.auditorRequestStatus === 'rejected'
                    ? 'No aprobada'
                    : user.auditorRequestStatus === 'approved'
                      ? 'Aprobada'
                      : 'Sin solicitud'}
              </dd>
            </div>
          </dl>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex text-label-md font-semibold text-secondary hover:underline"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  const review1DoneCount =
    REVIEW1_DOCS.filter((doc) => validFiles.some((file) => file.category === doc.category)).length +
    (audits.some((audit) => isAuditComplete(audit)) ? 1 : 0)
  const review1Total = REVIEW1_DOCS.length + 1
  const firstPendingKey =
    REVIEW1_DOCS.find((doc) => !validFiles.some((file) => file.category === doc.category))?.key ||
    (audits.some((audit) => isAuditComplete(audit)) ? null : 'audits')

  const banner =
    review2Status === 'approved'
      ? {
          title: '¡Felicitaciones! Ya eres Partner Auditor',
          description: 'Completaste las dos revisiones. Aquí tienes el resumen de tu registro.',
          steps: 2,
          tone: 'mint' as const,
        }
      : review2Status === 'in_review'
        ? {
            title: 'Formato IC.F.1.2 enviado',
            description: 'El equipo técnico está revisando tu Application and Auditor Registration.',
            steps: 1,
            tone: 'mint' as const,
          }
        : review1Status === 'approved'
          ? {
              title: '¡Felicitaciones! Ya puedes continuar con el registro de auditor',
              description:
                'Descarga el formato IC.F.1.2 Application and Auditor Registration - Initial, complétalo y vuelve a subirlo.',
              steps: 1,
              tone: 'mint' as const,
            }
          : {
              title: 'Completa tu validación de auditor',
              description:
                'Adjunta la documentación de la revisión 1. Cuando Intercert la apruebe, se habilitará el formato IC.F.1.2.',
              steps: 0,
              tone: 'neutral' as const,
            }

  return (
    <div className="mx-auto pb-12">
      <header className="mb-6">
        <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.16em] text-secondary">
          Partner Auditor
        </p>
        <h2 className="text-headline-lg font-bold tracking-tight text-primary">Mi perfil</h2>
      </header>

      <ReviewBanner
        title={banner.title}
        description={banner.description}
        completedSteps={banner.steps}
        tone={banner.tone}
      />

      {review1Status === 'approved' && (
        <p className="mb-3 text-label-md font-semibold text-on-surface-variant">
          Completado previamente
        </p>
      )}

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-headline-sm font-bold text-on-surface">
            1. Verificación de documentación
          </h3>
          <p className="text-label-md font-semibold text-on-surface-variant">
            {review1Status === 'approved'
              ? 'Aprobada'
              : `${review1DoneCount} de ${review1Total} puntos`}
          </p>
        </div>
        <div className="space-y-3">
          {REVIEW1_DOCS.map((doc) => {
            const categoryFiles = files.filter((file) => file.category === doc.category)
            const ready = categoryFiles.some((file) => file.status === 'uploaded')
            return (
              <ReviewTaskCard
                key={doc.key}
                title={doc.title}
                description={doc.description}
                icon={doc.icon}
                status={itemStatus(ready, review1Status)}
                defaultOpen={firstPendingKey === doc.key}
              >
                <UploadZone
                  compact
                  title={doc.title}
                  description={doc.description}
                  icon="upload_file"
                  category={doc.category}
                  required
                  multiple={doc.multiple}
                  acceptPdfOnly={doc.acceptPdfOnly}
                  buttonLabel={doc.multiple ? 'Explorar archivos' : 'Seleccionar archivo'}
                  buttonVariant="primary"
                  disabled={review1Locked}
                  onFiles={addFiles}
                />
                <FileList files={categoryFiles} locked={review1Locked} onRemove={removeFile} />
              </ReviewTaskCard>
            )
          })}

          <ReviewTaskCard
            title="Información detallada de las auditorías"
            description="Registra organización auditada, norma, fechas, días, tipo, rol como Auditor Líder y área técnica / código IAF."
            icon="fact_check"
            status={itemStatus(audits.some((audit) => isAuditComplete(audit)), review1Status)}
            defaultOpen={firstPendingKey === 'audits'}
          >
            <div className="space-y-4">
              {audits.length > 0 && (
                <ul className="space-y-2">
                  {audits.map((audit) => (
                    <li
                      key={audit.id}
                      className="rounded-xl border border-outline-variant/40 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container/20 text-secondary">
                            <MaterialIcon name="verified" className="text-[18px]" />
                          </span>
                          <div>
                            <p className="text-label-md font-bold text-on-surface">
                              {audit.organization || 'Sin organización'}
                            </p>
                            <p className="text-body-md text-on-surface-variant">
                              {audit.standard || 'Sin norma'} · {audit.auditType || 'Sin tipo'} · IAF{' '}
                              {audit.iafCode || '—'}
                            </p>
                            <p className="text-label-sm text-outline">
                              {audit.startDate || '—'} — {audit.endDate || '—'} · {audit.days || '—'}{' '}
                              días · {audit.role}
                            </p>
                          </div>
                        </div>
                        {!review1Locked && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-secondary"
                              onClick={() => {
                                setEditingId(audit.id)
                                setDraft({
                                  organization: audit.organization,
                                  standard: audit.standard,
                                  startDate: audit.startDate,
                                  endDate: audit.endDate,
                                  days: audit.days,
                                  auditType: audit.auditType,
                                  role: audit.role,
                                  iafCode: audit.iafCode,
                                })
                              }}
                              aria-label="Editar auditoría"
                            >
                              <MaterialIcon name="edit" className="text-[18px]" />
                            </button>
                            <button
                              type="button"
                              className="rounded-full p-1.5 text-on-surface-variant hover:bg-error-container/40 hover:text-error"
                              onClick={() => void handleDeleteAudit(audit.id)}
                              aria-label="Eliminar auditoría"
                            >
                              <MaterialIcon name="delete" className="text-[18px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!review1Locked && (
                <div className="rounded-xl border border-outline-variant/40 bg-white p-4">
                  <p className="mb-3 text-label-md font-bold text-on-surface">
                    {editingId ? 'Editar auditoría' : 'Nueva auditoría'}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Organización auditada">
                    <input
                      className={inputClass}
                      value={draft.organization}
                      onChange={(e) => setDraft((prev) => ({ ...prev, organization: e.target.value }))}
                    />
                  </Field>
                  <Field label="Norma auditada">
                    <input
                      className={inputClass}
                      placeholder="Ej. ISO 9001"
                      value={draft.standard}
                      onChange={(e) => setDraft((prev) => ({ ...prev, standard: e.target.value }))}
                    />
                  </Field>
                  <Field label="Fecha de inicio">
                    <input
                      type="date"
                      className={inputClass}
                      value={draft.startDate}
                      onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </Field>
                  <Field label="Fecha de fin">
                    <input
                      type="date"
                      className={inputClass}
                      value={draft.endDate}
                      onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </Field>
                  <Field label="Número de días">
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={draft.days}
                      onChange={(e) => setDraft((prev) => ({ ...prev, days: e.target.value }))}
                    />
                  </Field>
                  <Field label="Tipo de auditoría">
                    <select
                      className={inputClass}
                      value={draft.auditType}
                      onChange={(e) => setDraft((prev) => ({ ...prev, auditType: e.target.value }))}
                    >
                      <option value="">Selecciona</option>
                      {AUDIT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Rol como Auditor Líder">
                    <input
                      className={inputClass}
                      value={draft.role}
                      onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
                    />
                  </Field>
                  <Field label="Área técnica / Código IAF">
                    <input
                      className={inputClass}
                      placeholder="Ej. 17 / 29"
                      value={draft.iafCode}
                      onChange={(e) => setDraft((prev) => ({ ...prev, iafCode: e.target.value }))}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSaveAudit()}
                      className="rounded-lg bg-primary px-4 py-2.5 text-label-md font-semibold text-on-primary disabled:opacity-50"
                    >
                      {editingId ? 'Actualizar auditoría' : 'Agregar auditoría'}
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </ReviewTaskCard>
        </div>

        {review1Status === 'pending' || review1Status === 'rejected' ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-label-md font-bold text-on-surface">Enviar revisión 1</p>
              <p className="text-body-md text-on-surface-variant">
                {review1Ready
                  ? 'Documentación lista. Intercert evaluará estos puntos.'
                  : 'Completa los cinco puntos para habilitar el envío.'}
              </p>
            </div>
            <button
              type="button"
              disabled={saving || !review1Ready}
              onClick={() => void handleSubmitReview1()}
              className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar a revisión'}
            </button>
          </div>
        ) : review1Status === 'in_review' ? (
          <div className="mt-5 rounded-2xl border border-warning-border bg-warning-bg px-5 py-4 text-body-md text-on-surface">
            Documentación enviada. El equipo de Intercert está revisando estos puntos.
          </div>
        ) : null}
      </section>

      <section className={review2Locked ? 'opacity-80' : ''}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-headline-sm font-bold text-on-surface">
            2. Registro de auditor (IC.F.1.2)
          </h3>
          <p className="text-label-md font-semibold text-on-surface-variant">
            {review2Locked
              ? 'Se habilita al aprobar la revisión 1'
              : review2Status === 'approved'
                ? 'Aprobada'
                : review2Status === 'in_review'
                  ? 'En revisión'
                  : 'Pendiente'}
          </p>
        </div>
        {review2Locked && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-outline-variant/40 bg-white px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-outline">
              <MaterialIcon name="lock" />
            </span>
            <div>
              <p className="text-label-md font-bold text-on-surface">Paso bloqueado</p>
              <p className="text-body-md text-on-surface-variant">
                Cuando Intercert apruebe tu documentación, podrás descargar, completar y subir el
                formato IC.F.1.2 Application and Auditor Registration - Initial.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <ReviewTaskCard
            title="Descargar IC.F.1.2 Application and Auditor Registration - Initial"
            description="Descarga el formato oficial en Word, complétalo y vuelve a subirlo."
            icon="download"
            status={
              review2Locked ? 'locked' : review2Status === 'approved' ? 'approved' : 'pending'
            }
            defaultOpen={review2Open && review2Status !== 'approved'}
          >
            {review2Locked ? (
              <p className="text-body-md text-on-surface-variant">
                Este formato se habilita cuando Intercert apruebe la revisión 1.
              </p>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/40 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e8f0ff] text-primary">
                    <MaterialIcon name="description" />
                  </span>
                  <div>
                    <p className="text-label-md font-bold text-on-surface">
                      IC.F.1.2 Application and Auditor Registration - Initial
                    </p>
                    <p className="text-body-md text-on-surface-variant">Documento Word · .docx</p>
                  </div>
                </div>
                <a
                  href={ICF12_URL}
                  download="IC.F.1.2 Application and Auditor Registration - Initial.docx"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-label-md font-semibold text-on-secondary"
                >
                  <MaterialIcon name="download" className="text-[18px]" />
                  Descargar formato
                </a>
              </div>
            )}
          </ReviewTaskCard>

          <ReviewTaskCard
            title="Subir formato IC.F.1.2 completado"
            description="Adjunta el formato Word diligenciado (DOCX o PDF)."
            icon="upload_file"
            status={itemStatus(icf12Ready, review2Status === 'locked' ? 'pending' : review2Status, review2Locked)}
          >
            {review2Locked ? (
              <p className="text-body-md text-on-surface-variant">
                Cuando se apruebe la documentación, podrás subir aquí el formato firmado.
              </p>
            ) : (
              <>
                <UploadZone
                  compact
                  icon="upload_file"
                  category="icf12"
                  required
                  buttonLabel="Seleccionar archivo"
                  buttonVariant="primary"
                  disabled={review2Frozen}
                  onFiles={addFiles}
                />
                <FileList
                  files={files.filter((file) => file.category === 'icf12')}
                  locked={review2Frozen}
                  onRemove={removeFile}
                />
              </>
            )}
          </ReviewTaskCard>
        </div>

        {review2Open && (review2Status === 'pending' || review2Status === 'rejected') && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-label-md font-bold text-on-surface">Enviar formato IC.F.1.2</p>
              <p className="text-body-md text-on-surface-variant">
                {icf12Ready
                  ? 'El formato está listo para la segunda revisión.'
                  : 'Descarga, completa y sube el Word para habilitar el envío.'}
              </p>
            </div>
            <button
              type="button"
              disabled={saving || !icf12Ready}
              onClick={() => void handleSubmitReview2()}
              className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar formato'}
            </button>
          </div>
        )}
        {review2Status === 'in_review' && (
          <div className="mt-5 rounded-2xl border border-warning-border bg-warning-bg px-5 py-4 text-body-md text-on-surface">
            El formato IC.F.1.2 está en revisión por el equipo técnico.
          </div>
        )}
      </section>

      {error && (
        <p className="mt-6 rounded-xl bg-error-container px-4 py-3 text-body-md text-on-error-container">
          {error}
        </p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-label-md font-semibold text-on-surface">
        {label}
        <span className="text-error"> *</span>
      </span>
      {children}
    </label>
  )
}

function FileList({
  files,
  locked,
  onRemove,
}: {
  files: UploadedFile[]
  locked: boolean
  onRemove: (id: string) => void
}) {
  if (!files.length) return null
  return (
    <div className="mt-3 space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-container/20 text-error">
              <MaterialIcon
                name={file.name.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'draft'}
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-label-md font-semibold text-on-surface">{file.name}</p>
              <p className="text-label-sm text-on-surface-variant">
                {formatFileSize(file.size)}
                {file.status === 'uploading'
                  ? ' · Subiendo...'
                  : file.status === 'error'
                    ? ` · ${file.error}`
                    : ' · Guardado'}
              </p>
            </div>
          </div>
          {!locked && (
            <button
              type="button"
              className="rounded-full p-1.5 text-on-surface-variant hover:bg-error-container/40 hover:text-error"
              onClick={() => onRemove(file.id)}
              aria-label="Eliminar archivo"
            >
              <MaterialIcon name="delete" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
