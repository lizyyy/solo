import type { AbnormalRecordNote } from '../../types'

interface Props {
  notes: AbnormalRecordNote[]
}

const levelTag: Record<AbnormalRecordNote['impactLevel'], { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-rust', text: 'text-white', label: '🔴 严重影响' },
  high: { bg: 'bg-rust-500', text: 'text-white', label: '🟠 高影响' },
  medium: { bg: 'bg-clay-500', text: 'text-white', label: '🟡 中影响' },
  low: { bg: 'bg-sage-500', text: 'text-white', label: '🟢 低影响' },
}

const barColor: Record<AbnormalRecordNote['impactLevel'], string> = {
  critical: 'bg-rust',
  high: 'bg-rust-500',
  medium: 'bg-clay-500',
  low: 'bg-sage-500',
}

export default function AbnormalNoteCard({ notes }: Props) {
  if (notes.length === 0) return null

  return (
    <div className="space-y-4">
      {notes.map((n) => {
        const tag = levelTag[n.impactLevel]
        const color = barColor[n.impactLevel]

        return (
          <div key={n.id} className="stripe-pad bg-paper-deep/60 rounded-xl p-5 relative border border-clay-100 shadow-sm hover:shadow-md transition-shadow">
            <span className={`absolute -left-1 top-4 flag-badge ${tag.bg} ${tag.text} shadow-md`}>
              {tag.label}
            </span>

            <div className="pl-16">
              <h4 className="font-kai text-lg text-clay-900 leading-snug mb-4 flex items-start gap-2">
                {n.impactLevel === 'critical' || n.impactLevel === 'high' ? (
                  <span className="text-rust-500 shrink-0 mt-0.5">⚠️</span>
                ) : (
                  <span className="text-clay-400 shrink-0 mt-0.5">💉</span>
                )}
                <span>{n.title}</span>
              </h4>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-bold text-graphite-700 mb-1 flex items-center gap-1">
                    <span>❓</span> 为什么没按正常走
                  </div>
                  <p className="text-sm text-graphite-600 leading-relaxed bg-white/60 rounded-lg px-3 py-2.5 border border-clay-100/50">
                    {n.reasonWhySkipped}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-graphite-700 mb-1 flex items-center gap-1">
                    <span>🛠️</span> 处理方式
                  </div>
                  <p className="text-sm text-graphite-600 leading-relaxed whitespace-pre-wrap bg-white/60 rounded-lg px-3 py-2.5 border border-clay-100/50 font-mono-soft">
                    {n.handling}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-graphite-700 mb-1 flex items-center gap-1">
                    <span>📌</span> 影响
                  </div>
                  <p className="text-sm text-graphite-600 leading-relaxed bg-white/60 rounded-lg px-3 py-2.5 border border-clay-100/50">
                    {n.impactDescription}
                  </p>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] text-graphite-500 mb-1">
                    <span>影响程度</span>
                    <span className="num font-bold">{n.impactPercent}%</span>
                  </div>
                  <div className="bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: `${n.impactPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
