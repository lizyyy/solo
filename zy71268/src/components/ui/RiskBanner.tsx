import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronUp, ChevronDown, CheckCircle } from 'lucide-react'
import { useSculptureStore, type RiskItem } from '@/store/useSculptureStore'

const severityConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  danger: {
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
    color: '#d62828',
  },
  warning: {
    icon: <AlertCircle className="w-4 h-4 shrink-0" />,
    color: '#f77f00',
  },
  caution: {
    icon: <Info className="w-4 h-4 shrink-0" />,
    color: '#f4a261',
  },
}

function RiskRow({ risk }: { risk: RiskItem }) {
  const config = severityConfig[risk.severity] ?? severityConfig.caution

  return (
    <div
      className="flex items-start gap-2 py-1.5 px-3 rounded"
      style={{ borderLeft: `3px solid ${config.color}` }}
    >
      <span style={{ color: config.color }}>{config.icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-200">{risk.title}</div>
        <div className="text-xs text-gray-400 leading-relaxed">{risk.description}</div>
      </div>
    </div>
  )
}

export default function RiskBanner() {
  const risks = useSculptureStore((s) => s.risks)
  const [expanded, setExpanded] = useState(true)

  if (risks.length === 0) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 py-2"
        style={{ backgroundColor: '#1a1a2e', borderTop: '1px solid #22c55e40' }}
      >
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-sm text-green-400 font-bold">所有参数正常</span>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ backgroundColor: '#1a1a2e', borderTop: '1px solid #374151' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-1.5 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-gray-200 font-bold">
            风险提示 ({risks.length})
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: '200px' }}>
          {risks.map((risk, i) => (
            <RiskRow key={`${risk.type}-${i}`} risk={risk} />
          ))}
        </div>
      )}
    </div>
  )
}
