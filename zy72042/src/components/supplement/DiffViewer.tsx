import { useMemo } from 'react'
import type { GameSession, SupplementRecord, FundHolding } from '@/types'
import { FUND_ASSETS } from '@/data/funds'
import { parseHoldings, formatHoldingsHuman } from '@/stores/supplementStore'

interface DiffViewerProps {
  baseline: GameSession | null
  currentSession: GameSession
  supplements: SupplementRecord[]
}

type ScalarKey = 'currentScore' | 'currentRisk' | 'remainingResources' | 'failReason' | 'status'

const FIELD_LABELS: Record<ScalarKey, string> = {
  currentScore: '当前得分',
  currentRisk: '当前风险',
  remainingResources: '剩余资源',
  failReason: '失败原因',
  status: '状态',
}

const SUPPLEMENT_TO_COMPARE: Record<string, ScalarKey | 'holdings'> = {
  score: 'currentScore',
  risk: 'currentRisk',
  holdings: 'holdings',
  failReason: 'failReason',
  status: 'status',
}

function formatScalarValue(key: ScalarKey, value: unknown): string {
  if (value == null) return '-'
  if (key === 'failReason' && value === null) return '无'
  if (key === 'currentRisk' && typeof value === 'number') {
    return `${(value * 100).toFixed(1)}%`
  }
  if (key === 'currentScore' && typeof value === 'number') {
    return value.toFixed(1)
  }
  if (key === 'status') {
    const map: Record<string, string> = {
      playing: '进行中',
      paused: '已暂停',
      completed: '通关',
      failed: '失败',
    }
    return map[String(value)] ?? String(value)
  }
  if (key === 'failReason') {
    const map: Record<string, string> = {
      rule: '规则违反',
      timeout: '时间耗尽',
      risk: '风险超限',
      resource: '资源耗尽',
    }
    return map[String(value)] ?? String(value)
  }
  return String(value)
}

const FUND_MAP = new Map(FUND_ASSETS.map((f) => [f.id, f]))

function holdingsToRowMap(holdings: FundHolding[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const h of holdings) {
    m.set(h.fundId, (m.get(h.fundId) ?? 0) + h.ratio)
  }
  return m
}

function diffHoldingsRows(
  baseline: FundHolding[],
  current: FundHolding[]
): { fundId: string; before: number; after: number; changed: boolean }[] {
  const beforeMap = holdingsToRowMap(baseline)
  const afterMap = holdingsToRowMap(current)
  const allIds = new Set<string>([...beforeMap.keys(), ...afterMap.keys()])
  const rows: { fundId: string; before: number; after: number; changed: boolean }[] = []
  for (const id of Array.from(allIds).sort()) {
    const before = beforeMap.get(id) ?? 0
    const after = afterMap.get(id) ?? 0
    rows.push({ fundId: id, before, after, changed: before !== after })
  }
  return rows
}

export default function DiffViewer({ baseline, currentSession, supplements }: DiffViewerProps) {
  const scalarKeys: ScalarKey[] = ['currentScore', 'currentRisk', 'remainingResources', 'failReason', 'status']

  const supplementGroupMap = useMemo(() => {
    const m = new Map<string, SupplementRecord[]>()
    for (const sup of supplements) {
      const target = SUPPLEMENT_TO_COMPARE[sup.field] ?? sup.field
      const existing = m.get(target) ?? []
      m.set(target, [...existing, sup])
    }
    return m
  }, [supplements])

  const holdingsSupplements = supplementGroupMap.get('holdings') ?? []
  const hasHoldingsSupplement = holdingsSupplements.length > 0

  const baselineHoldings = baseline?.holdings ?? []
  const currentHoldings = currentSession.holdings ?? []
  const holdingsDiffer =
    baselineHoldings.length !== currentHoldings.length ||
    JSON.stringify(baselineHoldings.sort((a, b) => a.fundId.localeCompare(b.fundId))) !==
      JSON.stringify(currentHoldings.sort((a, b) => a.fundId.localeCompare(b.fundId)))

  const holdingRows = diffHoldingsRows(baselineHoldings, currentHoldings)

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
        {scalarKeys.map((key) => {
          const beforeVal = baseline ? formatScalarValue(key, baseline[key]) : '-'
          const afterVal = formatScalarValue(key, currentSession[key])
          const isDifferent = beforeVal !== afterVal
          const supplementRecords = supplementGroupMap.get(key) ?? []
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
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                    <div
                      key={sup.id}
                      className="text-xs text-cafe-brown/50 pl-2 border-l-2 border-data-blue/30"
                    >
                      <div>
                        修正前: <span className="text-red-400 line-through">{sup.valueBefore}</span>
                      </div>
                      <div>
                        修正后: <span className="text-green-600">{sup.valueAfter}</span>
                      </div>
                      {sup.note && (
                        <div className="mt-0.5">
                          原因: <span className="text-cafe-brown/70">{sup.note}</span>
                        </div>
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

        <div className="contents">
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              holdingsDiffer ? 'bg-yellow-50' : ''
            }`}
          >
            <div className="text-xs text-cafe-brown/50 mb-1">持仓组合</div>
            <div className="text-cafe-brown">{formatHoldingsHuman(baselineHoldings)}</div>
            {holdingRows.length > 0 && (
              <div className="mt-2 space-y-0.5 text-xs">
                {holdingRows.map((row) => {
                  const fund = FUND_MAP.get(row.fundId)
                  const name = fund?.name ?? row.fundId
                  return (
                    <div key={row.fundId} className="flex justify-between">
                      <span className="text-cafe-brown/60">{name}</span>
                      <span
                        className={
                          row.changed && row.before !== row.after
                            ? row.before > 0
                              ? 'text-red-500/70 line-through'
                              : 'text-cafe-brown/30'
                            : 'text-cafe-brown/70'
                        }
                      >
                        {row.before > 0 ? `${(row.before * 100).toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              holdingsDiffer ? 'bg-yellow-50' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="text-xs text-cafe-brown/50 mb-1">持仓组合</div>
              {hasHoldingsSupplement && (
                <span className="text-xs bg-data-blue/10 text-data-blue px-1.5 py-0.5 rounded">
                  补录
                </span>
              )}
            </div>
            <div className="text-cafe-brown">
              {holdingsDiffer ? (
                <span className="text-green-600 font-medium">
                  {formatHoldingsHuman(currentHoldings)}
                </span>
              ) : (
                formatHoldingsHuman(currentHoldings)
              )}
            </div>
            {holdingRows.length > 0 && (
              <div className="mt-2 space-y-0.5 text-xs">
                {holdingRows.map((row) => {
                  const fund = FUND_MAP.get(row.fundId)
                  const name = fund?.name ?? row.fundId
                  return (
                    <div key={row.fundId} className="flex justify-between">
                      <span className="text-cafe-brown/60">{name}</span>
                      <span
                        className={
                          row.changed ? 'text-green-600 font-medium' : 'text-cafe-brown/70'
                        }
                      >
                        {row.after > 0 ? `${(row.after * 100).toFixed(0)}%` : '已移除'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            {holdingsSupplements.map((sup) => (
              <div
                key={sup.id}
                className="mt-2 text-xs text-cafe-brown/50 pl-2 border-l-2 border-data-blue/30"
              >
                <div className="text-cafe-brown/70 font-medium mb-1">持仓补录明细</div>
                <div className="space-y-0.5">
                  <div>
                    修正前:{' '}
                    <span className="text-red-400 line-through">
                      {formatHoldingsHuman(parseHoldings(sup.valueBefore))}
                    </span>
                  </div>
                  <div>
                    修正后:{' '}
                    <span className="text-green-600">
                      {formatHoldingsHuman(parseHoldings(sup.valueAfter))}
                    </span>
                  </div>
                </div>
                {sup.note && (
                  <div className="mt-0.5">
                    原因: <span className="text-cafe-brown/70">{sup.note}</span>
                  </div>
                )}
                <div className="text-cafe-brown/30 mt-0.5">
                  {new Date(sup.supplementedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {supplements.length > 0 && (
        <div className="mt-4 border-t border-cafe-latte/60 pt-3">
          <div className="text-xs text-cafe-brown/50 mb-2">补录轨迹（按时间顺序）</div>
          <div className="flex flex-col gap-2">
            {supplements.map((sup) => (
              <div
                key={sup.id}
                className="text-xs bg-cafe-cream/50 rounded-lg p-2 border border-cafe-latte/30"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-cafe-brown">
                    {sup.field === 'holdings' ? '持仓' : sup.field}
                  </span>
                  <span className="text-cafe-brown/30">
                    {new Date(sup.supplementedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-red-400 line-through">
                    {sup.field === 'holdings'
                      ? formatHoldingsHuman(parseHoldings(sup.valueBefore))
                      : sup.valueBefore}
                  </span>
                  <span className="text-cafe-brown/40">→</span>
                  <span className="text-green-600">
                    {sup.field === 'holdings'
                      ? formatHoldingsHuman(parseHoldings(sup.valueAfter))
                      : sup.valueAfter}
                  </span>
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
