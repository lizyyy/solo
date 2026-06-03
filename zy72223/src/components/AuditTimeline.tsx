import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { type AuditLog, useStore } from '@/store'

const actionConfig: Record<string, { label: string; className: string }> = {
  import: { label: '导入', className: 'bg-blue-50 text-blue-600' },
  supplement_note: { label: '补录', className: 'bg-ledger-green-light text-ledger-green' },
  manual_correction: { label: '修正', className: 'bg-ledger-amber-light text-ledger-amber' },
  rerun: { label: '重跑', className: 'bg-purple-50 text-purple-600' },
  review: { label: '复核', className: 'bg-cyan-50 text-cyan-600' },
}

interface AuditTimelineProps {
  logs: AuditLog[]
}

export default function AuditTimeline({ logs }: AuditTimelineProps) {
  const { fetchCommand } = useStore()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [commands, setCommands] = useState<Record<string, string>>({})

  const handleCopy = async (log: AuditLog) => {
    let cmd = commands[log.id]
    if (!cmd) {
      try {
        cmd = await fetchCommand(log.id)
        setCommands((prev) => ({ ...prev, [log.id]: cmd! }))
      } catch {
        return
      }
    }
    await navigator.clipboard.writeText(cmd)
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-ledger-muted text-sm">暂无操作记录</div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-ledger-border" />

      <div className="space-y-6">
        {logs.map((log) => {
          const cfg = actionConfig[log.action] || actionConfig.import
          const hasCommand = log.action === 'import' || log.action === 'rerun'

          return (
            <div key={log.id} className="relative flex gap-4">
              <div className="relative z-10 w-6 h-6 rounded-full bg-white border-2 border-ledger-border flex items-center justify-center shrink-0 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${
                  log.action === 'import' ? 'bg-blue-500' :
                  log.action === 'supplement_note' ? 'bg-ledger-green' :
                  log.action === 'manual_correction' ? 'bg-ledger-amber' :
                  log.action === 'rerun' ? 'bg-purple-500' :
                  'bg-cyan-500'
                }`} />
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-ledger-muted">{log.operator}</span>
                  <span className="text-xs text-ledger-muted font-mono">
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>

                <p className="text-sm text-ledger-text font-serif">{log.detail}</p>

                {hasCommand && (commands[log.id] || log.command) && (
                  <div className="mt-2 bg-ledger-text rounded-lg p-3 relative group">
                    <code className="text-xs font-mono text-ledger-amber break-all">
                      {commands[log.id] || log.command}
                    </code>
                    <button
                      onClick={() => handleCopy(log)}
                      className="absolute top-2 right-2 p-1 rounded bg-ledger-text/80 text-white/70 hover:text-white transition-colors"
                      title="复制命令"
                    >
                      {copiedId === log.id ? (
                        <Check className="w-3 h-3 text-ledger-green" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
