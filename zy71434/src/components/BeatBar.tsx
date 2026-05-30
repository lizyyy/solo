import { Music } from 'lucide-react'

interface BeatBarProps {
  totalBeats: number
  currentBeat: number
  bpm: number
  isPlaying: boolean
  results: ('correct' | 'wrong' | 'timeout')[]
}

export default function BeatBar({ totalBeats, currentBeat, bpm, isPlaying, results }: BeatBarProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/60 font-body text-sm">
          <Music className="w-4 h-4" />
          <span>BPM</span>
        </div>
        <span className="font-display text-lg text-primary-orange">{bpm}</span>
      </div>
      <div className="flex items-center gap-2 justify-center">
        {Array.from({ length: totalBeats }, (_, i) => {
          const isCurrent = isPlaying && i === currentBeat
          const result = results[i]

          let dotClass = 'w-3 h-3 rounded-full bg-white/20 transition-all duration-200'
          if (isCurrent) {
            dotClass = 'w-5 h-5 rounded-full bg-primary-orange shadow-[0_0_12px_rgba(255,140,66,0.6)] animate-pulse'
          } else if (result === 'correct') {
            dotClass = 'w-3 h-3 rounded-full bg-success'
          } else if (result === 'wrong') {
            dotClass = 'w-3 h-3 rounded-full bg-danger'
          } else if (result === 'timeout') {
            dotClass = 'w-3 h-3 rounded-full bg-yellow-400'
          }

          return <div key={i} className={dotClass} />
        })}
      </div>
    </div>
  )
}
