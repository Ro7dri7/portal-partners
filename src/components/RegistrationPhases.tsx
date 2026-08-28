import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '../app-router'
import {
  confirmIcf12Download,
  deleteDocument,
  fetchDocumentFile,
  fetchProfile,
  submitReview1,
  submitReview2,
  type ProfessionalProfile,
  type Review2Status,
  type ReviewStatus,
} from '../api'
import { MaterialIcon } from './MaterialIcon'
import { ReviewTaskCard, type ReviewTaskStatus } from './ReviewTaskCard'
import { formatFileSize, UploadZone, type UploadedFile } from './UploadZone'
import { saveUser, type PartnerUser } from '../constants'

type RegistrationPhasesProps = {
  setUser: (user: PartnerUser) => void
  onProfile: (profile: ProfessionalProfile) => void
  focusDoc?: string
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
    description:
      'Registra organización auditada, norma, fechas, días, tipo, rol como Auditor Líder y área técnica.',
    icon: 'assignment',
    acceptPdfOnly: true,
    multiple: false,
  },
] as const

const ICF12_URL = '/formats/IC.F.1.2-Application-and-Auditor-Registration-Initial.docx'

function itemStatus(
  ready: boolean,
  phaseStatus: ReviewStatus | Review2Status,
  docReview: 'pending' | 'approved' | 'rejected' = 'pending',
  locked = false,
): ReviewTaskStatus {
  if (locked) return 'locked'
  if (docReview === 'approved' || phaseStatus === 'approved') return 'approved'
  if (docReview === 'rejected') return 'rejected'
  if (phaseStatus === 'in_review' || phaseStatus === 'sent' || phaseStatus === 'validated') {
    return ready ? 'in_review' : 'pending'
  }
  return ready ? 'ready' : 'pending'
}

function canReplaceCategory(
  phaseStatus: ReviewStatus | Review2Status | string,
  docReview: 'pending' | 'approved' | 'rejected',
) {
  if (phaseStatus === 'rejected') return docReview === 'rejected'
  return !['sent', 'in_review', 'validated', 'approved'].includes(String(phaseStatus))
}

function phaseSubmitted(status: string) {
  return ['sent', 'in_review', 'validated', 'approved', 'rejected'].includes(status)
}

export function RegistrationPhases({ setUser, onProfile, focusDoc = '' }: RegistrationPhasesProps) {
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [extraZones, setExtraZones] = useState<Record<string, number>>({})
  const [askIcf12Confirm, setAskIcf12Confirm] = useState(false)
  const [icf12DonePopup, setIcf12DonePopup] = useState(false)

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setProfile(data.profile)
        onProfile(data.profile)
        setFiles(
          data.documents.map((doc) => ({
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
      .catch(() => {
        /* keep local defaults */
      })
  }, [onProfile])

  const addFiles = useCallback((incoming: UploadedFile[]) => {
    setFiles((prev) => {
      let next = [...prev]
      for (const file of incoming) {
        const index = next.findIndex((item) => item.id === file.id)
        if (index >= 0) next[index] = { ...next[index], ...file }
        else next.push(file)
      }
      return next
    })
  }, [])

  function removeFile(id: string) {
    const current = files.find((file) => file.id === id)
    if (!current) return
    const phase = current.category === 'icf12' ? review2Status : review1Status
    const docReview = current.reviewStatus || 'pending'
    if (!canReplaceCategory(phase, docReview)) return
    setFiles((prev) => prev.filter((file) => file.id !== id))
    if (current.documentId) {
      void deleteDocument(current.documentId).catch(() => {})
    }
  }

  function addExtraZone(category: string) {
    setExtraZones((prev) => ({
      ...prev,
      [category]: Math.min(4, (prev[category] || 0) + 1),
    }))
  }

  function removeExtraZone(category: string) {
    setExtraZones((prev) => ({
      ...prev,
      [category]: Math.max(0, (prev[category] || 0) - 1),
    }))
  }
  const review1Status = profile?.review1Status || 'pending'
  const review2Status = profile?.review2Status || 'locked'
  const trainingDone = Boolean(profile?.trainingCompleted)
  const review1Locked = ['sent', 'in_review', 'validated', 'approved'].includes(review1Status)
  const trainingUnlocked = phaseSubmitted(review1Status)
  const phase2Unlocked = review1Status === 'approved' && trainingDone
  const review2Frozen = ['sent', 'in_review', 'validated', 'approved'].includes(review2Status)

  const validFiles = useMemo(
    () => files.filter((file) => file.status === 'uploaded'),
    [files],
  )

  const review1Ready = useMemo(
    () => REVIEW1_DOCS.every((doc) => validFiles.some((file) => file.category === doc.category)),
    [validFiles],
  )
  const icf12Ready = validFiles.some((file) => file.category === 'icf12')
  const review1DoneCount = REVIEW1_DOCS.filter((doc) =>
    validFiles.some((file) => file.category === doc.category),
  ).length
  const firstPendingKey = REVIEW1_DOCS.find(
    (doc) => !validFiles.some((file) => file.category === doc.category),
  )?.key

  useEffect(() => {
    if (!focusDoc) return
    const timer = window.setTimeout(() => {
      document.getElementById(`doc-${focusDoc}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [focusDoc, profile])

  async function handleSubmitReview1() {
    setError('')
    if (files.some((file) => file.status === 'uploading')) {
      setError('Espera a que terminen de subirse los archivos.')
      return
    }
    if (!review1Ready) {
      setError('Completa los cuatro puntos de la fase 1 antes de enviarla.')
      return
    }
    setSaving(true)
    try {
      const result = await submitReview1()
      saveUser(result.user)
      setUser(result.user)
      setProfile(result.profile)
      onProfile(result.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la fase 1.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitReview2() {
    setError('')
    if (files.some((file) => file.status === 'uploading')) {
      setError('Espera a que terminen de subirse los archivos.')
      return
    }
    if (!phase2Unlocked) {
      setError(
        !trainingDone
          ? 'Completa el video de capacitación para habilitar la fase 2.'
          : 'La fase 2 se habilita cuando Operaciones apruebe la fase 1.',
      )
      return
    }
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
      onProfile(result.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el formato IC.F.1.2.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadIcf12() {
    const link = document.createElement('a')
    link.href = ICF12_URL
    link.download = 'IC.F.1.2 Application and Auditor Registration - Initial.docx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    if (!profile?.icf12Downloaded) {
      window.setTimeout(() => setAskIcf12Confirm(true), 400)
    }
  }

  async function handleConfirmIcf12Download() {
    setError('')
    setSaving(true)
    try {
      const data = await confirmIcf12Download()
      setProfile(data.profile)
      onProfile(data.profile)
      setAskIcf12Confirm(false)
      setIcf12DonePopup(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la descarga.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {askIcf12Confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A165E]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-level-2">
            <MaterialIcon name="download" className="text-[48px] text-[#159DBC]" />
            <p className="mt-3 text-headline-sm font-bold text-[#0A165E]">
              ¿Descargaste el formato IC.F.1.2?
            </p>
            <p className="mt-1 text-body-md text-[#64748b]">
              Confirma que el archivo se descargó en tu equipo para marcar este paso como completado.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirmIcf12Download()}
                className="rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#0A165E]/90 disabled:opacity-60"
              >
                {saving ? 'Confirmando...' : 'Sí, confirmo la descarga'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setAskIcf12Confirm(false)}
                className="rounded-lg px-4 py-2 text-label-md font-semibold text-[#64748b] hover:bg-[#eef3f8]"
              >
                Aún no
              </button>
            </div>
          </div>
        </div>
      )}

      {icf12DonePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A165E]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-level-2">
            <MaterialIcon name="check_circle" filled className="text-[48px] text-[#4ECDC4]" />
            <p className="mt-3 text-headline-sm font-bold text-[#0A165E]">Descarga confirmada</p>
            <p className="mt-1 text-body-md text-[#64748b]">
              Completa el Word y súbelo en el siguiente paso. El avance de la etapa 2 ya se actualizó
              en el dashboard.
            </p>
            <button
              type="button"
              onClick={() => setIcf12DonePopup(false)}
              className="mt-5 w-full rounded-lg bg-[#0A165E] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#0A165E]/90"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-headline-sm font-bold text-[#0A165E]">
            Fase 1 · Verificación de documentación
          </h3>
          <p className="text-label-md font-semibold text-[#64748b]">
            {review1Status === 'approved'
              ? 'Aprobada'
              : `${review1DoneCount} de ${REVIEW1_DOCS.length} puntos`}
          </p>
        </div>
        <div className="space-y-3">
          {REVIEW1_DOCS.map((doc) => {
            const categoryFiles = files.filter((file) => file.category === doc.category)
            const ready = categoryFiles.some((file) => file.status === 'uploaded')
            const docReview =
              categoryFiles.find((file) => file.reviewStatus)?.reviewStatus || 'pending'
            const replaceable = canReplaceCategory(review1Status, docReview)
            return (
              <ReviewTaskCard
                key={doc.key}
                cardId={`doc-${doc.category}`}
                title={doc.title}
                description={doc.description}
                icon={doc.icon}
                status={itemStatus(ready, review1Status, docReview)}
                defaultOpen={focusDoc === doc.category || (!focusDoc && firstPendingKey === doc.key)}
              >
                {replaceable && (
                  <>
                    {Array.from({ length: 1 + (extraZones[doc.category] || 0) }).map((_, zoneIndex) => (
                      <div key={`${doc.category}-zone-${zoneIndex}`} className={zoneIndex > 0 ? 'mt-3' : ''}>
                        <UploadZone
                          compact
                          title={doc.title}
                          description={
                            docReview === 'rejected'
                              ? 'Este documento fue observado. Quítalo y sube una versión corregida.'
                              : doc.description
                          }
                          icon="upload_file"
                          category={doc.category}
                          required={zoneIndex === 0}
                          multiple={false}
                          acceptPdfOnly={doc.acceptPdfOnly}
                          buttonLabel="Seleccionar archivo"
                          buttonVariant="primary"
                          onFiles={addFiles}
                          onRemoveZone={
                            zoneIndex > 0 ? () => removeExtraZone(doc.category) : undefined
                          }
                        />
                      </div>
                    ))}
                    {(extraZones[doc.category] || 0) < 4 && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-secondary/50 bg-white px-3 py-2 text-label-md font-semibold text-secondary hover:bg-secondary-container/10"
                        onClick={() => addExtraZone(doc.category)}
                      >
                        <MaterialIcon name="add" className="text-[18px]" />
                        Añadir otro archivo
                      </button>
                    )}
                  </>
                )}
                {!replaceable && docReview === 'approved' && (
                  <p className="mb-2 text-body-md text-on-surface-variant">
                    Documento aprobado. Puedes verlo, pero no reemplazarlo.
                  </p>
                )}
                {!replaceable && docReview !== 'approved' && ready && (
                  <p className="mb-2 text-body-md text-on-surface-variant">
                    Documento enviado. Puedes verlo; no se puede quitar mientras está en revisión.
                  </p>
                )}
                <FileList
                  files={categoryFiles}
                  canRemove={replaceable}
                  onRemove={removeFile}
                />
              </ReviewTaskCard>
            )
          })}
        </div>

        {review1Status === 'pending' || review1Status === 'rejected' ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-label-md font-bold text-on-surface">Enviar fase 1</p>
              <p className="text-body-md text-on-surface-variant">
                {review1Ready
                  ? 'Documentación lista. Intercert evaluará estos puntos.'
                  : 'Completa los cuatro puntos para habilitar el envío.'}
              </p>
            </div>
            <button
              type="button"
              disabled={saving || !review1Ready}
              onClick={() => void handleSubmitReview1()}
              className="shrink-0 rounded-lg bg-[#0A165E] px-5 py-2.5 text-label-md font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar a revisión'}
            </button>
          </div>
        ) : review1Locked && review1Status !== 'approved' ? (
          <div className="mt-5 rounded-2xl border border-warning-border bg-warning-bg px-5 py-4 text-body-md text-on-surface">
            {review1Status === 'sent'
              ? 'Documentación enviada. Esperando que Operaciones la tome en revisión.'
              : review1Status === 'validated'
                ? 'Documentación validada. Esperando la respuesta final de Operaciones.'
                : 'Documentación en revisión por el equipo de Operaciones.'}
          </div>
        ) : null}
      </section>

      <section className={trainingUnlocked ? '' : 'opacity-80'}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-headline-sm font-bold text-[#0A165E]">Fase de capacitación</h3>
          <p className="text-label-md font-semibold text-[#64748b]">
            {trainingDone ? 'Completada' : trainingUnlocked ? 'Disponible' : 'Bloqueada'}
          </p>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/40 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                trainingDone
                  ? 'bg-[#4ECDC4] text-white'
                  : trainingUnlocked
                    ? 'bg-[#0A165E] text-white'
                    : 'bg-[#e5e7eb] text-[#8A9199]'
              }`}
            >
              <MaterialIcon name={trainingDone ? 'check' : trainingUnlocked ? 'play_lesson' : 'lock'} />
            </span>
            <div>
              <p className="text-label-md font-bold text-on-surface">
                {trainingDone
                  ? 'Capacitación completada'
                  : '¿Cómo llenar tu formato IC.F.1.2?'}
              </p>
              <p className="text-body-md text-on-surface-variant">
                {trainingDone
                  ? 'Ya viste el video. La fase 2 se habilita cuando Operaciones apruebe tu documentación.'
                  : trainingUnlocked
                    ? 'Ve al centro de capacitación, mira el video (puedes adelantarlo) y al terminarlo vuelve aquí para continuar.'
                    : 'Se habilita cuando envíes la documentación de la fase 1.'}
              </p>
            </div>
          </div>
          {trainingUnlocked && (
            <Link
              to="/dashboard/capacitacion?video=icf12"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#159DBC] px-4 py-2.5 text-label-md font-semibold text-white hover:bg-[#159DBC]/90"
            >
              <MaterialIcon name="play_arrow" className="text-[20px]" />
              {trainingDone ? 'Volver a ver' : 'Ir a capacitación'}
            </Link>
          )}
        </div>
      </section>

      <section className={phase2Unlocked ? '' : 'opacity-80'}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-headline-sm font-bold text-[#0A165E]">
            Fase 2 · Registro de auditor (IC.F.1.2)
          </h3>
          <p className="text-label-md font-semibold text-[#64748b]">
            {!phase2Unlocked
              ? 'Se habilita al completar la capacitación'
              : review2Status === 'approved'
                ? 'Aprobada'
                : review2Status === 'in_review'
                  ? 'En revisión'
                  : 'Pendiente'}
          </p>
        </div>
        {!phase2Unlocked && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-outline-variant/40 bg-white px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-outline">
              <MaterialIcon name="lock" />
            </span>
            <div>
              <p className="text-label-md font-bold text-on-surface">Paso bloqueado</p>
              <p className="text-body-md text-on-surface-variant">
                {review1Status !== 'approved'
                  ? 'Cuando Intercert apruebe tu documentación y completes el video de capacitación, podrás descargar y subir el formato IC.F.1.2.'
                  : 'Completa el video de capacitación para habilitar la descarga y carga del formato IC.F.1.2.'}
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
              !phase2Unlocked
                ? 'locked'
                : review2Status === 'approved'
                  ? 'approved'
                  : Boolean(profile?.icf12Downloaded)
                    ? 'completed'
                    : 'pending'
            }
            defaultOpen={phase2Unlocked && review2Status !== 'approved'}
          >
            {!phase2Unlocked ? (
              <p className="text-body-md text-on-surface-variant">
                Este formato se habilita cuando completes la capacitación.
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
                <button
                  type="button"
                  onClick={() => void handleDownloadIcf12()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-label-md font-semibold text-on-secondary"
                >
                  <MaterialIcon name="download" className="text-[18px]" />
                  Descargar formato
                </button>
              </div>
            )}
          </ReviewTaskCard>

          <ReviewTaskCard
            title="Subir formato IC.F.1.2 completado"
            description="Adjunta el formato Word diligenciado (DOCX o PDF)."
            icon="upload_file"
            cardId="doc-icf12"
            status={itemStatus(
              icf12Ready,
              phase2Unlocked ? review2Status : 'pending',
              files.find((file) => file.category === 'icf12')?.reviewStatus || 'pending',
              !phase2Unlocked,
            )}
            defaultOpen={focusDoc === 'icf12' || (phase2Unlocked && review2Status !== 'approved')}
          >
            {!phase2Unlocked ? (
              <p className="text-body-md text-on-surface-variant">
                Cuando completes la capacitación, podrás subir aquí el formato firmado.
              </p>
            ) : (
              <>
                {canReplaceCategory(
                  review2Status,
                  files.find((file) => file.category === 'icf12')?.reviewStatus || 'pending',
                ) && (
                  <>
                    {Array.from({ length: 1 + (extraZones.icf12 || 0) }).map((_, zoneIndex) => (
                      <div key={`icf12-zone-${zoneIndex}`} className={zoneIndex > 0 ? 'mt-3' : ''}>
                        <UploadZone
                          compact
                          icon="upload_file"
                          category="icf12"
                          required={zoneIndex === 0}
                          buttonLabel="Seleccionar archivo"
                          buttonVariant="primary"
                          onFiles={addFiles}
                          onRemoveZone={
                            zoneIndex > 0 ? () => removeExtraZone('icf12') : undefined
                          }
                        />
                      </div>
                    ))}
                    {(extraZones.icf12 || 0) < 4 && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-secondary/50 bg-white px-3 py-2 text-label-md font-semibold text-secondary hover:bg-secondary-container/10"
                        onClick={() => addExtraZone('icf12')}
                      >
                        <MaterialIcon name="add" className="text-[18px]" />
                        Añadir otro archivo
                      </button>
                    )}
                  </>
                )}
                <FileList
                  files={files.filter((file) => file.category === 'icf12')}
                  canRemove={canReplaceCategory(
                    review2Status,
                    files.find((file) => file.category === 'icf12')?.reviewStatus || 'pending',
                  )}
                  onRemove={removeFile}
                />
              </>
            )}
          </ReviewTaskCard>
        </div>

        {!review2Frozen && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-label-md font-bold text-on-surface">Enviar fase 2</p>
              <p className="text-body-md text-on-surface-variant">
                {!phase2Unlocked
                  ? 'Se habilita al completar la capacitación y tener la fase 1 aprobada.'
                  : icf12Ready
                    ? 'Formato listo. Se creará una solicitud de fase 2 en Operaciones.'
                    : 'Descarga, completa y sube el Word para habilitar el envío.'}
              </p>
            </div>
            <button
              type="button"
              disabled={saving || !icf12Ready || !phase2Unlocked}
              onClick={() => void handleSubmitReview2()}
              className="shrink-0 rounded-lg bg-[#0A165E] px-5 py-2.5 text-label-md font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar a revisión'}
            </button>
          </div>
        )}
        {(review2Status === 'in_review' ||
          review2Status === 'sent' ||
          review2Status === 'validated') && (
          <div className="mt-5 rounded-2xl border border-warning-border bg-warning-bg px-5 py-4 text-body-md text-on-surface">
            {review2Status === 'sent'
              ? 'Formato IC.F.1.2 enviado. Esperando que Operaciones lo tome en revisión.'
              : review2Status === 'validated'
                ? 'Formato validado. Esperando la respuesta final de Operaciones.'
                : 'El formato IC.F.1.2 está en revisión por el equipo de Operaciones.'}
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-xl bg-error-container px-4 py-3 text-body-md text-on-error-container">
          {error}
        </p>
      )}
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
  if (!files.length) return null

  async function openFile(file: UploadedFile) {
    if (!file.documentId) return
    try {
      const result = await fetchDocumentFile(file.documentId, true)
      const url = URL.createObjectURL(result.blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5"
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => void openFile(file)}
            disabled={!file.documentId || file.status !== 'uploaded'}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-container/20 text-error">
              <MaterialIcon
                name={file.name.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'draft'}
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-label-md font-semibold text-on-surface underline-offset-2 hover:underline">
                {file.name}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {formatFileSize(file.size)}
                {file.status === 'uploading'
                  ? ' · Subiendo...'
                  : file.status === 'error'
                    ? ` · ${file.error}`
                    : ' · Guardado · Ver archivo'}
              </p>
            </div>
          </button>
          {canRemove && (
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
