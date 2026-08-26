import { useEffect, useRef, useState } from 'react'
import { AuditorJourneyTimeline } from './AuditorJourneyTimeline'
import { MaterialIcon } from './MaterialIcon'
import type { JourneyStep } from '../utils/auditorProgress'

const SLIDE_SECONDS = 40
const INTRO_VIDEO_SRC = '/videos/introduccion-partner.mp4'

type DashboardStageCarouselProps = {
  steps: JourneyStep[]
}

export function DashboardStageCarousel({ steps }: DashboardStageCarouselProps) {
  const [slide, setSlide] = useState(0)
  const [remaining, setRemaining] = useState(SLIDE_SECONDS)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const paused = hoverPaused || videoPlaying

  function goTo(next: number) {
    setSlide(((next % 2) + 2) % 2)
    setRemaining(SLIDE_SECONDS)
  }

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setSlide((current) => (current + 1) % 2)
          return SLIDE_SECONDS
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [paused])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (slide === 1) {
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [slide])

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-level-1"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-5 py-3">
        <p className="text-label-md font-semibold text-on-surface-variant">
          {slide === 0 ? 'Línea de tiempo' : 'Video de introducción'}
        </p>
        <p className="text-label-sm font-semibold text-secondary">
          {paused ? 'Pausado' : `Siguiente en ${remaining}s`}
        </p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={`absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            slide === 0 ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <AuditorJourneyTimeline steps={steps} embedded />
        </div>
        <div
          className={`absolute inset-0 flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            slide === 1 ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-primary">
            <video
              ref={videoRef}
              className="h-full max-h-[420px] w-full object-contain"
              controls
              playsInline
              poster="/partners-logo-blanco.png"
              onPlay={() => setVideoPlaying(true)}
              onPause={() => setVideoPlaying(false)}
              onEnded={() => setVideoPlaying(false)}
              onError={() => setVideoError(true)}
            >
              <source src={INTRO_VIDEO_SRC} type="video/mp4" />
            </video>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-transparent p-5">
              <p className="text-label-md font-semibold text-on-primary">
                Introducción al Partner Portal
              </p>
              {videoError && (
                <p className="text-sm text-on-primary/80">
                  Coloca el archivo en public/videos/introduccion-partner.mp4 para reproducirlo aquí.
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container-lowest/95 text-primary shadow-level-2 hover:bg-white"
          aria-label="Anterior"
          onClick={() => goTo(slide - 1)}
        >
          <MaterialIcon name="chevron_left" className="text-[28px]" />
        </button>
        <button
          type="button"
          className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container-lowest/95 text-primary shadow-level-2 hover:bg-white"
          aria-label="Siguiente"
          onClick={() => goTo(slide + 1)}
        >
          <MaterialIcon name="chevron_right" className="text-[28px]" />
        </button>
      </div>

      <div className="flex justify-center gap-2 py-3">
        {[0, 1].map((index) => (
          <button
            key={index}
            type="button"
            aria-label={index === 0 ? 'Ver línea de tiempo' : 'Ver video'}
            onClick={() => goTo(index)}
            className={`h-2 rounded-full transition-all ${
              slide === index ? 'w-6 bg-secondary' : 'w-2 bg-outline-variant'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
