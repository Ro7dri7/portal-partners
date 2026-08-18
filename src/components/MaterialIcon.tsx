type MaterialIconProps = {
  name: string
  className?: string
  filled?: boolean
}

export function MaterialIcon({ name, className = '', filled = false }: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'fill' : ''} ${className}`.trim()}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
