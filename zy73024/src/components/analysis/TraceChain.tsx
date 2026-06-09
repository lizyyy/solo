import type { TraceNode, Anomaly } from '../../types'

const nodeTypeClass: Record<TraceNode['type'], string> = {
  original: 'bg-sage-50 border border-sage-200',
  conflict: 'bg-rust-50 border-2 border-rust-300',
  analysis: 'bg-clay-50 border border-clay-200',
  human_decision: 'stripe-pad bg-paper-deep/40 border-2 border-dashed border-clay-400',
  final: 'bg-clay-600 text-white border border-clay-700',
}

const nodeTypeIcon: Record<TraceNode['type'], string> = {
  original: '📊',
  conflict: '⚡',
  analysis: '🔍',
  human_decision: '✍️',
  final: '🎯',
}

interface Props {
  anomalies: Anomaly[]
  traceNodes: TraceNode[]
}

export default function TraceChain({ anomalies, traceNodes }: Props) {
  if (anomalies.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="font-kai text-xl text-clay-800 mb-2">追溯链</h3>
        <div className="py-10 text-center text-graphite-400 text-sm">无异常，数据全部正常 🎉</div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-kai text-xl text-clay-800">追溯链 · 瀑布式</h3>
        <span className="text-[11px] text-graphite-400">共 {anomalies.length} 个异常</span>
      </div>

      <div className="space-y-6">
        {anomalies.map((a) => {
          const nodes = traceNodes.filter((t) => t.anomalyId === a.id).sort((x, y) => x.step - y.step)
          const levelColor = a.level === 'critical' ? 'bg-rust text-white'
            : a.level === 'high' ? 'bg-rust-100 text-rust-700'
            : a.level === 'medium' ? 'bg-clay-100 text-clay-700'
            : 'bg-sage-100 text-sage-700'

          return (
            <div key={a.id} className="border border-clay-100 rounded-2xl p-4 bg-paper-deep/20">
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className={`flag-badge ${levelColor}`}>
                  {a.level === 'critical' ? '🔴 严重'
                    : a.level === 'high' ? '🟠 高'
                    : a.level === 'medium' ? '🟡 中'
                    : '🟢 低'}
                </span>
                <span className="font-medium text-clay-800 text-sm">{a.title}</span>
                {a.status === 'resolved' ? (
                  <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-sage-100 text-sage-700 border border-sage-200">
                    ✓ 已处理 {a.resolvedAt} {a.resolvedBy && `· ${a.resolvedBy}`}
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-rust-50 text-rust-600 border border-rust-100 animate-pulse-badge">
                    ⚠ 待处理
                  </span>
                )}
              </div>

              <div className="overflow-x-auto scrollbar-thin pb-2">
                <div className="flex items-stretch min-w-max">
                  {nodes.map((n, i) => {
                    const isLight = n.type === 'final'
                    const isConflict = n.type === 'conflict'
                    return (
                      <div key={n.id} className="flex items-stretch">
                        <div
                          className={`rounded-xl p-3 min-w-[150px] max-w-[180px] ${nodeTypeClass[n.type]} ${isConflict ? 'animate-pulse-badge' : ''}`}
                        >
                          <div className={`text-[11px] font-bold ${isLight ? 'text-clay-100' : 'text-graphite-500'} mb-1`}>
                            {nodeTypeIcon[n.type]} Step {n.step}
                          </div>
                          <div className={`text-sm font-bold leading-snug ${isLight ? 'text-white' : 'text-clay-900'}`}>
                            {n.title}
                          </div>
                          <div className={`text-[11px] mt-1.5 leading-relaxed ${isLight ? 'text-clay-100' : 'text-graphite-600'}`}>
                            {n.detail}
                          </div>
                          {(n.beforeValue || n.afterValue) && (
                            <div className={`mt-2 pt-2 border-t ${isLight ? 'border-clay-400' : 'border-black/5'}`}>
                              {n.beforeValue && (
                                <div className={`text-[11px] ${isLight ? 'line-through text-clay-200' : 'line-through text-graphite-400'}`}>
                                  {n.beforeValue}
                                </div>
                              )}
                              {n.afterValue && (
                                <div className={`text-[11px] font-bold ${isLight ? 'text-white' : 'text-clay-800'} mt-0.5`}>
                                  → {n.afterValue}
                                </div>
                              )}
                              {n.delta && (
                                <div className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded inline-block ${
                                  n.delta.includes('-') || n.delta.includes('+')
                                    ? n.delta.startsWith('+') && !n.delta.includes('相反')
                                      ? 'bg-rust-100 text-rust-700'
                                      : 'bg-sage-100 text-sage-700'
                                    : 'bg-clay-100 text-clay-700'
                                }`}>
                                  Δ {n.delta}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {i < nodes.length - 1 && (
                          <span className="flex items-center mx-2 text-clay-400 text-xl font-bold">
                            ➡️
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
