import { History, Gauge, MessageCircle, Syringe, Info } from 'lucide-react'
import type { InfluenceFactor, InfluenceFactorType } from '@shared/types'
import { cn } from '@/lib/utils'

interface FactorPanelProps {
  factors: InfluenceFactor[]
}

const ICON_MAP: Record<InfluenceFactorType, typeof History> = {
  legacy_curve: History,
  boundary_sample: Gauge,
  verbal_note: MessageCircle,
  vaccine_missing: Syringe,
}

const IMPACT_CLS: Record<InfluenceFactor['impact'], string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  negative: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
}

const IMPACT_TEXT: Record<InfluenceFactor['impact'], string> = {
  positive: '正向影响',
  negative: '负向影响',
  neutral: '中性',
}

export default function FactorPanel({ factors }: FactorPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">结论影响因子分析</h3>
        <Info className="h-4 w-4 text-slate-400" />
      </div>

      {factors.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">未检测到影响因子</div>
      ) : (
        <ul className="space-y-3">
          {factors.map((f) => {
            const Icon = ICON_MAP[f.type]
            return (
              <li
                key={f.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200">
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{f.description}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      IMPACT_CLS[f.impact],
                    )}
                  >
                    {IMPACT_TEXT[f.impact]}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    受影响 {f.affectedRecords.length} 条
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
