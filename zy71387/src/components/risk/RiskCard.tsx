import { useState } from 'react'
import type { RiskItem, RiskItemStatus } from '@/types'
import { useRiskStore } from '@/store/useRiskStore'
import SeverityBadge from '@/components/scan/SeverityBadge'

interface RiskCardProps {
  risk: RiskItem
}

const severityBarColor = {
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-safe',
}

const statusLabel: Record<RiskItemStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  ignored: '已忽略',
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function RiskCard({ risk }: RiskCardProps) {
  const updateRiskStatus = useRiskStore((s) => s.updateRiskStatus)
  const [showResolver, setShowResolver] = useState<RiskItemStatus | null>(null)
  const [resolverName, setResolverName] = useState('')

  const handleConfirm = (status: RiskItemStatus) => {
    if (resolverName.trim()) {
      updateRiskStatus(risk.id, status, resolverName.trim())
      setShowResolver(null)
      setResolverName('')
    } else {
      setShowResolver(status)
    }
  }

  const handleCancel = () => {
    setShowResolver(null)
    setResolverName('')
  }

  const handleSubmit = () => {
    if (!resolverName.trim() || !showResolver) return
    updateRiskStatus(risk.id, showResolver, resolverName.trim())
    setShowResolver(null)
    setResolverName('')
  }

  return (
    <div className="flex bg-base-800 border border-base-600 rounded-lg mb-3 overflow-hidden">
      <div className={`w-1 flex-shrink-0 ${severityBarColor[risk.severity]}`} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between">
          <span className="text-sm font-mono text-muted">{risk.riskType}</span>
          <SeverityBadge severity={risk.severity} />
        </div>
        <p className="text-white text-sm mt-1">{risk.description}</p>
        <p className="text-muted text-xs mt-2">影响范围: {risk.impactRange}</p>
        {risk.status !== 'pending' ? (
          <p className="text-muted text-xs mt-2">
            由 {risk.resolvedBy} 于 {formatDate(risk.resolvedAt)} {statusLabel[risk.status]}
          </p>
        ) : (
          <>
            {!showResolver ? (
              <div className="mt-3">
                <button
                  onClick={() => handleConfirm('confirmed')}
                  className="border border-accent text-accent hover:bg-accent hover:text-base-900 px-3 py-1 rounded text-sm mr-2 transition-colors"
                >
                  确认
                </button>
                <button
                  onClick={() => handleConfirm('ignored')}
                  className="border border-base-500 text-muted hover:bg-base-600 px-3 py-1 rounded text-sm transition-colors"
                >
                  忽略
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={resolverName}
                  onChange={(e) => setResolverName(e.target.value)}
                  placeholder="请输入处理人姓名"
                  className="flex-1 bg-base-700 border border-base-600 rounded px-2 py-1 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
                  autoFocus
                />
                <button
                  onClick={handleSubmit}
                  className="border border-accent text-accent hover:bg-accent hover:text-base-900 px-3 py-1 rounded text-sm transition-colors"
                >
                  确定
                </button>
                <button
                  onClick={handleCancel}
                  className="border border-base-500 text-muted hover:bg-base-600 px-3 py-1 rounded text-sm transition-colors"
                >
                  取消
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
