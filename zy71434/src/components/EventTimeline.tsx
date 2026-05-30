import type { GameEvent } from '@/types/game'

interface EventTimelineProps {
  events: GameEvent[]
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
}

const DOT_COLOR: Record<string, string> = {
  correct: 'bg-success',
  wrong: 'bg-danger',
  timeout: 'bg-yellow-400',
}

export default function EventTimeline({ events, selectedEventId, onSelectEvent }: EventTimelineProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start gap-4 min-w-max px-2 py-4">
        {events.map((event) => {
          const isSelected = event.id === selectedEventId
          return (
            <button
              key={event.id}
              className="flex flex-col items-center gap-1 group"
              onClick={() => onSelectEvent(event.id)}
            >
              <div className="relative">
                <div
                  className={`w-4 h-4 rounded-full ${DOT_COLOR[event.feedback.type]} transition-transform group-hover:scale-125`}
                />
                {isSelected && (
                  <div className="absolute -inset-1.5 rounded-full border-2 border-primary-orange animate-pulse" />
                )}
              </div>
              <span className="font-body text-[10px] text-white/50">
                R{event.roundIndex + 1}
              </span>
              <span className="font-body text-[10px] text-white/30">
                B{event.beatIndex + 1}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
