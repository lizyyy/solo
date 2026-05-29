import { useStore } from '@/store'
import { X, Save } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  recordId: string | null
  onClose: () => void
}

export default function SupplementDrawer({ recordId, onClose }: Props) {
  const reportRecords = useStore((s) => s.reportRecords)
  const clusters = useStore((s) => s.clusters)
  const warnings = useStore((s) => s.qualityWarnings)
  const submitSupplement = useStore((s) => s.submitSupplement)

  const [formData, setFormData] = useState<Record<string, string>>({})

  const record = reportRecords.find((r) => r.id === recordId)
  if (!record) return null

  const cluster = clusters.find((c) => c.id === record.cluster_id)
  const clusterWarnings = warnings.filter((w) => w.cluster_id === record.cluster_id)

  const missingInterface = clusterWarnings.some((w) => w.warning_type === 'missing_interface')
  const missingIndex = clusterWarnings.some((w) => w.warning_type === 'missing_index')
  const missingScanRows = clusterWarnings.some((w) => w.warning_type === 'missing_scan_rows')

  const handleSubmit = () => {
    submitSupplement(record.id, formData)
    setFormData({})
    onClose()
  }

  return (
    <AnimatePresence>
      {recordId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-[#141b22] border-l border-[#1e2a36] z-[101] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-[#1e2a36] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">补录材料</h3>
              <button onClick={onClose} className="p-1 rounded hover:bg-[#1e2a36] transition-colors">
                <X className="w-4 h-4 text-[#6b7f94]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cluster && (
                <div className="bg-[#0a0e12] rounded p-3">
                  <p className="text-[11px] text-[#8b9db3] font-['JetBrains_Mono'] leading-relaxed">
                    {cluster.sql_summary}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-[10px] text-[#E74C3C] uppercase tracking-wider font-semibold">缺失项</p>
                {clusterWarnings.map((w) => (
                  <div key={w.id} className="text-[11px] text-[#8b9db3] flex items-start gap-1.5">
                    <span className="text-[#F5A623] mt-0.5">·</span>
                    {w.message}
                  </div>
                ))}
              </div>

              {missingInterface && (
                <div>
                  <label className="text-[11px] text-[#a0b3c6] block mb-1.5">接口名称</label>
                  <input
                    type="text"
                    value={formData.interface_name ?? ''}
                    onChange={(e) => setFormData({ ...formData, interface_name: e.target.value })}
                    placeholder="/api/example"
                    className="w-full bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-2 text-xs font-['JetBrains_Mono'] text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors"
                  />
                </div>
              )}

              {missingIndex && (
                <div>
                  <label className="text-[11px] text-[#a0b3c6] block mb-1.5">索引信息</label>
                  <textarea
                    value={formData.index_info ?? ''}
                    onChange={(e) => setFormData({ ...formData, index_info: e.target.value })}
                    placeholder="idx_name (col1, col2)"
                    rows={3}
                    className="w-full bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-2 text-xs font-['JetBrains_Mono'] text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors resize-none"
                  />
                </div>
              )}

              {missingScanRows && (
                <div>
                  <label className="text-[11px] text-[#a0b3c6] block mb-1.5">扫描行数（EXPLAIN结果）</label>
                  <input
                    type="number"
                    value={formData.scan_rows ?? ''}
                    onChange={(e) => setFormData({ ...formData, scan_rows: e.target.value })}
                    placeholder="预估扫描行数"
                    className="w-full bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-2 text-xs font-['JetBrains_Mono'] text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] text-[#a0b3c6] block mb-1.5">备注（选填）</label>
                <textarea
                  value={formData.notes ?? ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="补充说明..."
                  rows={2}
                  className="w-full bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-2 text-xs text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#1e2a36] flex items-center gap-3">
              <button
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs bg-[#00D9A6] text-[#0F1419] font-medium hover:bg-[#00D9A6]/80 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                提交补录
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-xs text-[#6b7f94] hover:text-white transition-colors"
              >
                取消
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
