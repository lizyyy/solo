import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Check, Clock, RotateCcw, AlertTriangle } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'
import { RISK_CATEGORY_LABELS, DECISION_TYPE_LABELS, RecordStatus, RiskCategory } from '@/types'

const CATEGORY_COLORS: Record<RiskCategory, string> = {
  route_cross: 'bg-red-500/20 text-red-400 border-red-500/30',
  delivery_timeout: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  missed_cleaning: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const STATUS_ICONS: Record<RecordStatus, React.ReactNode> = {
  processed: <Check className="w-4 h-4 text-green-400" />,
  pending: <Clock className="w-4 h-4 text-yellow-400" />,
  returned: <RotateCcw className="w-4 h-4 text-red-400" />,
}

const STATUS_DOT: Record<RecordStatus, string> = {
  processed: 'bg-green-400',
  pending: 'bg-yellow-400',
  returned: 'bg-red-400',
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

type FilterTab = RecordStatus | 'all'

export default function RecordsPage() {
  const navigate = useNavigate()
  const riskRecords = useGameStore(s => s.riskRecords)
  const updateRecordStatus = useGameStore(s => s.updateRecordStatus)

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchText, setSearchText] = useState('')
  const [returningId, setReturningId] = useState<string | null>(null)
  const [returnReason, setReturnReason] = useState('')

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'processed', label: '已处理' },
    { key: 'pending', label: '待确认' },
    { key: 'returned', label: '退回补材料' },
  ]

  const countByStatus = (status: FilterTab) => {
    if (status === 'all') return riskRecords.length
    return riskRecords.filter(r => r.status === status).length
  }

  const filtered = riskRecords
    .filter(r => activeTab === 'all' || r.status === activeTab)
    .filter(r => !searchText || r.description.includes(searchText) || r.explanation.includes(searchText))

  const handleConfirm = (id: string) => updateRecordStatus(id, 'processed')
  const handleReturn = (id: string) => {
    if (returningId === id && returnReason.trim()) {
      updateRecordStatus(id, 'returned', returnReason.trim())
      setReturningId(null)
      setReturnReason('')
    } else {
      setReturningId(id)
      setReturnReason('')
    }
  }
  const handleResubmit = (id: string) => updateRecordStatus(id, 'pending')
  const handleRevert = (id: string) => updateRecordStatus(id, 'pending')

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-white p-4 pb-8">
      <header className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#F0A500]" />
          风险记录管理
        </h1>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="搜索风险描述..."
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-white/30 focus:outline-none focus:border-[#F0A500]/50"
        />
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
              activeTab === tab.key
                ? 'bg-[#F0A500]/20 text-[#F0A500] border-[#F0A500]/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-[#F0A500]/30' : 'bg-white/10'
            }`}>
              {countByStatus(tab.key)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/30 text-sm">
            暂无匹配的风险记录
          </div>
        )}

        {filtered.map(record => (
          <div key={record.id} className="bg-white/5 border border-white/10 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[record.category]}`}>
                {RISK_CATEGORY_LABELS[record.category]}
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${STATUS_DOT[record.status]}`} />
                {STATUS_ICONS[record.status]}
                <span className="text-xs text-white/40">{formatTime(record.timestamp)}</span>
              </div>
            </div>

            <p className="text-sm text-white/90 mb-2">{record.description}</p>

            <div className="bg-black/20 rounded-lg px-3 py-2 mb-2 text-xs text-white/50">
              {record.explanation}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">
                决策类型: {DECISION_TYPE_LABELS[record.decisionType]}
              </span>
            </div>

            {record.status === 'returned' && record.returnReason && (
              <div className="mt-2 text-xs text-red-400/80 bg-red-500/10 rounded-lg px-3 py-2">
                退回原因: {record.returnReason}
              </div>
            )}

            {returningId === record.id && (
              <div className="mt-2 flex gap-2">
                <input
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="输入退回原因..."
                  className="flex-1 px-3 py-1.5 bg-black/20 border border-white/10 rounded-lg text-xs placeholder:text-white/20 focus:outline-none focus:border-red-500/50"
                  autoFocus
                />
                <button
                  onClick={() => handleReturn(record.id)}
                  disabled={!returnReason.trim()}
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs border border-red-500/30 disabled:opacity-30"
                >
                  确认退回
                </button>
              </div>
            )}

            <div className="mt-2 flex gap-2">
              {record.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleConfirm(record.id)}
                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs border border-green-500/30 hover:bg-green-500/30 transition-colors"
                  >
                    确认
                  </button>
                  <button
                    onClick={() => handleReturn(record.id)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  >
                    退回
                  </button>
                </>
              )}
              {record.status === 'returned' && (
                <button
                  onClick={() => handleResubmit(record.id)}
                  className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors"
                >
                  重新提交
                </button>
              )}
              {record.status === 'processed' && (
                <button
                  onClick={() => handleRevert(record.id)}
                  className="px-3 py-1.5 bg-white/5 text-white/50 rounded-lg text-xs border border-white/10 hover:bg-white/10 transition-colors"
                >
                  改为待确认
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
