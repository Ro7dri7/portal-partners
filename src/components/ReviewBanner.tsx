function BannerIllustration() {
  return (
    <svg viewBox="0 0 240 160" className="h-[132px] w-[200px] shrink-0" aria-hidden="true">
      <ellipse cx="168" cy="138" rx="58" ry="10" fill="#b7dcc9" />
      <rect x="28" y="96" width="54" height="40" rx="8" fill="#16382b" />
      <path d="M40 92c0-14 12-24 24-20 8 3 12 12 10 22" fill="#2b1a14" />
      <circle cx="58" cy="70" r="16" fill="#3b241c" />
      <path d="M40 88c8-4 22-4 32 2 4 14-2 28-16 30-12 2-22-10-16-32z" fill="#e36b2c" />
      <rect x="48" y="108" width="22" height="18" rx="4" fill="#f4ebe3" />
      <path d="M70 48h32l8 14H78z" fill="#1f6b4a" />
      <rect x="128" y="86" width="78" height="48" rx="10" fill="#16382b" />
      <rect x="140" y="98" width="54" height="28" rx="4" fill="#e7f6ee" />
      <circle cx="162" cy="64" r="16" fill="#3b241c" />
      <path d="M146 80c10-6 28-4 34 6 2 16-8 28-20 28s-20-14-14-34z" fill="#f08a3a" />
      <path d="M186 44h30l-8 14h-30z" fill="#f7fbf8" />
      <circle cx="196" cy="50" r="3" fill="#1f6b4a" />
    </svg>
  )
}

type ReviewBannerProps = {
  title: string
  description: string
  completedSteps: number
  totalSteps?: number
  tone?: 'mint' | 'neutral'
}

export function ReviewBanner({
  title,
  description,
  completedSteps,
  totalSteps = 2,
  tone = 'mint',
}: ReviewBannerProps) {
  const ratio = Math.min(1, Math.max(0, completedSteps / totalSteps))
  const mint = tone === 'mint'

  return (
    <div
      className={`mb-8 flex items-center justify-between gap-6 overflow-hidden rounded-2xl px-6 py-6 md:px-8 ${
        mint ? 'bg-[#d8f0e4]' : 'border border-outline-variant/40 bg-white shadow-level-1'
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3 className={`text-headline-sm font-bold md:text-[26px] md:leading-8 ${mint ? 'text-[#16382b]' : 'text-primary'}`}>
          {title}
        </h3>
        <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">{description}</p>
        <div className="mt-5 max-w-md">
          <div className={`h-2.5 overflow-hidden rounded-full ${mint ? 'bg-white/80' : 'bg-surface-variant'}`}>
            <div
              className={`h-2.5 rounded-full transition-all ${mint ? 'bg-[#1f4d3a]' : 'bg-secondary'}`}
              style={{ width: `${Math.max(ratio * 100, 6)}%` }}
            />
          </div>
          <p className="mt-2 text-label-md font-semibold text-on-surface">
            {completedSteps} de {totalSteps} pasos completados
          </p>
        </div>
      </div>
      {mint && (
        <div className="hidden pr-2 sm:block">
          <BannerIllustration />
        </div>
      )}
    </div>
  )
}
