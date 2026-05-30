import { NOTES } from '@/types/game'
import type { NoteType } from '@/types/game'

interface ScaleCardProps {
  note: NoteType | null
  showHint: boolean
}

const NOTE_BG_OPACITY: Record<string, string> = {
  Do: 'bg-note-do/20',
  Re: 'bg-note-re/20',
  Mi: 'bg-note-mi/20',
  Fa: 'bg-note-fa/20',
  Sol: 'bg-note-sol/20',
  La: 'bg-note-la/20',
  Si: 'bg-note-si/20',
}

const NOTE_TEXT_COLOR: Record<string, string> = {
  Do: 'text-note-do',
  Re: 'text-note-re',
  Mi: 'text-note-mi',
  Fa: 'text-note-fa',
  Sol: 'text-note-sol',
  La: 'text-note-la',
  Si: 'text-note-si',
}

export default function ScaleCard({ note, showHint }: ScaleCardProps) {
  if (!note) {
    return (
      <div className="card-magic flex items-center justify-center min-h-[200px]">
        <span className="font-display text-2xl text-white/30 animate-float">🎵</span>
      </div>
    )
  }

  const info = NOTES[note]

  return (
    <div
      className={`card-magic flex flex-col items-center justify-center min-h-[200px] ${NOTE_BG_OPACITY[note]} ${note ? 'animate-pulse-glow' : ''}`}
    >
      <span className={`font-display text-6xl ${NOTE_TEXT_COLOR[note]}`}>
        {note}
      </span>
      <span className="mt-2 text-3xl">{info.emoji}</span>
      {showHint && (
        <div className="mt-3 flex flex-col items-center gap-1">
          <span className="text-2xl">{info.emoji}</span>
          <span className="font-body text-sm text-white/70">{info.description}</span>
        </div>
      )}
    </div>
  )
}
