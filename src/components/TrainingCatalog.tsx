import { useMemo, useState } from 'react'
import { MaterialIcon } from './MaterialIcon'
import VideoPlayer from './VideoPlayer'

export type TrainingItem = {
  id: string
  area: 'operaciones' | 'comercial'
  title: string
  description: string
  tag: string
  tagTone: 'iso' | 'gestion' | 'ventas' | 'admin'
  duration: string
  durationSeconds: number
  image: string
  action: 'play' | 'download'
}

type TrainingCatalogProps = {
  items: TrainingItem[]
}

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'comercial', label: 'Comercial' },
] as const

const TAG_CLASS: Record<TrainingItem['tagTone'], string> = {
  iso: 'bg-secondary-fixed text-on-secondary-fixed',
  gestion: 'bg-primary/10 text-primary',
  ventas: 'bg-tertiary-fixed text-on-tertiary-fixed',
  admin: 'bg-primary/10 text-primary',
}

export default function TrainingCatalog({ items }: TrainingCatalogProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('todos')
  const [activeId, setActiveId] = useState<string | null>(null)

  const visible = useMemo(
    () => (filter === 'todos' ? items : items.filter((item) => item.area === filter)),
    [filter, items],
  )

  const operaciones = visible.filter((item) => item.area === 'operaciones')
  const comercial = visible.filter((item) => item.area === 'comercial')
  const active = items.find((item) => item.id === activeId)

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const selected = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-4 py-1.5 text-label-sm font-bold uppercase tracking-wider transition-colors ${
                  selected
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </section>

      {active && (
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-stack-lg shadow-level-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-headline-sm font-semibold text-primary">{active.title}</h3>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
              aria-label="Cerrar reproductor"
            >
              <MaterialIcon name="close" />
            </button>
          </div>
          <VideoPlayer title={active.title} durationSeconds={active.durationSeconds} />
        </section>
      )}

      {operaciones.length > 0 && (
        <Section
          icon="precision_manufacturing"
          iconWrap="bg-primary/5 text-primary"
          title="Área de Operaciones"
          items={operaciones}
          onPlay={setActiveId}
        />
      )}

      {operaciones.length > 0 && comercial.length > 0 && (
        <div className="my-4 h-px w-full bg-outline-variant/30" />
      )}

      {comercial.length > 0 && (
        <Section
          icon="trending_up"
          iconWrap="bg-secondary/10 text-secondary"
          title="Área Comercial"
          items={comercial}
          onPlay={setActiveId}
        />
      )}
    </div>
  )
}

function Section({
  icon,
  iconWrap,
  title,
  items,
  onPlay,
}: {
  icon: string
  iconWrap: string
  title: string
  items: TrainingItem[]
  onPlay: (id: string) => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <div className={`rounded-md p-1.5 ${iconWrap}`}>
          <MaterialIcon name={icon} filled className="text-[18px]" />
        </div>
        <h2 className="text-label-md font-semibold text-primary">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className="group flex flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface shadow-[0_2px_4px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md"
          >
            <div className="relative flex h-28 items-center justify-center overflow-hidden bg-surface-container">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${item.image}')` }}
              />
              <div className="absolute inset-0 bg-primary/20 transition-colors group-hover:bg-primary/30" />
              <button
                type="button"
                onClick={() => onPlay(item.id)}
                className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110"
                aria-label={`Reproducir ${item.title}`}
              >
                <MaterialIcon name="play_arrow" filled />
              </button>
              <span className="absolute bottom-2 right-2 rounded bg-inverse-surface/80 px-2 py-1 text-xs font-semibold text-inverse-on-surface backdrop-blur-sm">
                {item.duration}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TAG_CLASS[item.tagTone]}`}
                >
                  {item.tag}
                </span>
              </div>
              <h3 className="mb-1 text-label-md font-semibold leading-tight text-on-surface">
                {item.title}
              </h3>
              <p className="mb-2 line-clamp-2 flex-1 text-[12px] text-on-surface-variant">
                {item.description}
              </p>
              {item.action === 'play' ? (
                <button
                  type="button"
                  onClick={() => onPlay(item.id)}
                  className="mt-auto flex items-center justify-center rounded-lg bg-secondary py-1.5 text-label-md font-semibold text-on-secondary transition-colors hover:bg-secondary/90"
                >
                  Ver ahora
                </button>
              ) : (
                <a
                  href="#"
                  className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-outline py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container"
                >
                  <MaterialIcon name="download" className="text-[18px]" />
                  Descargar Manual
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
