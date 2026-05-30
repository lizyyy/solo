import { NOTES } from '@/types/game'
import type { FeedbackData, NoteType } from '@/types/game'

interface FeedbackPopupProps {
  feedback: FeedbackData | null
  show: boolean
  expectedNote: NoteType | null
}

export default function FeedbackPopup({ feedback, show, expectedNote }: FeedbackPopupProps) {
  if (!show || !feedback) return null

  const expectedInfo = expectedNote ? NOTES[expectedNote] : null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div
        className={`flex flex-col items-center gap-2 ${
          feedback.type === 'correct'
            ? 'animate-bounce-in'
            : feedback.type === 'wrong'
            ? 'animate-shake'
            : 'animate-bounce-in'
        }`}
      >
        {feedback.type === 'correct' && (
          <>
            <span className="text-7xl text-success">✓</span>
            <span className="font-display text-3xl text-success">太棒了!</span>
          </>
        )}
        {feedback.type === 'wrong' && (
          <>
            <span className="text-7xl text-danger">✗</span>
            <span className="font-display text-3xl text-danger">再试一次!</span>
            {expectedInfo && (
              <div className="flex items-center gap-2 mt-2 bg-bg-card/80 rounded-xl px-4 py-2">
                <span className="text-2xl">{expectedInfo.emoji}</span>
                <span className="font-body text-sm text-white/80">{expectedInfo.description}</span>
              </div>
            )}
          </>
        )}
        {feedback.type === 'timeout' && (
          <>
            <span className="text-7xl text-yellow-400">⏱</span>
            <span className="font-display text-3xl text-yellow-400">时间到!</span>
            {expectedInfo && (
              <div className="flex items-center gap-2 mt-2 bg-bg-card/80 rounded-xl px-4 py-2">
                <span className="text-2xl">{expectedInfo.emoji}</span>
                <span className="font-body text-sm text-white/80">{expectedInfo.description}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
