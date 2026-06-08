import { useEffect, useState } from 'react'
import { Copy, Check, Terminal, ScrollText } from 'lucide-react'
import { useLedgerStore } from '@/store/useLedgerStore'
import type { OperationLog } from '@/types'

const ACTION_CONFIG: Record<OperationLog['action'], { label: string; color: string }> = {
  import: { label: '导入', color: 'var(--blue)' },
  detect: { label: '检测', color: 'var(--orange)' },
  supplement: { label: '补录', color: 'var(--green)' },
  correct: { label: '修正', color: '#B388FF' },
  rerun: { label: '重跑', color: '#FFD600' },
  confirm: { label: '确认', color: 'var(--green)' },
  reject: { label: '打回', color: 'var(--red)' },
}

const CLI_TEMPLATES = [
  'npm run cli -- import --file <filename>',
  'npm run cli -- detect --all',
  'npm run cli -- detect --record <trade_no>',
  'npm run cli -- supplement --record <trade_no> --rate <rate> --remark "<remark>"',
  'npm run cli -- correct --record <trade_no> --field <field> --value "<value>"',
  'npm run cli -- confirm --record <trade_no>',
  'npm run cli -- reject --record <trade_no>',
  'npm run cli -- stats',
  'npm run cli -- demo --seed',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded transition-colors"
      style={{ color: copied ? 'var(--green)' : 'var(--text-muted)' }}
      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

export default function AuditLog() {
  const { auditLogs, fetchAuditLogs } = useLedgerStore()

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex-1 overflow-auto p-6 pb-52">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <ScrollText size={24} style={{ color: 'var(--text-primary)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>复盘记录</h1>
          </div>
          <p className="text-sm ml-9" style={{ color: 'var(--text-secondary)' }}>所有操作流水与可重跑命令</p>
        </div>

        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>时间</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>操作类型</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>详情</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>操作人</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>CLI 命令</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log, index) => {
                const config = ACTION_CONFIG[log.action]
                return (
                  <tr
                    key={log.id}
                    className="transition-colors"
                    style={{
                      background: index % 2 === 0 ? 'var(--bg-card)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = index % 2 === 0 ? 'var(--bg-card)' : 'transparent' }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(log.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          color: config.color,
                          background: `${config.color}18`,
                          border: `1px solid ${config.color}44`,
                        }}
                      >
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      {log.detail}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {log.operator}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code
                          className="px-2 py-1 rounded text-xs font-mono"
                          style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {log.cli_command}
                        </code>
                        <CopyButton text={log.cli_command} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    暂无操作记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 border-t p-4"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={16} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>CLI 命令模板</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {CLI_TEMPLATES.map((cmd) => (
            <div
              key={cmd}
              className="flex items-center gap-2 px-3 py-1.5 rounded"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <code className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{cmd}</code>
              <CopyButton text={cmd} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
