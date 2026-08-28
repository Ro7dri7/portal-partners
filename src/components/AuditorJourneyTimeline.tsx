import { Link } from '../app-router'
import { MaterialIcon } from './MaterialIcon'
import type { JourneyStep } from '../utils/auditorProgress'

type AuditorJourneyTimelineProps = {
  steps: JourneyStep[]
}

const STEP_ICONS: Record<JourneyStep['key'], string> = {
  account: 'waving_hand',
  profile: 'how_to_reg',
  documents: 'handshake',
  review1: 'forum',
  icf12: 'school',
  approved: 'storefront',
}

const LOCKED = '#8A9199'
const NAVY = '#0A165E'
const COMPLETE = '#4ECDC4'

function pad(index: number) {
  return String(index + 1).padStart(2, '0')
}

export function AuditorJourneyTimeline({ steps }: AuditorJourneyTimelineProps) {
  const count = Math.max(steps.length, 1)
  const points = steps.map((_, index) => ({
    x: ((index + 0.5) / count) * 100,
    y: index % 2 === 0 ? 61 : 40,
  }))
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <section className="shrink-0 rounded-xl bg-[#eef3f8] p-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-headline-sm font-semibold text-[#0A165E]">Línea de tiempo</h3>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Completa las 6 etapas de tu proceso como Partner.
          </p>
        </div>
        <p className="shrink-0 text-label-md font-semibold text-[#159DBC]">
          {steps.filter((step) => (step.fillPercent ?? 0) >= 100 || step.state === 'done').length} /{' '}
          {steps.length}
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {steps.map((step, index) => (
          <TimelineNode key={step.key} step={step} index={index} compact />
        ))}
      </ol>

      <div className="relative hidden h-[328px] w-full lg:block">
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
            stroke="#0A165E"
            strokeWidth="2.5"
            vectorEffect="nonScalingStroke"
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
  const high = index % 2 === 1
  const fill = Math.max(0, Math.min(100, step.fillPercent ?? 0))
  const done = step.state === 'done' || fill >= 100
  const active = step.state === 'active' && !done
  const locked = step.state === 'locked' || step.state === 'pending'
  const href = locked ? undefined : step.href
  const iconName = done ? 'check' : STEP_ICONS[step.key]
  const onTeal = fill >= 45
  const iconColor = done || onTeal ? '#ffffff' : locked ? LOCKED : NAVY
  const borderColor = done ? COMPLETE : locked ? LOCKED : NAVY

  const circle = (
    <div
      className={`relative z-20 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] bg-white ${
        active ? 'timeline-pulse' : ''
      } ${href ? 'cursor-pointer transition-transform hover:scale-105' : ''}`}
      style={{ borderColor }}
    >
      {fill > 0 && (
        <div className="timeline-fill" style={{ ['--fill-to' as string]: `${fill}%` }} />
      )}
      <span className="relative z-10 flex flex-col items-center" style={{ color: iconColor }}>
        <MaterialIcon
          name={iconName}
          filled={done || active}
          className={`drop-shadow-sm ${done ? 'text-[34px]' : 'text-[32px]'}`}
        />
        <span className="text-[10px] font-black leading-none drop-shadow-sm">
          {Math.round(fill)}%
        </span>
      </span>
    </div>
  )

  const clickableCircle = href ? (
    <Link to={href} className="inline-flex" aria-label={step.label}>
      {circle}
    </Link>
  ) : (
    circle
  )

  const copy = (
    <div className={`min-w-0 ${compact ? '' : 'flex flex-col items-center px-1 text-center'}`}>
      {!compact && !high && (
        <div className="mb-2 h-8 w-0 border-l-[2px] border-dotted border-[#94a3b8]" />
      )}
      <p
        className="text-[18px] font-black leading-none tracking-tight"
        style={{ color: locked ? LOCKED : '#4592c9' }}
      >
        {pad(index)}
      </p>
      <h4
        className="mt-1 text-[12px] font-bold leading-snug"
        style={{ color: locked ? LOCKED : NAVY }}
      >
        {step.label}
      </h4>
      <p className="mt-1 text-[11px] leading-snug" style={{ color: locked ? LOCKED : '#6B7280' }}>
        {step.hint}
      </p>
      {!compact && high && (
        <div className="mt-2 h-8 w-0 border-l-[2px] border-dotted border-[#94a3b8]" />
      )}
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
          <div className="absolute left-1/2 top-0 w-[94%] -translate-x-1/2">{copy}</div>
          <div className="absolute left-1/2 top-[96px] -translate-x-1/2">{clickableCircle}</div>
        </>
      ) : (
        <>
          <div className="absolute left-1/2 top-[164px] -translate-x-1/2">{clickableCircle}</div>
          <div className="absolute left-1/2 top-[248px] w-[94%] -translate-x-1/2">{copy}</div>
        </>
      )}
    </li>
  )
}
