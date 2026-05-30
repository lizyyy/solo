import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { RiskCategory, RiskRecord, RecordStatus, RISK_CATEGORY_LABELS } from '@/types'
import { ShieldAlert, X, CheckCircle, Clock, RotateCcw } from 'lucide-react'

const STATUS_CYCLE: RecordStatus[] = ['processed', 'pending', 'returned']

const STATUS_ICONS: Record<RecordStatus, React.ReactNode> = {
  processed: <CheckCircle className="w-4 h-4 text-green-400" />,
  pending: <Clock className="w-4 h-4 text-amber-400" />,
  returned: <RotateCcw className="w-4 h-4 text-red-400" />,
}

const CATEGORY_COLORS: Record<RiskCategory, string> = {
  route_cross: 'border-red-500/50 bg-red-500/10',
  delivery_timeout: 'border-amber-500/50 bg-amber-500/10',
  missed_cleaning: 'border-purple-500/50 bg-purple-500/10',
}

const FILTER_OPTIONS: (RiskCategory | 'all')[] = ['all', 'route_cross', 'delivery_timeout', 'missed_cleaning']
const FILTER_LABELS: Record<RiskCategory | 'all', string> = {
  all: '全部',
  route_cross: '路线交叉',
  delivery_timeout: '出餐超时',
  missed_cleaning: '清洁漏做',
}

function RiskItem({ record, onCycleStatus }: { record: RiskRecord; onCycleStatus: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-lg border p-3 ${CATEGORY_COLORS[record.category]}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{record.description}</p>
          <p className="text-xs text-white/40 mt-1">
            游戏时间 {Math.floor(record.timestamp / 1000)}s
          </p>
        </div>
        <button
          onClick={onCycleStatus}
          className="shrink-0 hover:scale-110 transition-transform"
          title="切换状态"
        >
          {STATUS_ICONS[record.status]}
        </button>
      </div>
      <div className="mt-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          {expanded ? '收起 ▲' : '查看说明 ▼'}
        </button>
        {expanded && (
          <div className="mt-1 bg-white/5 rounded px-2 py-1 text-xs text-white/60">
            {record.explanation}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RiskDashboard() {
  const riskDashboardOpen = useGameStore(s => s.riskDashboardOpen)
  const toggleRiskDashboard = useGameStore(s => s.toggleRiskDashboard)
  const riskRecords = useGameStore(s => s.riskRecords)
  const activeRiskFilter = useGameStore(s => s.activeRiskFilter)
  const setRiskFilter = useGameStore(s => s.setRiskFilter)
  const updateRecordStatus = useGameStore(s => s.updateRecordStatus)

  if (!riskDashboardOpen) return null

  const filtered = activeRiskFilter === 'all'
    ? riskRecords
    : riskRecords.filter(r => r.category === activeRiskFilter)

  const routeCrossCount = riskRecords.filter(r => r.category === 'route_cross').length
  const deliveryTimeoutCount = riskRecords.filter(r => r.category === 'delivery_timeout').length
  const missedCleaningCount = riskRecords.filter(r => r.category === 'missed_cleaning').length

  const handleCycleStatus = (record: RiskRecord) => {
    const currentIndex = STATUS_CYCLE.indexOf(record.status)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
    updateRecordStatus(record.id, nextStatus)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A1A2E] rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#F0A500]" />
            <h2 className="text-lg font-bold text-white">风险记录</h2>
          </div>
          <button onClick={toggleRiskDashboard} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 p-4 border-b border-white/10">
          {FILTER_OPTIONS.map(option => (
            <button
              key={option}
              onClick={() => setRiskFilter(option)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                activeRiskFilter === option
                  ? 'bg-[#F0A500] text-black font-bold'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {FILTER_LABELS[option]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
            <span className="text-red-400 text-2xl font-bold">{routeCrossCount}</span>
            <p className="text-xs text-white/50 mt-1">路线交叉</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
            <span className="text-amber-400 text-2xl font-bold">{deliveryTimeoutCount}</span>
            <p className="text-xs text-white/50 mt-1">出餐超时</p>
          </div>
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-center">
            <span className="text-purple-400 text-2xl font-bold">{missedCleaningCount}</span>
            <p className="text-xs text-white/50 mt-1">清洁漏做</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-2">
            {filtered.map(record => (
              <RiskItem
                key={record.id}
                record={record}
                onCycleStatus={() => handleCycleStatus(record)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-white/30 text-sm py-8">暂无风险记录</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
