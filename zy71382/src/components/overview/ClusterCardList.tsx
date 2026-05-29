import { useStore } from '@/store'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, AlertCircle } from 'lucide-react'
import type { Cluster } from '@/types'

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

function formatRows(rows: number | null): string {
  if (rows === null) return '缺失'
  if (rows >= 1000000) return `${(rows / 1000000).toFixed(1)}M`
  if (rows >= 1000) return `${(rows / 1000).toFixed(0)}K`
  return rows.toString()
}

function formatTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export default function ClusterCardList() {
  const clusters = useStore((s) => s.clusters)
  const warnings = useStore((s) => s.qualityWarnings)
  const navigate = useNavigate()

  const sorted = [...clusters].sort((a, b) => {
    const order = { missing: 0, partial: 1, covered: 2 }
    return order[a.index_status] - order[b.index_status]
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {sorted.map((cluster: Cluster, idx: number) => {
        const clusterWarnings = warnings.filter((w) => w.cluster_id === cluster.id)
        const hasCritical = clusterWarnings.some((w) => w.severity === 'critical')
        const color = statusColor[cluster.index_status]
        const scanRowsText = cluster.avg_scan_rows !== null
          ? formatRows(cluster.avg_scan_rows)
          : '缺失'

        return (
          <motion.div
            key={cluster.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.04 }}
            className="bg-[#141b22] rounded-lg border border-[#1e2a36] overflow-hidden cursor-pointer group hover:border-[#2a3a4d] transition-all duration-200"
            onClick={() => navigate(`/cluster/${cluster.id}`)}
          >
            <div className="h-1" style={{ backgroundColor: color }} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-['JetBrains_Mono'] text-[#8b9db3] truncate leading-relaxed">
                    {cluster.sql_summary}
                  </p>
                </div>
                {hasCritical && (
                  <AlertCircle className="w-3.5 h-3.5 text-[#E74C3C] shrink-0 animate-pulse" />
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-[10px] text-[#4a5f75] mb-0.5">频次</p>
                  <p className="text-sm font-semibold text-white font-['JetBrains_Mono']">
                    {cluster.count}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#4a5f75] mb-0.5">平均扫描行</p>
                  <p className={`text-sm font-semibold font-['JetBrains_Mono'] ${cluster.avg_scan_rows === null ? 'text-[#F5A623]' : 'text-white'}`}>
                    {scanRowsText}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#4a5f75] mb-0.5">平均耗时</p>
                  <p className="text-sm font-semibold text-white font-['JetBrains_Mono']">
                    {formatTime(cluster.avg_exec_time_ms)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: `${color}15`,
                      color,
                    }}
                  >
                    {statusLabel[cluster.index_status]}
                  </span>
                  {cluster.confidence_score < 0.7 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F5A623]/15 text-[#F5A623]">
                      置信度 {(cluster.confidence_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#4a5f75] group-hover:text-[#00D9A6] transition-colors" />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
