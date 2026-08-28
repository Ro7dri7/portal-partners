import { useState, type ReactNode } from 'react'
import { MaterialIcon } from './MaterialIcon'

export type ReviewTaskStatus =
  | 'pending'
  | 'ready'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'locked'
  | 'completed'

const BADGE: Record<ReviewTaskStatus, { label: string; className: string } | null> = {
  pending: null,
  ready: {
    label: 'Cargado',
    className: 'bg-[#e8f4f7] text-secondary',
  },
  in_review: {
    label: 'En revisión',
    className: 'bg-warning-bg text-warning',
  },
  approved: {
    label: 'Aprobado',
    className: 'bg-[#d9f0e3] text-[#146c43]',
  },
  completed: {
    label: 'Completado',
    className: 'bg-[#d9f0e3] text-[#146c43]',
  },
  rejected: {
    label: 'Observado',
    className: 'bg-error-container text-on-error-container',
  },
  locked: {
    label: 'Bloqueado',
    className: 'bg-surface-container-high text-on-surface-variant',
  },
}

type ReviewTaskCardProps = {
  title: string
  description: string
  icon: string
  status: ReviewTaskStatus
  children?: ReactNode
  defaultOpen?: boolean
  cardId?: string
}

export function ReviewTaskCard({
  title,
  description,
  icon,
  status,
  children,
  defaultOpen = false,
  cardId,
}: ReviewTaskCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const badge = BADGE[status]
  const done = status === 'approved' || status === 'completed'
  const locked = status === 'locked'

  const iconWrap =
    done
      ? 'bg-[#1f8a4d] text-white shadow-[0_0_0_4px_rgba(31,138,77,0.12)]'
      : locked
        ? 'border border-outline-variant/70 bg-surface-container-low text-outline'
        : status === 'rejected'
          ? 'bg-error text-on-error'
          : status === 'in_review'
            ? 'bg-warning-bg text-warning'
            : status === 'ready'
              ? 'border-2 border-secondary/40 bg-secondary-container/15 text-secondary'
              : 'border border-outline-variant bg-white text-on-surface-variant'

  return (
    <div
      id={cardId}
      className={`overflow-hidden rounded-2xl border bg-white transition-all ${
        open
          ? 'border-secondary/25 shadow-level-1'
          : 'border-outline-variant/40 hover:border-outline-variant hover:shadow-level-1'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
      >
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
          <MaterialIcon
            name={done ? 'check' : locked ? 'lock' : status === 'rejected' ? 'close' : icon}
            filled={done || status === 'rejected' || status === 'in_review'}
            className="text-[22px]"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body-lg font-bold tracking-tight text-on-surface">{title}</span>
          <span className="mt-1 block max-w-2xl text-body-md leading-5 text-on-surface-variant">
            {description}
          </span>
        </span>
        {badge && (
          <span
            className={`hidden shrink-0 rounded-full px-3 py-1 text-label-sm font-bold sm:inline ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
        <MaterialIcon
          name="expand_more"
          className={`shrink-0 text-outline transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          {children && (
            <div className="border-t border-outline-variant/30 bg-surface-container-lowest/60 px-5 py-5 sm:px-6">
              {badge && (
                <span
                  className={`mb-3 inline-flex rounded-full px-3 py-1 text-label-sm font-bold sm:hidden ${badge.className}`}
                >
                  {badge.label}
                </span>
              )}
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
