import { Download } from 'lucide-react'
import { GESTURE_TO_NOTE, NOTES } from '@/types/game'
import type { GameEvent } from '@/types/game'

interface EvidencePanelProps {
  event: GameEvent | null
}

const BADGE_STYLE: Record<string, string> = {
  correct: 'bg-success/20 text-success',
  wrong: 'bg-danger/20 text-danger',
  timeout: 'bg-yellow-400/20 text-yellow-400',
}

const BADGE_LABEL: Record<string, string> = {
  correct: '正确 ✓',
  wrong: '错误 ✗',
  timeout: '超时 ⏱',
}

export default function EvidencePanel({ event }: EvidencePanelProps) {
  const handleExport = () => {
    if (!event) return
    const blob = new Blob([JSON.stringify(event, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `event-${event.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 bg-bg-card border-l border-white/10 shadow-2xl transition-transform duration-300 z-40 ${
        event ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {event && (
        <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full font-body text-sm font-bold ${BADGE_STYLE[event.feedback.type]}`}
            >
              {BADGE_LABEL[event.feedback.type]}
            </span>
            <span className="font-body text-xs text-white/30">
              R{event.roundIndex + 1} · B{event.beatIndex + 1}
            </span>
          </div>

          <section className="border-l-4 border-primary-orange pl-4 flex flex-col gap-2">
            <h3 className="font-display text-lg text-primary-orange">手势数据</h3>
            <div className="font-body text-sm text-white/70">
              <p>识别手势: <span className="text-white font-bold">{event.gesture.recognizedGesture}</span></p>
              <p>置信度: <span className="text-white font-bold">{(event.gesture.confidence * 100).toFixed(1)}%</span></p>
              <p>关键点数: <span className="text-white font-bold">{event.gesture.landmarks.length}</span></p>
            </div>
          </section>

          <section className="border-l-4 border-primary-purple pl-4 flex flex-col gap-2">
            <h3 className="font-display text-lg text-primary-purple">音阶判定</h3>
            <div className="font-body text-sm text-white/70">
              <p>
                期望: <span className="text-white font-bold">{event.scale.expected}</span>
                {NOTES[event.scale.expected]?.emoji}
              </p>
              <p>
                实际: <span className="text-white font-bold">{event.scale.actual ?? '—'}</span>
                {event.scale.actual ? NOTES[event.scale.actual]?.emoji : ''}
              </p>
              <p>
                判定: <span className={event.scale.isCorrect ? 'text-success font-bold' : 'text-danger font-bold'}>
                  {event.scale.isCorrect ? '正确' : '错误'}
                </span>
              </p>
              <p>置信度: <span className="text-white font-bold">{(event.scale.confidence * 100).toFixed(1)}%</span></p>
            </div>
          </section>

          <section className="border-l-4 border-blue-400 pl-4 flex flex-col gap-2">
            <h3 className="font-display text-lg text-blue-400">节拍同步</h3>
            <div className="font-body text-sm text-white/70">
              <p>期望时间: <span className="text-white font-bold">{event.beat.expectedTime.toFixed(0)}ms</span></p>
              <p>实际时间: <span className="text-white font-bold">{event.beat.actualTime.toFixed(0)}ms</span></p>
              <p>
                偏差: <span className="text-white font-bold">{event.beat.offsetMs.toFixed(0)}ms</span>
              </p>
              <p>
                合拍: <span className={event.beat.isOnBeat ? 'text-success font-bold' : 'text-danger font-bold'}>
                  {event.beat.isOnBeat ? '是' : '否'}
                </span>
              </p>
            </div>
          </section>

          <button
            onClick={handleExport}
            className="btn-magic btn-magic-purple flex items-center justify-center gap-2 mt-auto"
          >
            <Download className="w-5 h-5" />
            <span>导出全部日志</span>
          </button>
        </div>
      )}
    </div>
  )
}
