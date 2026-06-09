import type { ReviewDecision } from '../../types'

interface Props {
  decisions: ReviewDecision[]
}

export default function ReviewTable({ decisions }: Props) {
  if (decisions.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="font-kai text-xl text-clay-800 mb-2">人工改判记录</h3>
        <div className="py-8 text-center text-graphite-400 text-sm">暂无改判记录</div>
      </div>
    )
  }

  return (
    <div className="card p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-kai text-xl text-clay-800">人工改判记录表</h3>
        <span className="text-[11px] text-graphite-400">共 {decisions.length} 条</span>
      </div>

      <div className="overflow-x-auto scrollbar-thin -mx-2">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="bg-clay-50 text-clay-700">
              <th className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider rounded-tl-lg">日期</th>
              <th className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider">判读人</th>
              <th className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider">原因</th>
              <th className="px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider">改判前 → 后（减重率）</th>
              <th className="px-3 py-2.5 text-center font-semibold text-[11px] uppercase tracking-wider rounded-tr-lg">签字</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clay-50">
            {decisions.map((d, idx) => {
              const hasWeightDiff = Math.abs(d.beforeWeight - d.afterWeight) > 0.001
              return (
                <tr
                  key={d.id}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-paper-deep/20'} hover:bg-clay-50/50 transition-colors`}
                >
                  <td className="px-3 py-3 align-top">
                    <div className="num text-xs text-graphite-500">{d.reviewedAt}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-clay-100 text-clay-700 flex items-center justify-center font-kai font-bold text-xs">
                        {d.reviewer.slice(-1)}
                      </div>
                      <span className="font-medium text-clay-800 text-sm">{d.reviewer}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="text-sm text-graphite-600 leading-relaxed max-w-[240px]">{d.reason}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="space-y-1.5">
                      {hasWeightDiff && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="line-through text-graphite-400 num">{d.beforeWeight.toFixed(1)}kg</span>
                          <span className="text-clay-400">→</span>
                          <span className="text-rust-600 num font-bold">{d.afterWeight.toFixed(1)}kg</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${d.afterWeight < d.beforeWeight ? 'bg-sage-100 text-sage-700' : 'bg-rust-100 text-rust-700'}`}>
                            Δ {(d.afterWeight - d.beforeWeight > 0 ? '+' : '')}{(d.afterWeight - d.beforeWeight).toFixed(1)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="line-through text-graphite-400 bg-gray-50 px-1.5 py-0.5 rounded">
                          {d.beforeRate}
                        </span>
                        <span className="text-clay-400">→</span>
                        <span className="text-sage-700 font-bold bg-sage-50 px-1.5 py-0.5 rounded border border-sage-100">
                          {d.afterRate}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-center">
                    <div className="text-2xl">{d.signatureEmoji}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
