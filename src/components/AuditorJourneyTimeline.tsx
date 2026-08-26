import { Link } from '../app-router'
import { MaterialIcon } from './MaterialIcon'
import type { JourneyStep } from '../utils/auditorProgress'

type AuditorJourneyTimelineProps = {
  steps: JourneyStep[]
  embedded?: boolean
}

const STEP_ICONS: Record<JourneyStep['key'], string> = {
  account: 'how_to_reg',
  profile: 'badge',
  documents: 'folder_open',
  review1: 'fact_check',
  icf12: 'description',
  approved: 'verified',
}

const STEP_COLORS = [
  { accent: '#00032d', soft: '#dfe0ff' },
  { accent: '#00677d', soft: '#b3ebff' },
  { accent: '#0ea5b7', soft: '#c7f4fb' },
  { accent: '#4e59a0', soft: '#dde1ff' },
  { accent: '#d97706', soft: '#fff3c4' },
  { accent: '#0f9f6e', soft: '#d1fae5' },
]

const MUTED_GREEN = '#4c9a78'
const LOCKED_GRAY = '#9aa0b4'
const LOCKED_BORDER = '#d3d6e2'

function pad(index: number) {
  return String(index + 1).padStart(2, '0')
}

export function AuditorJourneyTimeline({ steps, embedded = false }: AuditorJourneyTimelineProps) {
  const doneCount = steps.filter((step) => step.state === 'done').length
  const count = Math.max(steps.length, 1)
  const points = steps.map((_, index) => ({
    x: ((index + 0.5) / count) * 100,
    y: index % 2 === 0 ? 31.5 : 56,
  }))
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  const body = (
      <>
      {!embedded && (
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-headline-sm font-semibold text-primary">Línea de tiempo</h3>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Sigue los 6 pasos de tu proceso como Partner Auditor.
          </p>
        </div>
        <p className="shrink-0 text-label-md font-semibold text-secondary">
          {doneCount} / {steps.length}
        </p>
      </div>
      )}
      {embedded && (
        <div className="flex items-end justify-between gap-3 px-5 pt-4">
          <div>
            <h3 className="text-headline-sm font-semibold text-primary">Línea de tiempo</h3>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Sigue los 6 pasos de tu proceso como Partner Auditor.
            </p>
          </div>
          <p className="shrink-0 text-label-md font-semibold text-secondary">
            {doneCount} / {steps.length}
          </p>
        </div>
      )}

      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
        {steps.map((step, index) => (
          <TimelineNode key={step.key} step={step} index={index} compact />
        ))}
      </ol>

      <div className="relative hidden h-[400px] w-full lg:block">
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            className="timeline-zigzag"
            points={polyline}
            fill="none"
            stroke="#c5c9de"
            strokeWidth="0.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <ol className="relative z-10 grid h-full grid-cols-6">
          {steps.map((step, index) => (
            <TimelineNode key={step.key} step={step} index={index} />
          ))}
        </ol>
      </div>
      </>
  )

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col p-2 lg:p-0">{body}</div>
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-level-1">
      {body}
    </section>
  )
}

function TimelineNode({
  step,
  index,
  compact = false,
}: {
  step: JourneyStep
  index: number
  compact?: boolean
}) {
  const color = STEP_COLORS[index % STEP_COLORS.length]
  const high = index % 2 === 0
  const rejected = step.state === 'rejected'
  const active = step.state === 'active'
  const done = step.state === 'done'
  const locked = step.state === 'locked' || step.state === 'pending'
  const isDocuments = step.key === 'documents'
  const fill = isDocuments ? (step.fillPercent ?? 0) : done ? 100 : 0
  const completeGreen = done || (isDocuments && fill >= 100 && !active)
  const accent = rejected
    ? '#ba1a1a'
    : completeGreen
      ? MUTED_GREEN
      : active
        ? color.accent
        : LOCKED_GRAY
  const iconName = completeGreen
    ? 'check_circle'
    : locked
      ? 'lock'
      : STEP_ICONS[step.key]
  const iconOnFill = completeGreen || (isDocuments && fill >= 48)
  const iconColor = completeGreen || active
    ? '#ffffff'
    : isDocuments && iconOnFill
      ? '#ffffff'
      : LOCKED_GRAY
  const href = step.href

  const circle = (
    <div
      className={`relative z-20 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-[4px] bg-white ${
        active ? 'timeline-pulse' : ''
      } ${active && step.shine ? 'timeline-shine' : ''} ${href ? 'cursor-pointer transition-transform hover:scale-105' : ''}`}
      style={{
        borderColor: completeGreen ? MUTED_GREEN : active ? color.accent : LOCKED_BORDER,
        opacity: 1,
        boxShadow: active
          ? `0 0 0 6px ${color.soft}, 0 10px 22px ${color.accent}33`
          : completeGreen
            ? `0 8px 16px ${MUTED_GREEN}22`
            : '0 6px 12px rgba(15, 23, 42, 0.06)',
      }}
    >
      {isDocuments && !completeGreen && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 ${active ? 'timeline-water' : ''}`}
          style={{ height: `${fill}%`, background: color.accent }}
        />
      )}
      {(completeGreen || (active && !isDocuments)) && (
        <div
          className="absolute inset-0"
          style={{ background: completeGreen ? MUTED_GREEN : color.accent }}
        />
      )}
      <span className="relative z-10 flex flex-col items-center" style={{ color: iconColor }}>
        <MaterialIcon
          name={iconName}
          filled={done || active || completeGreen}
          className="text-[32px]"
        />
        {isDocuments && !completeGreen && (
          <span className="text-[11px] font-extrabold leading-none">{fill}%</span>
        )}
      </span>
    </div>
  )

  const clickableCircle = href ? (
    <Link to={href} className="inline-flex" aria-label={`${step.label}, ${fill}%`}>
      {circle}
    </Link>
  ) : (
    circle
  )

  const copy = (
    <div className={`min-w-0 ${compact ? '' : 'px-1 text-center'}`}>
      <p
        className="text-[22px] font-extrabold leading-none tracking-tight"
        style={{ color: accent }}
      >
        {pad(index)}
      </p>
      <h4
        className="mt-1 text-label-md font-bold"
        style={{ color: completeGreen ? MUTED_GREEN : active ? color.accent : '#767682' }}
      >
        {step.label}
      </h4>
      <p className="mt-0.5 text-sm text-on-surface-variant">{step.hint}</p>
    </div>
  )

  if (compact) {
    return (
      <li className="flex items-start gap-3">
        {clickableCircle}
        {copy}
      </li>
    )
  }

  return (
    <li className="relative h-full">
      {high ? (
        <>
          <div className="absolute left-1/2 top-0 w-[92%] -translate-x-1/2">{copy}</div>
          <div className="absolute left-1/2 top-[76px] -translate-x-1/2">{clickableCircle}</div>
        </>
      ) : (
        <>
          <div className="absolute left-1/2 top-[176px] -translate-x-1/2">{clickableCircle}</div>
          <div className="absolute left-1/2 top-[292px] w-[92%] -translate-x-1/2">{copy}</div>
        </>
      )}
    </li>
  )
}
