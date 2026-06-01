import type { ActionRecord, ActionType } from '@/types'
import { FUND_ASSETS } from '@/data/funds'

const ACTION_LABELS: Record<ActionType, string> = {
  drag_in: '拖入',
  drag_out: '移除',
  adjust_ratio: '调整',
  pause: '暂停',
  resume: '继续',
  submit: '提交',
}

interface HistoryTimelineProps {
  actions: ActionRecord[]
}

export default function HistoryTimeline({ actions }: HistoryTimelineProps) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-cafe-latte" />

      <div className="space-y-4">
        {actions.map(action => {
          const scoreDelta = action.scoreAfter - action.scoreBefore
          const riskDelta = action.riskAfter - action.riskBefore
          const fund = action.fundId
            ? FUND_ASSETS.find(f => f.id === action.fundId)
            : null

          return (
            <div key={action.id} className="relative animate-fade-up">
              <div className="absolute -left-4 top-1.5 w-3 h-3 rounded-full bg-cafe-latte border-2 border-white shadow-sm" />

              <div className="card-cafe py-2 px-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cafe-brown/50 whitespace-nowrap">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-sm font-medium text-cafe-brown">
                      {ACTION_LABELS[action.actionType]}
                    </span>
                    {fund && (
                      <span className="text-xs text-cafe-brown/60">{fund.name}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {scoreDelta !== 0 && (
                      <span
                        className={`text-xs font-medium ${
                          scoreDelta > 0 ? 'text-safe-green' : 'text-risk-red'
                        }`}
                      >
                        {scoreDelta > 0 ? '↑' : '↓'} {Math.abs(scoreDelta).toFixed(1)}
                      </span>
                    )}
                    {riskDelta !== 0 && (
                      <span
                        className={`text-xs font-medium ${
                          riskDelta > 0 ? 'text-risk-red' : 'text-safe-green'
                        }`}
                      >
                        {riskDelta > 0 ? '↑' : '↓'} {Math.abs(riskDelta).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {actions.length === 0 && (
          <p className="text-center text-sm text-cafe-brown/40 py-4">暂无操作记录</p>
        )}
      </div>
    </div>
  )
}
