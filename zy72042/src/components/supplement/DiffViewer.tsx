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

const FIELD_TO_SUPPLEMENT: Record<string, CompareKey> = {
  score: 'currentScore',
  risk: 'currentRisk',
  holdings: 'currentScore',
  failReason: 'failReason',
  status: 'status',
}

function formatValue(key: CompareKey, value: unknown): string {
  if (value == null) return '-'
  if (key === 'failReason' && value === null) return '无'
  if (key === 'currentRisk' && typeof value === 'number') {
    return `${(value * 100).toFixed(1)}%`
  }
  if (key === 'currentScore' && typeof value === 'number') {
    return value.toFixed(1)
  }
  return String(value)
}

export default function DiffViewer({ baseline, currentSession, supplements }: DiffViewerProps) {
  const compareKeys: CompareKey[] = ['currentScore', 'currentRisk', 'remainingResources', 'failReason', 'status']

  const supplementedFieldMap = new Map<string, SupplementRecord[]>()
  for (const sup of supplements) {
    const targetField = FIELD_TO_SUPPLEMENT[sup.field] ?? sup.field
    const existing = supplementedFieldMap.get(targetField) ?? []
    supplementedFieldMap.set(targetField, [...existing, sup])
  }

  return (
    <div className="card-cafe">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="font-medium text-cafe-brown text-sm text-center border-b border-cafe-latte/60 pb-2">
          基线快照（补录前）
        </div>
        <div className="font-medium text-cafe-brown text-sm text-center border-b border-cafe-latte/60 pb-2">
          当前状态（已应用补录）
        </div>
      </div>

      <div className="space-y-3">
        {compareKeys.map((key) => {
          const beforeVal = baseline ? formatValue(key, baseline[key]) : '-'
          const afterVal = formatValue(key, currentSession[key])
          const isDifferent = beforeVal !== afterVal
          const supplementRecords = supplementedFieldMap.get(key) ?? []
          const hasSupplement = supplementRecords.length > 0

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
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {isDifferent ? (
                      <span className="text-green-600 font-medium">{afterVal}</span>
                    ) : (
                      <span className="text-cafe-brown">{afterVal}</span>
                    )}
                    {hasSupplement && (
                      <span className="text-xs bg-data-blue/10 text-data-blue px-1.5 py-0.5 rounded">
                        补录
                      </span>
                    )}
                  </div>
                  {supplementRecords.map((sup) => (
                    <div key={sup.id} className="text-xs text-cafe-brown/50 pl-2 border-l-2 border-data-blue/30">
                      <div>修正前: <span className="text-red-400 line-through">{sup.valueBefore}</span></div>
                      <div>修正后: <span className="text-green-600">{sup.valueAfter}</span></div>
                      {sup.note && (
                        <div className="mt-0.5">原因: <span className="text-cafe-brown/70">{sup.note}</span></div>
                      )}
                      <div className="text-cafe-brown/30 mt-0.5">
                        {new Date(sup.supplementedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {supplements.length > 0 && (
        <div className="mt-4 border-t border-cafe-latte/60 pt-3">
          <div className="text-xs text-cafe-brown/50 mb-2">补录轨迹（按时间顺序）</div>
          <div className="flex flex-col gap-2">
            {supplements.map((sup) => (
              <div key={sup.id} className="text-xs bg-cafe-cream/50 rounded-lg p-2 border border-cafe-latte/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-cafe-brown">{sup.field}</span>
                  <span className="text-cafe-brown/30">
                    {new Date(sup.supplementedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-red-400 line-through">{sup.valueBefore}</span>
                  <span className="text-cafe-brown/40">→</span>
                  <span className="text-green-600">{sup.valueAfter}</span>
                </div>
                {sup.note && (
                  <div className="mt-1 text-cafe-brown/70 bg-white/50 rounded px-2 py-1">
                    原因: {sup.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
