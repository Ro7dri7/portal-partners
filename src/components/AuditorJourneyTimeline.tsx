import { useEffect, useState } from 'react'
import { Link } from '../app-router'
import { MaterialIcon } from './MaterialIcon'
import type { JourneyStep } from '../utils/auditorProgress'

const FILL_DURATION_MS = 2800
const FILL_START_MS = 1600
const FILL_STAGGER_MS = 420

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOutProgress(t: number) {
  return 1 - (1 - t) ** 2.2
}

function useRisingFill(target: number, index: number) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (target <= 0) {
      setShown(0)
      return
    }
    if (prefersReducedMotion()) {
      setShown(target)
      return
    }

    setShown(0)
    const delay = FILL_START_MS + index * FILL_STAGGER_MS
    let raf = 0
    let start: number | null = null

    const wait = window.setTimeout(() => {
      const tick = (now: number) => {
        if (start == null) start = now
        const t = Math.min(1, (now - start) / FILL_DURATION_MS)
        setShown(target * easeOutProgress(t))
        if (t < 1) raf = requestAnimationFrame(tick)
        else setShown(target)
      }
      raf = requestAnimationFrame(tick)
    }, delay)

    return () => {
      window.clearTimeout(wait)
      cancelAnimationFrame(raf)
    }
  }, [target, index])

  return shown
}

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
const PATH = '#223D5F'

const SVG = { w: 967, h: 222, hole: 105 }
const CIRCLES = [
  { x: 71.5, y: 70.996 },
  { x: 241.5, y: 144.996 },
  { x: 403.5, y: 70.996 },
  { x: 568.5, y: 144.996 },
  { x: 730.5, y: 70.996 },
  { x: 895.5, y: 149.996 },
]

function pad(index: number) {
  return String(index + 1).padStart(2, '0')
}

export function AuditorJourneyTimeline({ steps }: AuditorJourneyTimelineProps) {
  return (
    <section className="shrink-0 rounded-xl bg-[#eef3f8] p-5 lg:px-6 lg:pt-6 lg:pb-8">
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

      <div className="relative hidden overflow-visible pt-32 pb-36 lg:block">
        <div
          className="relative mx-auto w-[86%] overflow-visible"
          style={{ aspectRatio: `${SVG.w} / ${SVG.h}` }}
        >
          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            viewBox={`0 0 ${SVG.w} ${SVG.h}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              d="M730.5 0C769.988 0 802 32.0116 802 71.5C802 76.7438 801.435 81.8556 800.363 86.7783C806.527 101.449 820.01 113.163 845.701 99.1934C858.576 86.6949 876.139 79 895.5 79C934.988 79 967 111.012 967 150.5C967 189.988 934.988 222 895.5 222C856.012 222 824 189.988 824 150.5C824 147.575 824.176 144.691 824.518 141.858C818.717 127.947 801.689 108.743 773 129.402C774.184 128.472 775.501 127.3 776.892 125.905C764.404 136.564 748.204 143 730.5 143C708.473 143 688.774 133.039 675.658 117.377C663.955 111.135 645.648 107.678 638.745 132.102C639.568 136.442 640 140.92 640 145.5C640 184.988 607.988 217 568.5 217C529.012 217 497 184.988 497 145.5C497 142.575 497.176 139.691 497.518 136.858C492.586 125.032 479.541 109.38 458.115 117.647C445 133.154 425.4 143 403.5 143C381.473 143 361.774 133.039 348.658 117.377C336.955 111.135 318.648 107.678 311.745 132.102C312.568 136.442 313 140.92 313 145.5C313 184.988 280.988 217 241.5 217C202.012 217 170 184.988 170 145.5C170 142.575 170.176 139.691 170.518 136.858C164.871 123.316 148.586 104.76 121.262 122.841C108.39 135.319 90.8426 143 71.5 143C32.0116 143 0 110.988 0 71.5C0 32.0116 32.0116 0 71.5 0C110.594 0 142.359 31.3755 142.989 70.3193C146.429 88.7748 159.438 111.737 191.701 94.1934C204.576 81.6949 222.139 74 241.5 74C260.62 74 277.988 81.5045 290.817 93.7295C302.467 101.136 323.584 105.724 332.145 76.0781C332.049 74.5644 332 73.0379 332 71.5C332 32.0116 364.012 0 403.5 0C442.988 0 475 32.0116 475 71.5C475 75.5156 474.669 79.4539 474.032 83.2891C480.478 97.2283 493.899 107.68 518.701 94.1934C531.576 81.6949 549.139 74 568.5 74C587.62 74 604.988 81.5045 617.817 93.7295C629.467 101.136 650.584 105.724 659.145 76.0781C659.049 74.5644 659 73.0379 659 71.5C659 32.0116 691.012 0 730.5 0ZM895.5 97.127C866.505 97.127 843 120.797 843 149.996C843 179.195 866.505 202.866 895.5 202.866C924.495 202.866 948 179.195 948 149.996C948 120.797 924.495 97.127 895.5 97.127ZM241.5 92.127C212.505 92.127 189 115.797 189 144.996C189 174.195 212.505 197.866 241.5 197.866C270.495 197.866 294 174.195 294 144.996C294 115.797 270.495 92.127 241.5 92.127ZM568.5 92.127C539.505 92.127 516 115.797 516 144.996C516 174.195 539.505 197.866 568.5 197.866C597.495 197.866 621 174.195 621 144.996C621 115.797 597.495 92.127 568.5 92.127ZM829.089 123.96C828.189 126.105 827.416 128.326 826.804 130.61C827.458 128.345 828.222 126.127 829.089 123.96ZM175.103 118.928C174.197 121.083 173.419 123.315 172.804 125.61C173.462 123.334 174.231 121.105 175.103 118.928ZM502.103 118.928C501.197 121.083 500.419 123.315 499.804 125.61C500.462 123.334 501.231 121.105 502.103 118.928ZM71.5 18.127C42.5052 18.127 19.0002 41.7971 19 70.9961C19 100.195 42.5051 123.866 71.5 123.866C100.495 123.866 124 100.195 124 70.9961C124 41.7971 100.495 18.127 71.5 18.127ZM403.5 18.127C374.505 18.127 351 41.7971 351 70.9961C351 100.195 374.505 123.866 403.5 123.866C432.495 123.866 456 100.195 456 70.9961C456 41.7971 432.495 18.127 403.5 18.127ZM730.5 18.127C701.505 18.127 678 41.7971 678 70.9961C678 100.195 701.505 123.866 730.5 123.866C759.495 123.866 783 100.195 783 70.9961C783 41.7971 759.495 18.127 730.5 18.127Z"
              fill={PATH}
            />
          </svg>

          {steps.slice(0, CIRCLES.length).map((step, index) => (
            <TimelineNode key={step.key} step={step} index={index} />
          ))}
        </div>
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
  const high = index % 2 === 0
  const fill = Math.max(0, Math.min(100, step.fillPercent ?? 0))
  const shown = useRisingFill(fill, index)
  const done = step.state === 'done' || fill >= 100
  const filledUp = shown >= 99.5
  const active = step.state === 'active' && !done
  const locked = step.state === 'locked' || step.state === 'pending'
  const href = locked ? undefined : step.href
  const iconName = done && filledUp ? 'check' : STEP_ICONS[step.key]
  const onTeal = shown >= 45
  const iconColor = onTeal ? '#ffffff' : locked ? LOCKED : NAVY
  const circle = (
    <div
      className={`relative z-20 flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white ${
        active ? 'timeline-pulse' : ''
      } ${href ? 'cursor-pointer transition-transform hover:scale-105' : ''}`}
    >
      {fill > 0 && <div className="timeline-fill" style={{ height: `${shown}%` }} />}
      <span
        className="timeline-icon-enter relative z-10 flex flex-col items-center"
        style={{ color: iconColor, ['--icon-delay' as string]: `${index * 90}ms` }}
      >
        <MaterialIcon
          name={iconName}
          filled={done || active}
          className={`drop-shadow-sm ${done && filledUp ? 'text-[34px]' : 'text-[32px]'}`}
        />
        <span className="text-[10px] font-black leading-none drop-shadow-sm">
          {Math.round(shown)}%
        </span>
      </span>
    </div>
  )

  const clickableCircle = href ? (
    <Link to={href} className="flex h-full w-full" aria-label={step.label}>
      {circle}
    </Link>
  ) : (
    circle
  )

  const copy = (
    <div className={`min-w-0 ${compact ? '' : 'flex flex-col items-center px-1 text-center'}`}>
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
    </div>
  )

  if (compact) {
    return (
      <li className="flex items-start gap-3">
        <div
          className="relative z-20 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] bg-white"
          style={{ borderColor: done ? COMPLETE : locked ? LOCKED : NAVY }}
        >
          {href ? (
            <Link to={href} className="flex h-full w-full" aria-label={step.label}>
              {circle}
            </Link>
          ) : (
            circle
          )}
        </div>
        {copy}
      </li>
    )
  }

  const point = CIRCLES[index]

  return (
    <div
      className="absolute z-10"
      style={{
        left: `${(point.x / SVG.w) * 100}%`,
        top: `${(point.y / SVG.h) * 100}%`,
        width: `${(SVG.hole / SVG.w) * 100}%`,
        height: `${(SVG.hole / SVG.h) * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {clickableCircle}
      <div
        className={`absolute left-1/2 w-[168%] -translate-x-1/2 ${
          high ? 'bottom-[130%]' : 'top-[130%]'
        }`}
      >
        {copy}
      </div>
    </div>
  )
}
