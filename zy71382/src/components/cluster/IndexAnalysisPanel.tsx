import { useStore } from '@/store'
import { CheckCircle, AlertTriangle, XCircle, Plus, ArrowRight } from 'lucide-react'

const statusIcon = {
  hit: CheckCircle,
  partial: AlertTriangle,
  missing: XCircle,
  redundant: CheckCircle,
}

const statusColor = {
  hit: '#00D9A6',
  partial: '#F5A623',
  missing: '#E74C3C',
  redundant: '#6b7f94',
}

const statusLabel = {
  hit: '命中',
  partial: '部分覆盖',
  missing: '缺失',
  redundant: '冗余',
}

export default function IndexAnalysisPanel({ clusterId }: { clusterId: string }) {
  const analyses = useStore((s) => s.indexAnalyses)
  const analysis = analyses.find((a) => a.cluster_id === clusterId)

  if (!analysis) {
    return (
      <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] p-4">
        <p className="text-xs text-[#6b7f94]">暂无索引分析数据</p>
      </div>
    )
  }

  const Icon = statusIcon[analysis.index_status]
  const color = statusColor[analysis.index_status]

  return (
    <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2a36] flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#a0b3c6] uppercase tracking-wider">
          索引分析
        </h3>
        <div className="flex items-center gap-1.5" style={{ color }}>
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">{statusLabel[analysis.index_status]}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x divide-[#1e2a36]">
        <div className="p-4">
          <p className="text-[10px] text-[#4a5f75] uppercase tracking-wider mb-2">当前索引</p>
          {analysis.current_indexes.length === 0 ? (
            <p className="text-[11px] text-[#E74C3C]">无索引</p>
          ) : (
            <ul className="space-y-1.5">
              {analysis.current_indexes.map((idx, i) => (
                <li
                  key={i}
                  className="text-[11px] font-['JetBrains_Mono'] text-[#8b9db3] bg-[#0a0e12] px-2.5 py-1.5 rounded"
                >
                  {idx}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4">
          <p className="text-[10px] text-[#4a5f75] uppercase tracking-wider mb-2">建议索引</p>
          {analysis.suggested_indexes.length === 0 ? (
            <p className="text-[11px] text-[#00D9A6]">无需新增索引</p>
          ) : (
            <ul className="space-y-1.5">
              {analysis.suggested_indexes.map((idx, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] bg-[#00D9A6]/5 text-[#00D9A6] px-2.5 py-1.5 rounded"
                >
                  <Plus className="w-3 h-3 shrink-0" />
                  {idx}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {analysis.current_indexes.length > 0 && analysis.suggested_indexes.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#1e2a36] flex items-center justify-center gap-2 text-[10px] text-[#4a5f75]">
          <span className="font-['JetBrains_Mono']">当前索引</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-[#00D9A6] font-['JetBrains_Mono']">建议索引</span>
        </div>
      )}

      <div className="px-4 py-3 border-t border-[#1e2a36] bg-[#0a0e12]/50">
        <p className="text-[11px] text-[#8b9db3] leading-relaxed">{analysis.explanation}</p>
      </div>
    </div>
  )
}
