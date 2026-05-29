import { useStore } from '@/store'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { QualityWarning } from '@/types'

const severityConfig = {
  critical: { icon: AlertCircle, color: 'text-[#E74C3C]', bg: 'bg-[#E74C3C]/10', border: 'border-[#E74C3C]/30' },
  warning: { icon: AlertTriangle, color: 'text-[#F5A623]', bg: 'bg-[#F5A623]/10', border: 'border-[#F5A623]/30' },
  info: { icon: Info, color: 'text-[#4A9EFF]', bg: 'bg-[#4A9EFF]/10', border: 'border-[#4A9EFF]/30' },
}

export default function QualityWarningPanel() {
  const warnings = useStore((s) => s.qualityWarnings)
  const clusters = useStore((s) => s.clusters)
  const [expanded, setExpanded] = useState<string | null>(null)

  const criticalCount = warnings.filter((w) => w.severity === 'critical').length
  const warningCount = warnings.filter((w) => w.severity === 'warning').length
  const infoCount = warnings.filter((w) => w.severity === 'info').length

  const sorted = [...warnings].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2a36] flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#a0b3c6] uppercase tracking-wider">
          数据质量警告
        </h3>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] bg-[#E74C3C]/15 text-[#E74C3C]">
              {criticalCount} 严重
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] bg-[#F5A623]/15 text-[#F5A623]">
              {warningCount} 警告
            </span>
          )}
          {infoCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] bg-[#4A9EFF]/15 text-[#4A9EFF]">
              {infoCount} 提示
            </span>
          )}
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        <AnimatePresence>
          {sorted.map((w) => {
            const config = severityConfig[w.severity]
            const Icon = config.icon
            const cluster = clusters.find((c) => c.id === w.cluster_id)
            const isExpanded = expanded === w.id

            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={`border-b border-[#1e2a36] last:border-b-0 cursor-pointer ${config.bg} hover:brightness-110 transition-all`}
                onClick={() => setExpanded(isExpanded ? null : w.id)}
              >
                <div className="px-4 py-2.5 flex items-start gap-2.5">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#c8d6e5] leading-relaxed">{w.message}</p>
                    {cluster && (
                      <p className="text-[10px] text-[#6b7f94] mt-0.5 font-['JetBrains_Mono']">
                        聚类: {cluster.sql_summary.slice(0, 50)}...
                      </p>
                    )}
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 pl-9">
                        <p className="text-[11px] text-[#8b9db3] leading-relaxed">{w.detail}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
