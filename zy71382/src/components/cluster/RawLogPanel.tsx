import { useStore } from '@/store'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { format } from 'sql-formatter'

export default function RawLogPanel({ clusterId }: { clusterId: string }) {
  const members = useStore((s) => s.clusterMembers)
  const logs = useStore((s) => s.logs)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const clusterMembers = members.filter((m) => m.cluster_id === clusterId)

  const toggleExpand = (logId: string) => {
    const next = new Set(expanded)
    if (next.has(logId)) next.delete(logId)
    else next.add(logId)
    setExpanded(next)
  }

  const copySql = (sql: string) => {
    navigator.clipboard.writeText(sql)
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {clusterMembers.map((m) => {
        const log = logs.find((l) => l.id === m.log_id)
        if (!log) return null
        const isExpanded = expanded.has(log.id)

        let formattedSql = log.sql_text
        try {
          formattedSql = format(log.sql_text, { language: 'mysql', tabWidth: 2 })
        } catch {}

        return (
          <div key={m.id} className="border-b border-[#1e2a36] last:border-b-0">
            <button
              onClick={() => toggleExpand(log.id)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#1a2332] transition-colors"
            >
              <span className="text-[11px] font-['JetBrains_Mono'] text-[#8b9db3] truncate flex-1">
                {log.sql_text.slice(0, 80)}...
              </span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#4a5f75] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#4a5f75] shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-3 space-y-2">
                <div className="relative">
                  <button
                    onClick={() => copySql(log.sql_text)}
                    className="absolute top-2 right-2 p-1 rounded bg-[#1e2a36] hover:bg-[#2a3a4d] transition-colors z-10"
                  >
                    <Copy className="w-3 h-3 text-[#6b7f94]" />
                  </button>
                  <pre className="bg-[#0a0e12] rounded p-3 text-[11px] font-['JetBrains_Mono'] text-[#8b9db3] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    {formattedSql}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#0a0e12] rounded px-3 py-2">
                    <span className="text-[#4a5f75]">执行时间</span>
                    <span className="ml-2 text-white font-['JetBrains_Mono']">{log.exec_time_ms}ms</span>
                  </div>
                  <div className="bg-[#0a0e12] rounded px-3 py-2">
                    <span className="text-[#4a5f75]">扫描行</span>
                    <span className={`ml-2 font-['JetBrains_Mono'] ${log.scan_rows === null ? 'text-[#F5A623]' : 'text-white'}`}>
                      {log.scan_rows ?? '缺失'}
                    </span>
                  </div>
                  <div className="bg-[#0a0e12] rounded px-3 py-2">
                    <span className="text-[#4a5f75]">返回行</span>
                    <span className="ml-2 text-white font-['JetBrains_Mono']">{log.return_rows ?? '缺失'}</span>
                  </div>
                  <div className="bg-[#0a0e12] rounded px-3 py-2">
                    <span className="text-[#4a5f75]">锁等待</span>
                    <span className={`ml-2 font-['JetBrains_Mono'] ${log.lock_time_ms && log.lock_time_ms > 0 ? 'text-[#E74C3C]' : 'text-white'}`}>
                      {log.lock_time_ms ?? '0'}ms
                    </span>
                  </div>
                  <div className="bg-[#0a0e12] rounded px-3 py-2">
                    <span className="text-[#4a5f75]">指纹</span>
                    <span className={`ml-2 font-['JetBrains_Mono'] text-[10px] ${log.sql_fingerprint === null ? 'text-[#E74C3C]' : 'text-[#00D9A6]'}`}>
                      {log.sql_fingerprint === null ? '缺失' : '有'}
                    </span>
                  </div>
                  <div className="bg-[#0a0e12] rounded px-3 py-2">
                    <span className="text-[#4a5f75]">时间</span>
                    <span className="ml-2 text-white font-['JetBrains_Mono'] text-[10px]">
                      {new Date(log.timestamp).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
