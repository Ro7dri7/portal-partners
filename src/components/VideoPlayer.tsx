import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from './MaterialIcon'

type VideoPlayerProps = {
  title?: string
  durationSeconds?: number
}

export default function VideoPlayer({
  title = 'Inducción Partner — Intercert Latam',
  durationSeconds = 12,
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playing || completed) return

    intervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 100 / (durationSeconds * 5), 100)
        if (next >= 100) {
          setPlaying(false)
          setCompleted(true)
          return 100
        }
        return next
      })
    }, 200)

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [playing, completed, durationSeconds])

  function togglePlay() {
    if (completed) {
      setCompleted(false)
      setProgress(0)
      setPlaying(true)
      return
    }
    setPlaying((v) => !v)
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-outline-variant/40 bg-primary shadow-level-2">
        <div className="relative flex aspect-video items-center justify-center bg-[#0a0c18]">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-on-secondary shadow-level-2 transition-transform hover:scale-105"
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            <MaterialIcon name={playing ? 'pause' : 'play_arrow'} filled className="text-4xl" />
          </button>

          {completed && (
            <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-label-sm font-bold tracking-wide text-white">
              <MaterialIcon name="check_circle" filled className="text-[16px]" />
              Completada
            </div>
          )}
        </div>

        <div className="space-y-3 bg-primary-container p-4 text-on-primary">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-label-md font-semibold">{title}</h3>
            <span className="text-label-sm font-bold tracking-wide opacity-80">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                completed ? 'bg-success' : 'bg-secondary-container'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-body-md ${
          completed
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant'
        }`}
      >
        {completed
          ? 'Lección marcada como completada. Ya puedes continuar con el siguiente módulo.'
          : 'Reproduce el video hasta el final para marcar la lección como completada.'}
      </div>
    </div>
  )
}
