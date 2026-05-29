import TimeWindowSelector from '@/components/overview/TimeWindowSelector'
import TrendChart from '@/components/overview/TrendChart'
import ClusterCardList from '@/components/overview/ClusterCardList'
import QualityWarningPanel from '@/components/overview/QualityWarningPanel'
import { useStore } from '@/store'
import { Database, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

export default function OverviewPage() {
  const clusters = useStore((s) => s.clusters)
  const warnings = useStore((s) => s.qualityWarnings)

  const totalQueries = clusters.reduce((s, c) => s + c.count, 0)
  const missingIndexCount = clusters.filter((c) => c.index_status === 'missing').length
  const criticalCount = warnings.filter((w) => w.severity === 'critical').length
  const coveredCount = clusters.filter((c) => c.index_status === 'covered').length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white font-['DM_Sans']">日志总览</h1>
          <p className="text-xs text-[#6b7f94] mt-0.5">慢查询聚类分析 · 数据质量检测</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-3.5 h-3.5 text-[#00D9A6]" />
            <span className="text-[10px] text-[#6b7f94]">慢查询总数</span>
          </div>
          <p className="text-xl font-bold text-white font-['JetBrains_Mono']">{totalQueries}</p>
        </div>
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[#E74C3C]" />
            <span className="text-[10px] text-[#6b7f94]">索引缺失</span>
          </div>
          <p className="text-xl font-bold text-[#E74C3C] font-['JetBrains_Mono']">{missingIndexCount}</p>
        </div>
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-[#F5A623]" />
            <span className="text-[10px] text-[#6b7f94]">质量警告</span>
          </div>
          <p className="text-xl font-bold text-[#F5A623] font-['JetBrains_Mono']">{criticalCount}</p>
        </div>
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-[#00D9A6]" />
            <span className="text-[10px] text-[#6b7f94]">索引覆盖</span>
          </div>
          <p className="text-xl font-bold text-[#00D9A6] font-['JetBrains_Mono']">{coveredCount}</p>
        </div>
      </div>

      <TimeWindowSelector />
      <TrendChart />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <h2 className="text-sm font-semibold text-[#a0b3c6] mb-3">聚类列表</h2>
          <ClusterCardList />
        </div>
        <div>
          <QualityWarningPanel />
        </div>
      </div>
    </div>
  )
}
