import type { GameSession, SupplementRecord } from '@/types'

interface DiffViewerProps {
  baseline: GameSession | null
  currentSession: GameSession
  supplements: SupplementRecord[]
}

type CompareKey = 'currentScore' | 'currentRisk' | 'remainingResources' | 'failReason' | 'status'

const FIELD_LABELS: Record<CompareKey, string> = {
  currentScore: '当前得分',
  currentRisk: '当前风险',
  remainingResources: '剩余资源',
  failReason: '失败原因',
  status: '状态',
}

function formatValue(key: CompareKey, value: unknown): string {
  if (value == null) return '-'
  if (key === 'failReason' && value === null) return '无'
  return String(value)
}

export default function DiffViewer({ baseline, currentSession, supplements }: DiffViewerProps) {
  const compareKeys: CompareKey[] = ['currentScore', 'currentRisk', 'remainingResources', 'failReason', 'status']

  const supplementedFields = new Set(supplements.map((s) => s.field))

  return (
    <div className="card-cafe grid grid-cols-2 gap-4">
      <div className="font-medium text-cafe-brown text-sm text-center border-b border-cafe-latte/60 pb-2">
        补录前
      </div>
      <div className="font-medium text-cafe-brown text-sm text-center border-b border-cafe-latte/60 pb-2">
        补录后
      </div>

      {compareKeys.map((key) => {
        const beforeVal = baseline ? formatValue(key, baseline[key]) : '-'
        const afterVal = formatValue(key, currentSession[key])
        const isDifferent = beforeVal !== afterVal
        const isNewField = supplementedFields.has(key)

        return (
          <div key={key} className="contents">
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                isDifferent ? 'bg-yellow-50' : ''
              }`}
            >
              <div className="text-xs text-cafe-brown/50 mb-1">{FIELD_LABELS[key]}</div>
              {isDifferent ? (
                <span className="line-through text-red-500/70">{beforeVal}</span>
              ) : (
                <span className="text-cafe-brown">{beforeVal}</span>
              )}
            </div>
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                isDifferent ? 'bg-yellow-50' : ''
              }`}
            >
              <div className="text-xs text-cafe-brown/50 mb-1">{FIELD_LABELS[key]}</div>
              <div className="flex items-center gap-1.5">
                {isDifferent && (
                  <span className="text-green-600 font-medium">{afterVal}</span>
                )}
                {!isDifferent && (
                  <span className="text-cafe-brown">{afterVal}</span>
                )}
                {isNewField && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    新增
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {supplements.length > 0 && (
        <div className="col-span-2 mt-2 border-t border-cafe-latte/60 pt-3">
          <div className="text-xs text-cafe-brown/50 mb-2">补录记录</div>
          <div className="flex flex-col gap-1.5">
            {supplements.map((sup) => (
              <div key={sup.id} className="text-xs text-cafe-brown/70 flex items-center gap-2">
                <span className="text-cafe-brown/40">
                  {new Date(sup.supplementedAt).toLocaleString()}
                </span>
                <span className="font-medium">{sup.field}</span>
                <span className="text-red-400 line-through">{sup.valueBefore}</span>
                <span>→</span>
                <span className="text-green-600">{sup.valueAfter}</span>
                {sup.note && <span className="text-cafe-brown/40">({sup.note})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
