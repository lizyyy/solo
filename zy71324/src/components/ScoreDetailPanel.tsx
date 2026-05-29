import { ScoreBreakdown, FREQUENCY_BANDS, LOW_FREQ_BANDS, MID_FREQ_BANDS } from '@/types'
import { X } from 'lucide-react'

interface ScoreDetailPanelProps {
  breakdown: ScoreBreakdown | null
  isOpen: boolean
  onClose: () => void
}

export default function ScoreDetailPanel({ breakdown, isOpen, onClose }: ScoreDetailPanelProps) {
  if (!isOpen || !breakdown) return null

  const bandLabel = (freq: string) => {
    if (LOW_FREQ_BANDS.includes(freq as never)) return '低频'
    if (MID_FREQ_BANDS.includes(freq as never)) return '中频'
    return '高频'
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-[#0f1f1a] border-l border-[#2d4a3f] shadow-2xl z-50 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-[#2d4a3f]">
        <h3 className="text-lg font-semibold text-[#e8a838]">{breakdown.materialName}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-1">
        {FREQUENCY_BANDS.map((freq, idx) => {
          const raw = breakdown.rawCoefficients[freq]
          const weight = breakdown.weightApplied[freq]
          const weighted = breakdown.weightedValues[freq]
          const missing = raw === null
          const outOfRange = raw !== null && (raw < 0 || raw > 1)

          return (
            <div key={freq} className="relative">
              {idx > 0 && (
                <div className="absolute left-3 -top-2 w-0.5 h-2 bg-[#e8a838]/40" />
              )}
              <div className="flex items-center gap-2 py-2 px-3 rounded bg-[#1a2f2a] text-sm">
                <span className="w-16 text-gray-400 shrink-0">
                  {freq}
                  <span className="text-gray-600 ml-1 text-xs">{bandLabel(freq)}</span>
                </span>
                <span className={`w-12 text-right ${missing || outOfRange ? 'text-red-400' : 'text-gray-200'}`}>
                  {missing ? '缺失' : outOfRange ? '越界' : raw!.toFixed(3)}
                </span>
                <span className="text-[#e8a838]">×</span>
                <span className="w-12 text-right text-gray-400">{weight.toFixed(3)}</span>
                <span className="text-gray-600">=</span>
                <span className={`w-14 text-right ${missing || outOfRange ? 'text-gray-600' : 'text-white'}`}>
                  {weighted.toFixed(4)}
                </span>
              </div>
              {idx < FREQUENCY_BANDS.length - 1 && (
                <div className="absolute left-3 bottom-0 w-0.5 h-1 bg-[#e8a838]/40" />
              )}
            </div>
          )
        })}
      </div>

      <div className="p-4 border-t border-[#2d4a3f]">
        <div className="flex justify-between items-center px-3 py-2 rounded bg-[#e8a838]/10">
          <span className="text-[#e8a838] font-semibold">综合评分</span>
          <span className="text-[#e8a838] font-bold text-lg">{breakdown.totalScore.toFixed(4)}</span>
        </div>

        {breakdown.issues.length > 0 && (
          <div className="mt-3 space-y-1">
            {breakdown.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`text-xs px-3 py-1.5 rounded ${
                  issue.severity === 'error'
                    ? 'bg-red-900/30 text-red-400'
                    : 'bg-yellow-900/30 text-yellow-400'
                }`}
              >
                {issue.detail}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
