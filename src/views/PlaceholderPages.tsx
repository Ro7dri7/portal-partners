export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-container-max">
      <h2 className="mb-2 text-headline-lg font-bold text-primary">{title}</h2>
      <p className="text-body-lg text-on-surface-variant">{description}</p>
      <div className="mt-stack-lg rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack-lg shadow-level-1">
        <p className="text-body-md text-on-surface-variant">
          Esta sección estará disponible en una próxima iteración.
        </p>
      </div>
    </div>
  )
}
