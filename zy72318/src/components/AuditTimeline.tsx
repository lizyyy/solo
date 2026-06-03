import { Clock, User, GitBranch } from 'lucide-react'
import { useVarStore } from '@/store'

export default function AuditTimeline() {
  const { audits } = useVarStore()

  const sorted = [...audits].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-surface-border flex items-center gap-2">
        <Clock size={16} className="text-accent-gold" />
        <h3 className="text-sm font-medium text-text-primary font-sans">修改审计轨迹</h3>
      </div>
      <div className="p-5 max-h-[280px] overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-text-muted font-sans text-center py-6">暂无审计记录</p>
        ) : (
          <div className="relative pl-6 space-y-0">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-surface-border" />
            {sorted.map((entry) => (
              <div key={entry.id} className="relative pb-4 last:pb-0">
                <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-accent-gold/60 border-2 border-base-800" />
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs text-text-gold font-sans font-medium">
                        <User size={11} />
                        {entry.operator}
                      </span>
                      <span className="text-xs text-text-primary font-sans">{entry.action}</span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(entry.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary font-sans mt-0.5">{entry.reason}</p>
                    {entry.affectedResults.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <GitBranch size={10} className="text-text-muted" />
                        <span className="text-[10px] text-text-muted font-sans">
                          影响：{entry.affectedResults.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
