import type { GameEvent, GestureData, ScaleData, BeatData, FeedbackData } from '@/types/game'

interface CreateEventParams {
  sessionId: string
  roundIndex: number
  beatIndex: number
  gesture: GestureData
  scale: ScaleData
  beat: BeatData
  feedback: FeedbackData
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function createEvent(params: CreateEventParams): GameEvent {
  return {
    id: generateId(),
    sessionId: params.sessionId,
    roundIndex: params.roundIndex,
    beatIndex: params.beatIndex,
    timestamp: Date.now(),
    gesture: params.gesture,
    scale: params.scale,
    beat: params.beat,
    feedback: params.feedback,
  }
}

export function exportEvents(events: GameEvent[]): string {
  return JSON.stringify(events, null, 2)
}

export function getEventSummary(event: GameEvent): string {
  const feedbackSymbol =
    event.feedback.type === 'correct'
      ? '✓ 正确'
      : event.feedback.type === 'wrong'
        ? '✗ 错误'
        : '⏱ 超时'
  return `第${event.roundIndex + 1}回合 第${event.beatIndex + 1}拍 ${feedbackSymbol} 期望${event.scale.expected} 实际${event.scale.actual ?? '无'} 偏移${event.beat.offsetMs}ms`
}
