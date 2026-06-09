import type { WeightRecord, RecordSource } from '../../types'

const sourceMeta: Record<RecordSource, { color: string; icon: string; label: string }> = {
  official: { color: 'bg-sage', icon: '⚖️', label: '官方称重' },
  old_version: { color: 'bg-rust', icon: '📜', label: '旧版曲线' },
  name_change: { color: 'bg-clay', icon: '✏️', label: '改名记录' },
  verbal: { color: 'bg-graphite', icon: '💬', label: '口头备注' },
  missing_vaccine: { color: 'bg-clay-300', icon: '💉', label: '疫苗缺失' },
}

interface Props {
  records: WeightRecord[]
  petName: string
}

export default function RecordTimeline({ records, petName }: Props) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-kai text-xl text-clay-800">称重记录时间轴</h3>
          <div className="text-xs text-graphite-400 mt-0.5">共 {records.length} 条，按日期倒序</div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-sage-50 text-sage-700 border border-sage-200">
            ✓ 已纳入
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
            ✕ 未纳入
          </span>
        </div>
      </div>

      <div className="relative max-h-[520px] overflow-y-auto scrollbar-thin pr-2">
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-clay-100" />

        <div className="space-y-5">
          {sorted.map((r) => {
            const meta = sourceMeta[r.source]
            const nameDiff = r.capturedByName && r.capturedByName !== petName

            return (
              <div key={r.id} className="relative pl-16">
                <div className={`absolute left-0 top-2 w-8 h-8 rounded-full ${meta.color} border-2 border-white flex items-center justify-center text-[13px] shadow-sm`}>
                  {meta.icon}
                </div>

                <div className={`rounded-xl border p-4 transition-all ${r.isIncluded ? 'bg-white border-clay-100 hover:border-clay-200' : 'bg-paper-deep/40 border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num font-bold text-clay-800">{r.date}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.color.replace('bg-', 'bg-').replace('bg-sage', 'bg-sage-100 text-sage-700').replace('bg-rust', 'bg-rust-100 text-rust-700').replace('bg-clay-300', 'bg-clay-100 text-clay-700').replace('bg-clay', 'bg-clay-100 text-clay-700').replace('bg-graphite', 'bg-graphite-100 text-graphite-700')}`}>
                        {meta.label}
                      </span>
                      {nameDiff && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-rust-50 text-rust-600 font-medium border border-rust-100">
                          当时称名: {r.capturedByName}
                        </span>
                      )}
                      {r.versionLabel && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-graphite-50 text-graphite-600 border border-graphite-100">
                          {r.versionLabel}
                        </span>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer shrink-0 select-none">
                      <input
                        type="checkbox"
                        checked={r.isIncluded}
                        readOnly
                        className="sr-only peer"
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors relative ${r.isIncluded ? 'bg-sage' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${r.isIncluded ? 'left-[18px]' : 'left-0.5'}`} />
                      </div>
                      <span className={`text-xs font-bold ${r.isIncluded ? 'text-sage-600' : 'text-gray-400'}`}>
                        {r.isIncluded ? '✓' : '✕'}
                      </span>
                    </label>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="num text-2xl font-bold text-clay-900">{r.weight.toFixed(1)}</span>
                        <span className="text-sm text-graphite-500">kg</span>
                      </div>
                      <div className="mt-1 flex items-center gap-0.5 text-xs">
                        <span className="text-graphite-500 mr-1">可信度</span>
                        <span className="text-clay-500 tracking-tight">
                          {'★'.repeat(r.credibility)}
                          <span className="text-clay-200">{'★'.repeat(5 - r.credibility)}</span>
                        </span>
                      </div>
                    </div>
                    {r.note && (
                      <div className="flex-1 min-w-[200px] text-xs text-graphite-500 leading-relaxed bg-paper-deep/50 rounded-lg px-3 py-2 border border-clay-50">
                        💡 {r.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
