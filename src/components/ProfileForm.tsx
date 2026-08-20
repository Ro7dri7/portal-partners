import { useState, type ReactNode } from 'react'
import { MaterialIcon } from './MaterialIcon'

export type ProfileFormValues = {
  fullName: string
  documentId: string
  phone: string
  location: string
  isLeadAuditor: boolean
  standards: string[]
  years: string
  certifier: string
}

const ISO_STANDARDS = ['ISO 9001', 'ISO 14001', 'ISO 27001', 'ISO 45001']

const STEPS = ['Datos', 'Formación', 'Documentos', 'Confirmación'] as const

const inputClass =
  'px-3 py-2 rounded-lg border border-outline-variant bg-surface font-sans text-body-md text-on-surface outline-none transition-colors focus:border-secondary focus:ring-2 focus:ring-secondary/50'

type ProfileFormProps = {
  initialValues: ProfileFormValues
  saved?: boolean
}

export default function ProfileForm({ initialValues, saved = false }: ProfileFormProps) {
  const [isLeadAuditor, setIsLeadAuditor] = useState(initialValues.isLeadAuditor)
  const [standards, setStandards] = useState<string[]>(initialValues.standards)
  const currentStep = 1

  function toggleStandard(code: string) {
    setStandards((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    )
  }

  return (
    <form method="POST" className="pb-20">
      <div className="mb-5 w-full">
        <div className="relative">
          <div className="absolute left-4 right-4 top-3.5 h-1 rounded-full bg-surface-variant" />
          <div className="absolute left-4 top-3.5 h-1 w-[25%] rounded-full bg-secondary transition-all duration-500" />
          <div className="relative z-10 flex items-start justify-between">
            {STEPS.map((label, index) => {
              const step = index + 1
              const active = step <= currentStep
              return (
                <div key={label} className="flex w-16 flex-col items-center gap-1.5">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-label-sm font-semibold ${
                      active
                        ? 'bg-secondary text-white shadow-md'
                        : 'border-2 border-outline-variant bg-white text-on-surface-variant'
                    }`}
                  >
                    {step}
                  </div>
                  <span
                    className={`text-center text-label-sm font-bold tracking-wide ${
                      active ? 'text-secondary' : 'text-on-surface-variant'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {saved && (
        <p className="mb-6 rounded-lg bg-secondary-container/20 px-4 py-3 text-body-md text-secondary">
          Perfil guardado. Puedes continuar con la siguiente etapa.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-8">
          <section className="glass-card rounded-xl border border-outline-variant/50 p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 border-b border-surface-variant pb-2 text-label-md font-semibold text-primary">
              <MaterialIcon name="person" className="text-secondary" />
              Datos personales
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Nombre completo">
                <input
                  name="fullName"
                  type="text"
                  defaultValue={initialValues.fullName}
                  placeholder="Ej. Juan Pérez"
                  className={inputClass}
                />
              </Field>
              <Field label="DNI / Pasaporte">
                <input
                  name="documentId"
                  type="text"
                  defaultValue={initialValues.documentId}
                  placeholder="Número de documento"
                  className={inputClass}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  name="phone"
                  type="tel"
                  defaultValue={initialValues.phone}
                  placeholder="+54 9 11 1234-5678"
                  className={inputClass}
                />
              </Field>
              <Field label="País / Ciudad">
                <select name="location" defaultValue={initialValues.location} className={`${inputClass} appearance-none`}>
                  <option value="" disabled>
                    Seleccione ubicación
                  </option>
                  <option value="ar">Argentina, Buenos Aires</option>
                  <option value="cl">Chile, Santiago</option>
                  <option value="pe">Perú, Lima</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="glass-card rounded-xl border border-outline-variant/50 p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 border-b border-surface-variant pb-2 text-label-md font-semibold text-primary">
              <MaterialIcon name="badge" className="text-secondary" />
              Perfil de auditor
            </h3>

            <div className="mb-3 flex items-center justify-between rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
              <div>
                <h4 className="text-label-md font-semibold text-on-surface">
                  ¿Es auditor líder certificado?
                </h4>
                <p className="text-sm text-on-surface-variant">
                  Habilite si cuenta con certificaciones vigentes.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  name="isLeadAuditor"
                  value="on"
                  className="peer sr-only"
                  checked={isLeadAuditor}
                  onChange={(e) => setIsLeadAuditor(e.target.checked)}
                />
                <span className="relative h-6 w-11 rounded-full bg-outline-variant transition-colors peer-checked:bg-secondary">
                  <span
                    className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform ${
                      isLeadAuditor ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </label>
            </div>

            {isLeadAuditor && (
              <div className="mb-3">
                <label className="mb-2 block text-label-md font-semibold text-on-surface-variant">
                  Normas ISO certificadas
                </label>
                <div className="flex flex-wrap gap-2">
                  {ISO_STANDARDS.map((code) => {
                    const checked = standards.includes(code)
                    return (
                      <label key={code} className="cursor-pointer">
                        <input
                          type="checkbox"
                          name="standards"
                          value={code}
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleStandard(code)}
                        />
                        <span
                          className={`inline-block rounded-full border px-4 py-2 text-label-md font-semibold transition-colors ${
                            checked
                              ? 'border-secondary bg-secondary text-white'
                              : 'border-outline-variant text-on-surface-variant hover:border-secondary hover:text-secondary'
                          }`}
                        >
                          {code}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Años de experiencia">
                <input
                  name="years"
                  type="number"
                  min={0}
                  defaultValue={initialValues.years}
                  placeholder="Ej. 5"
                  className={inputClass}
                />
              </Field>
              <Field label="Entidad certificadora principal">
                <input
                  name="certifier"
                  type="text"
                  defaultValue={initialValues.certifier}
                  placeholder="Ej. IRCA"
                  className={inputClass}
                />
              </Field>
            </div>
          </section>
        </div>

        <div className="flex flex-col lg:col-span-4">
          <div className="rounded-xl border border-outline-variant/50 bg-gradient-to-br from-surface to-surface-container-low p-3 shadow-sm lg:sticky lg:top-0">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <MaterialIcon name="info" className="text-[18px]" />
              <h4 className="text-label-md font-semibold">Instrucciones</h4>
            </div>
            <p className="mb-2 text-[12px] leading-snug text-on-surface-variant">
              Los datos deben coincidir con tus documentos oficiales. Se usarán en contratos y certificados.
            </p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-on-surface-variant">
              <Tip>Use nombres completos sin abreviaturas.</Tip>
              <Tip>El teléfono debe incluir código de área.</Tip>
              <Tip>Solo marque normas con certificado vigente.</Tip>
            </ul>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-end gap-3 border-t border-outline-variant/50 bg-white/90 px-4 py-2.5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] backdrop-blur-md md:left-[72px] md:px-5">
        <a
          href="/dashboard"
          className="rounded-lg border border-outline-variant px-4 py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Cancelar
        </a>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-label-md font-semibold text-white shadow-sm transition-colors hover:bg-primary-container/90"
        >
          Guardar y continuar
          <MaterialIcon name="arrow_forward" className="text-sm" />
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md font-semibold text-on-surface-variant">{label}</label>
      {children}
    </div>
  )
}

function Tip({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2">
      <MaterialIcon name="check_circle" className="mt-0.5 text-lg text-secondary" />
      {children}
    </li>
  )
}
