import { useEffect, useMemo, useRef, useState } from 'react'
import { MaterialIcon } from './MaterialIcon'

type SearchSelectProps = {
  id: string
  value: string
  options: string[]
  placeholder?: string
  disabled?: boolean
  allowCustom?: boolean
  onChange: (value: string) => void
}

export function SearchSelect({
  id,
  value,
  options,
  placeholder = 'Buscar...',
  disabled = false,
  allowCustom = false,
  onChange,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        if (!allowCustom) setQuery(value)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [allowCustom, value])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter((item) => item.toLowerCase().includes(term))
  }, [options, query])

  function select(item: string) {
    onChange(item)
    setQuery(item)
    setOpen(false)
  }

  function commitCustom() {
    const next = query.trim()
    if (allowCustom && next) {
      onChange(next)
      setQuery(next)
    } else {
      setQuery(value)
    }
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <MaterialIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline"
        />
        <input
          id={id}
          className="w-full rounded-lg border border-outline-variant bg-surface py-2.5 pl-10 pr-8 text-body-md text-on-surface outline-none transition-colors placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary disabled:bg-surface-container disabled:text-outline"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0]) select(filtered[0])
              else commitCustom()
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          onBlur={() => {
            if (allowCustom) commitCustom()
          }}
        />
      </div>
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-level-2">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-body-md text-on-surface-variant">
              {allowCustom ? 'Presiona Enter para usar este valor' : 'Sin coincidencias'}
            </li>
          )}
          {filtered.map((item) => (
            <li key={item}>
              <button
                type="button"
                className={`flex w-full px-3 py-2 text-left text-body-md hover:bg-surface-container ${
                  item === value ? 'font-semibold text-secondary' : 'text-on-surface'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
