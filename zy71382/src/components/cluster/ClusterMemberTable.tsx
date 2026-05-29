import { useStore } from '@/store'
import { useState } from 'react'
import { Scissors } from 'lucide-react'

export default function ClusterMemberTable({ clusterId }: { clusterId: string }) {
  const members = useStore((s) => s.clusterMembers)
  const logs = useStore((s) => s.logs)
  const splitCluster = useStore((s) => s.splitCluster)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const clusterMembers = members.filter((m) => m.cluster_id === clusterId)

  const toggleSelect = (logId: string) => {
    const next = new Set(selected)
    if (next.has(logId)) next.delete(logId)
    else next.add(logId)
    setSelected(next)
  }

  const handleSplit = () => {
    if (selected.size === 0 || selected.size === clusterMembers.length) return
    splitCluster(clusterId, Array.from(selected))
    setSelected(new Set())
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="px-4 py-2 bg-[#F5A623]/10 border-b border-[#F5A623]/20 flex items-center justify-between">
          <span className="text-[11px] text-[#F5A623]">
            已选择 {selected.size} 条记录
          </span>
          <button
            onClick={handleSplit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-[#F5A623]/20 text-[#F5A623] hover:bg-[#F5A623]/30 transition-colors"
          >
            <Scissors className="w-3 h-3" />
            拆分为新聚类
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-[#4a5f75] uppercase tracking-wider">
              <th className="px-4 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={selected.size === clusterMembers.length && clusterMembers.length > 0}
                  onChange={() => {
                    if (selected.size === clusterMembers.length) setSelected(new Set())
                    else setSelected(new Set(clusterMembers.map((m) => m.log_id)))
                  }}
                  className="rounded border-[#2a3a4d] bg-[#0a0e12]"
                />
              </th>
              <th className="px-4 py-2 text-left">日志ID</th>
              <th className="px-4 py-2 text-left">相似度</th>
              <th className="px-4 py-2 text-right">执行时间</th>
              <th className="px-4 py-2 text-right">扫描行</th>
              <th className="px-4 py-2 text-right">锁等待</th>
              <th className="px-4 py-2 text-left">时间</th>
            </tr>
          </thead>
          <tbody>
            {clusterMembers.map((m) => {
              const log = logs.find((l) => l.id === m.log_id)
              if (!log) return null
              const lowConfidence = m.similarity_score < 0.8

              return (
                <tr
                  key={m.id}
                  className={`border-t border-[#1e2a36] hover:bg-[#1a2332] transition-colors ${
                    selected.has(m.log_id) ? 'bg-[#00D9A6]/5' : ''
                  }`}
                >
                  <td className={`px-4 py-2 ${lowConfidence ? 'border-l-2 border-l-[#F5A623]' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(m.log_id)}
                      onChange={() => toggleSelect(m.log_id)}
                      className="rounded border-[#2a3a4d] bg-[#0a0e12]"
                    />
                  </td>
                  <td className="px-4 py-2 font-['JetBrains_Mono'] text-[#8b9db3]">
                    {log.id}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] ${
                        lowConfidence
                          ? 'bg-[#F5A623]/15 text-[#F5A623]'
                          : 'bg-[#00D9A6]/10 text-[#00D9A6]'
                      }`}
                    >
                      {(m.similarity_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-['JetBrains_Mono'] text-white">
                    {log.exec_time_ms >= 1000
                      ? `${(log.exec_time_ms / 1000).toFixed(1)}s`
                      : `${log.exec_time_ms}ms`}
                  </td>
                  <td className={`px-4 py-2 text-right font-['JetBrains_Mono'] ${log.scan_rows === null ? 'text-[#F5A623]' : 'text-white'}`}>
                    {log.scan_rows === null
                      ? '缺失'
                      : log.scan_rows >= 1000000
                        ? `${(log.scan_rows / 1000000).toFixed(1)}M`
                        : log.scan_rows >= 1000
                          ? `${(log.scan_rows / 1000).toFixed(0)}K`
                          : log.scan_rows}
                  </td>
                  <td className="px-4 py-2 text-right font-['JetBrains_Mono']">
                    {log.lock_time_ms !== null && log.lock_time_ms > 0 ? (
                      <span className="text-[#E74C3C]">{log.lock_time_ms}ms</span>
                    ) : (
                      <span className="text-[#4a5f75]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[#6b7f94] font-['JetBrains_Mono']">
                    {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
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
