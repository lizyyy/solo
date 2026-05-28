import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, FileText, Home } from 'lucide-react'
import { useGameStore } from '@/store'
import lots from '@/data/lots'
import { DIMENSION_LABELS, CLUE_TYPE_LABELS } from '@/types'
import type { AnalysisDimension, TrapType } from '@/types'

const DIMENSION_ICONS: Record<AnalysisDimension, string> = {
  provenance: '📜',
  condition: '🔍',
  school: '🎨',
  buyer: '👥',
}

function DimensionCard({
  dimension,
  analysis,
  trapIdentified,
  trapType,
  impactOnPrice,
}: {
  dimension: AnalysisDimension
  analysis: {
    correctAnalysis: string
    commonMistake: string
    impactOnPrice: number
  }
  trapIdentified: boolean | null
  trapType?: TrapType
  impactOnPrice: number
}) {
  const [expanded, setExpanded] = useState(false)
  const label = DIMENSION_LABELS[dimension]
  const icon = DIMENSION_ICONS[dimension]

  return (
    <div className="parchment-card relative rounded-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="font-serif text-lg text-ink tracking-wide">{label}</span>
          {trapIdentified !== null && (
            trapIdentified
              ? <CheckCircle2 className="w-5 h-5 text-jade" />
              : <XCircle className="w-5 h-5 text-seal" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-serif text-sm font-semibold ${
            impactOnPrice > 0 ? 'text-jade' : impactOnPrice < 0 ? 'text-seal' : 'text-ink/50'
          }`}>
            {impactOnPrice > 0 ? '+' : ''}{impactOnPrice}%
          </span>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-ink/50" />
            : <ChevronDown className="w-4 h-4 text-ink/50" />
          }
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3 animate-float-in">
          {trapType && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-body px-2 py-0.5 rounded-sm bg-ink/10 text-ink/70">
                陷阱类型：{CLUE_TYPE_LABELS[trapType]}
              </span>
              {trapIdentified !== null && (
                <span className={`text-xs font-body px-2 py-0.5 rounded-sm ${
                  trapIdentified
                    ? 'bg-jade/20 text-jade'
                    : 'bg-seal/15 text-seal'
                }`}>
                  {trapIdentified ? '已识别' : '未识别'}
                </span>
              )}
            </div>
          )}

          <div className="rounded-sm p-3 bg-jade/10 border border-jade/20">
            <p className="text-xs font-body text-jade tracking-wider mb-1">正确分析</p>
            <p className="font-body text-sm text-ink/80 leading-relaxed">{analysis.correctAnalysis}</p>
          </div>

          {analysis.commonMistake && analysis.impactOnPrice !== 0 && (
            <div className="rounded-sm p-3 bg-seal/10 border border-seal/20">
              <p className="text-xs font-body text-seal tracking-wider mb-1">常见错误</p>
              <p className="font-body text-sm text-ink/80 leading-relaxed">{analysis.commonMistake}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-body text-ink/50">对估价的影响</span>
            <span className={`font-serif font-semibold text-sm ${
              impactOnPrice > 0 ? 'text-jade' : impactOnPrice < 0 ? 'text-seal' : 'text-ink/40'
            }`}>
              {impactOnPrice > 0 ? '+' : ''}{impactOnPrice}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function ValuationBar({
  label,
  low,
  high,
  color,
  rangeMin,
  rangeMax,
}: {
  label: string
  low: number
  high: number
  color: string
  rangeMin: number
  rangeMax: number
}) {
  const range = rangeMax - rangeMin
  const leftPct = ((low - rangeMin) / range) * 100
  const widthPct = ((high - low) / range) * 100

  return (
    <div className="flex items-center gap-3">
      <span className="font-body text-xs text-ink/60 w-16 text-right shrink-0">{label}</span>
      <div className="flex-1 relative h-6 bg-ink/5 rounded-sm">
        <div
          className={`absolute top-0.5 h-5 rounded-sm ${color}`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>
      <span className="font-serif text-xs text-ink/70 w-28 shrink-0">
        {low}-{high}万
      </span>
    </div>
  )
}

export default function Analysis() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const { getLotProgress, completeLot } = useGameStore()

  const lot = lots.find(l => l.id === lotId)
  const progress = lotId ? getLotProgress(lotId) : null

  if (!lot || !progress || !progress.auctionResult) {
    return (
      <div className="min-h-screen wood-panel flex items-center justify-center">
        <div className="parchment-card relative rounded-sm p-8 text-center max-w-md">
          <FileText className="w-10 h-10 text-gold mx-auto mb-4" />
          <p className="font-serif text-lg text-ink tracking-wide">暂无分析数据</p>
          <p className="font-body text-sm text-ink/60 mt-2">请先完成竞价环节</p>
          <button onClick={() => navigate('/')} className="btn-gold mt-6 text-sm">
            返回大厅
          </button>
        </div>
      </div>
    )
  }

  const trapResults = progress.auctionResult.trapResults
  const identifiedCount = trapResults.filter(t => t.identified).length
  const totalTraps = trapResults.length

  const handleComplete = () => {
    if (lotId) completeLot(lotId)
  }

  const allValues = [
    progress.valuation?.low ?? 0,
    progress.valuation?.high ?? 0,
    lot.correctValuation.low,
    lot.correctValuation.high,
    lot.referencePrice,
  ]
  const rangeMin = Math.min(...allValues) * 0.7
  const rangeMax = Math.max(...allValues) * 1.3

  const dimensionTrapMap: Partial<Record<AnalysisDimension, { trapId: string; type: TrapType; identified: boolean }>> = {}
  for (const trap of lot.traps) {
    const type = trap.type as TrapType
    if (type === 'provenance_gap') dimensionTrapMap.provenance = { trapId: trap.id, type, identified: trapResults.find(t => t.trapId === trap.id)?.identified ?? false }
    else if (type === 'condition_deduction') dimensionTrapMap.condition = { trapId: trap.id, type, identified: trapResults.find(t => t.trapId === trap.id)?.identified ?? false }
    else if (type === 'school_mislabel') dimensionTrapMap.school = { trapId: trap.id, type, identified: trapResults.find(t => t.trapId === trap.id)?.identified ?? false }
    else if (type === 'buyer_misjudge') dimensionTrapMap.buyer = { trapId: trap.id, type, identified: trapResults.find(t => t.trapId === trap.id)?.identified ?? false }
  }

  return (
    <div className="min-h-screen wood-panel">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-wood-900/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(201,168,76,0.1)_0%,transparent_60%)]" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <p className="font-body text-sm text-gold/60 tracking-[0.4em] mb-2">偏差分析</p>
            <h1 className="font-serif text-3xl text-parchment tracking-wider mb-3">{lot.name}</h1>
            <p className="font-body text-sm text-parchment-dark tracking-wider">{lot.subtitle}</p>
          </header>

          <section className="mb-8">
            <div className="parchment-card relative rounded-sm p-5 text-center">
              <p className="font-body text-xs text-ink/50 tracking-wider mb-2">陷阱识别</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-serif text-4xl text-gold">{identifiedCount}</span>
                <span className="font-serif text-xl text-ink/40">/</span>
                <span className="font-serif text-2xl text-ink/60">{totalTraps}</span>
              </div>
              <div className="mt-3 h-1.5 bg-ink/10 rounded-full overflow-hidden max-w-xs mx-auto">
                <div
                  className="h-full bg-gradient-to-r from-gold-dark to-gold rounded-full transition-all"
                  style={{ width: totalTraps > 0 ? `${(identifiedCount / totalTraps) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </section>

          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-gold/30 to-transparent" />
              <h2 className="font-serif text-base text-gold-light tracking-widest">估价对比</h2>
              <div className="h-px flex-1 bg-gradient-to-l from-gold/30 to-transparent" />
            </div>

            <div className="parchment-card relative rounded-sm p-5 space-y-2">
              {progress.valuation && (
                <ValuationBar
                  label="你的估价"
                  low={progress.valuation.low}
                  high={progress.valuation.high}
                  color="bg-gold/40"
                  rangeMin={rangeMin}
                  rangeMax={rangeMax}
                />
              )}
              <ValuationBar
                label="正确估价"
                low={lot.correctValuation.low}
                high={lot.correctValuation.high}
                color="bg-jade/40"
                rangeMin={rangeMin}
                rangeMax={rangeMax}
              />
              <ValuationBar
                label="参考价"
                low={lot.referencePrice}
                high={lot.referencePrice}
                color="bg-seal/30"
                rangeMin={rangeMin}
                rangeMax={rangeMax}
              />

              <div className="flex items-center gap-4 pt-3 border-t border-ink/10 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gold/40" />
                  <span className="text-xs font-body text-ink/50">你的估价</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-jade/40" />
                  <span className="text-xs font-body text-ink/50">正确估价</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-seal/30" />
                  <span className="text-xs font-body text-ink/50">参考价</span>
                </div>
              </div>

              {progress.auctionResult.valuationDeviation > 0 && (
                <div className="mt-2 text-center">
                  <span className="text-xs font-body text-ink/50">估价偏差：</span>
                  <span className="font-serif text-sm text-seal font-semibold">
                    {progress.auctionResult.valuationDeviation}%
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-gold/30 to-transparent" />
              <h2 className="font-serif text-base text-gold-light tracking-widest">维度分析</h2>
              <div className="h-px flex-1 bg-gradient-to-l from-gold/30 to-transparent" />
            </div>

            <div className="space-y-3">
              {lot.analysis.map((item) => {
                const dimTrap = dimensionTrapMap[item.dimension]
                return (
                  <DimensionCard
                    key={item.dimension}
                    dimension={item.dimension}
                    analysis={item}
                    trapIdentified={dimTrap?.identified ?? null}
                    trapType={dimTrap?.type}
                    impactOnPrice={item.impactOnPrice}
                  />
                )
              })}
            </div>
          </section>

          <section className="flex items-center justify-center gap-4 pb-8">
            <button
              onClick={() => {
                handleComplete()
                navigate(`/case/${lotId}/report`)
              }}
              className="btn-gold text-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              查看报告
            </button>
            <button
              onClick={() => {
                handleComplete()
                navigate('/')
              }}
              className="btn-gold text-sm flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              返回大厅
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
