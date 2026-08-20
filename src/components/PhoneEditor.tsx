import { useEffect, useRef, useState } from 'react'
import {
  composePhone,
  isValidNational,
  parsePhone,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from '../data/locations'
import { MaterialIcon } from './MaterialIcon'

type PhoneEditorProps = {
  id?: string
  value: string
  extension?: string
  onChange: (phone: string, extension: string) => void
}

export function PhoneEditor({ id, value, extension = '', onChange }: PhoneEditorProps) {
  const parsed = parsePhone(value)
  const [open, setOpen] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)
  const [country, setCountry] = useState<PhoneCountry>(parsed.country)
  const [national, setNational] = useState(parsed.national)
  const [ext, setExt] = useState(extension)
  const [useFormat, setUseFormat] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) return
    const next = parsePhone(value)
    setCountry(next.country)
    setNational(next.national)
    setExt(extension)
  }, [value, extension, open])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setCountryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const preview = composePhone(country.dial, national, useFormat, country.groups)
  const valid = isValidNational(national, country)
  const original = `${value}|${extension}`
  const current = `${preview}|${ext.trim()}`
  const canSave = valid && current !== original

  function commit() {
    if (!canSave) return
    onChange(preview, ext.trim())
    setOpen(false)
    setCountryOpen(false)
  }

  function cancel() {
    const next = parsePhone(value)
    setCountry(next.country)
    setNational(next.national)
    setExt(extension)
    setUseFormat(true)
    setOpen(false)
    setCountryOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-left text-body-md outline-none transition-colors focus:border-secondary focus:ring-1 focus:ring-secondary"
      >
        <span aria-hidden="true">{parsePhone(value).country.flag}</span>
        <span className={value ? 'text-on-surface' : 'text-outline-variant'}>
          {value || `+${parsePhone(value).country.dial}…`}
        </span>
        {extension ? <span className="text-on-surface-variant">ext. {extension}</span> : null}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-2 w-[min(100%,340px)] rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 shadow-level-2"
          role="dialog"
          aria-label="Editar número de teléfono"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-label-md font-bold text-on-surface">Editar número de teléfono</h4>
            <button
              type="button"
              className="rounded-md p-0.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              aria-label="Cerrar"
              onClick={cancel}
            >
              <MaterialIcon name="close" className="text-[16px]" />
            </button>
          </div>

          <div className="relative">
            <div className="flex overflow-hidden rounded-lg border border-outline-variant bg-surface focus-within:border-secondary">
              <button
                type="button"
                className="inline-flex h-7 shrink-0 items-center gap-0.5 border-r border-outline-variant px-1.5 text-label-md hover:bg-surface-container"
                aria-label="Seleccionar país"
                onClick={() => setCountryOpen((v) => !v)}
              >
                <span aria-hidden="true">{country.flag}</span>
                <MaterialIcon name="expand_more" className="text-[14px] text-on-surface-variant" />
              </button>
              <input
                className="h-7 min-w-0 flex-1 bg-transparent px-2 text-[12px] text-on-surface outline-none"
                placeholder={`+${country.dial}…`}
                type="tel"
                value={preview}
                onChange={(e) => {
                  let raw = e.target.value.replace(/\D/g, '')
                  if (raw.startsWith(country.dial)) raw = raw.slice(country.dial.length)
                  setNational(raw.slice(0, country.nationalLength))
                }}
              />
              <input
                inputMode="numeric"
                placeholder="Extensión"
                className="h-7 w-[72px] shrink-0 border-l border-outline-variant bg-transparent px-1.5 text-[12px] text-on-surface outline-none placeholder:text-on-surface-variant"
                type="text"
                value={ext}
                onChange={(e) => setExt(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            {countryOpen && (
              <ul className="absolute left-0 top-full z-40 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-level-2">
                {PHONE_COUNTRIES.map((item) => (
                  <li key={item.iso}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-label-md hover:bg-surface-container"
                      onClick={() => {
                        setCountry(item)
                        setNational('')
                        setCountryOpen(false)
                      }}
                    >
                      <span>{item.flag}</span>
                      <span className="flex-1">{item.name}</span>
                      <span className="text-on-surface-variant">+{item.dial}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {valid ? (
            <p className="mt-1 text-[11.5px] font-semibold leading-none text-success">Validado</p>
          ) : (
            <p className="mt-1 text-[11.5px] font-semibold leading-none text-error">
              Ingresa {country.nationalLength} dígitos nacionales
            </p>
          )}

          <button
            type="button"
            className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-secondary hover:underline"
            onClick={() => setUseFormat((v) => !v)}
          >
            {useFormat ? 'Eliminar formato de número' : 'Aplicar formato de número'}
            <MaterialIcon name="info" className="text-[12px] text-on-surface-variant" />
          </button>

          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canSave}
              onClick={commit}
              className={`h-7 rounded-md px-2.5 text-[12px] font-semibold transition ${
                canSave
                  ? 'bg-primary-container text-on-primary hover:bg-primary'
                  : 'cursor-not-allowed bg-outline-variant text-on-surface-variant'
              }`}
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={cancel}
              className="h-7 rounded-md border border-outline-variant bg-surface px-2.5 text-[12px] font-semibold text-on-surface hover:border-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function isPhoneValid(value: string) {
  if (!value.trim()) return false
  const { country, national } = parsePhone(value)
  return isValidNational(national, country)
}
