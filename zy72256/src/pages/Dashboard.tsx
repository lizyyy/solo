import { useEffect } from 'react'
import { useStore } from '@/store'
import { FileText, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { ACTION_LABELS, ROLE_LABELS } from '@shared/types'
import type { AuditLog } from '@shared/types'

export default function Dashboard() {
  const stats = useStore((s) => s.stats)
  const auditLogs = useStore((s) => s.auditLogs)
  const fetchStats = useStore((s) => s.fetchStats)
  const setAuditLogs = useStore((s) => s.setAuditLogs)

  useEffect(() => {
    fetchStats()
    fetch('/api/audit')
      .then(res => res.json())
      .then(data => setAuditLogs(data.data || []))
      .catch(() => {})
  }, [])

  const cards = [
    {
      label: '总记录数',
      value: stats?.total ?? 0,
      icon: FileText,
      color: 'bg-[#1a3a4a]',
      iconBg: 'bg-white/20',
    },
    {
      label: '混合坐标数',
      value: stats?.by_type?.mixed ?? 0,
      icon: AlertTriangle,
      color: 'bg-[#e8943a]',
      iconBg: 'bg-white/20',
    },
    {
      label: '待复核数',
      value: (stats?.by_status?.pending_review ?? 0) + (stats?.by_status?.under_review ?? 0),
      icon: Clock,
      color: 'bg-[#2a5a6a]',
      iconBg: 'bg-white/20',
    },
    {
      label: '已确认数',
      value: stats?.by_status?.confirmed ?? 0,
      icon: CheckCircle,
      color: 'bg-green-600',
      iconBg: 'bg-white/20',
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">数据概览</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`${card.color} rounded-xl p-5 text-white card-hover`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`${card.iconBg} p-3 rounded-lg`}>
                <card.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">最近操作记录</h3>
        </div>
        {auditLogs.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            暂无操作记录
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {auditLogs.slice(0, 5).map((log: AuditLog) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {log.operator}
                    </span>
                    <span className="text-xs text-gray-400">
                      {ROLE_LABELS[log.operator_role]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {ACTION_LABELS[log.action]} · {log.change_detail}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(log.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
