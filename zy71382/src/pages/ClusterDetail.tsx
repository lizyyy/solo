import { useStore } from '@/store'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, GitBranch, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import ClusterMemberTable from '@/components/cluster/ClusterMemberTable'
import IndexAnalysisPanel from '@/components/cluster/IndexAnalysisPanel'
import InterfaceMappingPanel from '@/components/cluster/InterfaceMappingPanel'
import RawLogPanel from '@/components/cluster/RawLogPanel'
import ImpactChart from '@/components/cluster/ImpactChart'
import { motion } from 'framer-motion'

const statusColor = {
  covered: '#00D9A6',
  partial: '#F5A623',
  missing: '#E74C3C',
}

const statusLabel = {
  covered: '索引覆盖',
  partial: '部分覆盖',
  missing: '索引缺失',
}

export default function ClusterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clusters = useStore((s) => s.clusters)
  const warnings = useStore((s) => s.qualityWarnings)
  const [activeTab, setActiveTab] = useState<'members' | 'raw'>('members')

  const cluster = clusters.find((c) => c.id === id)
  if (!cluster) {
    return (
      <div className="p-6 text-center text-[#6b7f94]">
        <p>聚类不存在</p>
        <button onClick={() => navigate('/overview')} className="text-[#00D9A6] mt-2 text-sm">
          返回总览
        </button>
      </div>
    )
  }

  const clusterWarnings = warnings.filter((w) => w.cluster_id === id)
  const color = statusColor[cluster.index_status]

  const tabs = [
    { key: 'members' as const, label: '归并列表' },
    { key: 'raw' as const, label: '原始记录' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/overview')}
          className="p-1.5 rounded-md hover:bg-[#1e2a36] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#6b7f94]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white font-['DM_Sans'] truncate">
            聚类详情
          </h1>
          <p className="text-[11px] text-[#6b7f94] font-['JetBrains_Mono'] truncate mt-0.5">
            {cluster.sql_summary}
          </p>
        </div>
        <span
          className="px-2.5 py-1 rounded text-[11px] font-medium shrink-0"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {statusLabel[cluster.index_status]}
        </span>
      </div>

      {clusterWarnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          {clusterWarnings.map((w) => (
            <div
              key={w.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] ${
                w.severity === 'critical'
                  ? 'bg-[#E74C3C]/10 text-[#E74C3C] border border-[#E74C3C]/20'
                  : w.severity === 'warning'
                    ? 'bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20'
                    : 'bg-[#4A9EFF]/10 text-[#4A9EFF] border border-[#4A9EFF]/20'
              }`}
            >
              {w.severity === 'critical' ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <GitBranch className="w-3 h-3" />
              )}
              {w.message}
            </div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <p className="text-[10px] text-[#4a5f75] mb-0.5">归并数量</p>
          <p className="text-lg font-bold text-white font-['JetBrains_Mono']">{cluster.count}</p>
        </div>
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <p className="text-[10px] text-[#4a5f75] mb-0.5">平均执行时间</p>
          <p className="text-lg font-bold text-white font-['JetBrains_Mono']">
            {cluster.avg_exec_time_ms >= 1000
              ? `${(cluster.avg_exec_time_ms / 1000).toFixed(1)}s`
              : `${cluster.avg_exec_time_ms}ms`}
          </p>
        </div>
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <p className="text-[10px] text-[#4a5f75] mb-0.5">平均扫描行</p>
          <p className={`text-lg font-bold font-['JetBrains_Mono'] ${cluster.avg_scan_rows === null ? 'text-[#F5A623]' : 'text-white'}`}>
            {cluster.avg_scan_rows === null
              ? '缺失'
              : cluster.avg_scan_rows >= 1000000
                ? `${(cluster.avg_scan_rows / 1000000).toFixed(1)}M`
                : `${(cluster.avg_scan_rows / 1000).toFixed(0)}K`}
          </p>
        </div>
        <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] px-4 py-3">
          <p className="text-[10px] text-[#4a5f75] mb-0.5">归并置信度</p>
          <p className={`text-lg font-bold font-['JetBrains_Mono'] ${cluster.confidence_score < 0.7 ? 'text-[#F5A623]' : 'text-[#00D9A6]'}`}>
            {(cluster.confidence_score * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="space-y-5">
          <IndexAnalysisPanel clusterId={id!} />
          <InterfaceMappingPanel clusterId={id!} />
        </div>
        <div className="space-y-5">
          <ImpactChart clusterId={id!} />
          <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] overflow-hidden">
            <div className="flex border-b border-[#1e2a36]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'text-[#00D9A6] border-b-2 border-[#00D9A6]'
                      : 'text-[#6b7f94] hover:text-[#a0b3c6]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'members' ? (
              <ClusterMemberTable clusterId={id!} />
            ) : (
              <RawLogPanel clusterId={id!} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
