import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertTriangle, FileText, AlertCircle } from 'lucide-react'
import { useStore } from '@/store'

const STATUS_MAP: Record<string, string> = {
  smooth: '顺利',
  pending_review: '待复核',
  pending_confirm: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  completed: '已完成',
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  smooth: { label: '顺利', className: 'bg-teal-500 text-white' },
  mixed_currency: { label: '同列', className: 'bg-amber-500 text-white' },
  supplementary: { label: '补录', className: 'bg-navy-300 text-white' },
}

type FilterTab = 'all' | 'smooth' | 'mixed_currency' | 'supplementary'

export default function Overview() {
  const navigate = useNavigate()
  const { records, conflicts } = useStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const smoothCount = records.filter((r) => r.recordType === 'smooth').length
  const mixedReviewCount = records.filter(
    (r) => r.hasMixedCurrency && r.status === 'pending_review'
  ).length
  const supplementaryCount = records.filter((r) => r.recordType === 'supplementary').length
  const pendingConflictCount = conflicts.filter((c) => c.resolution === 'pending').length

  const pendingItems = records.filter(
    (r) => r.status === 'pending_review' || r.status === 'pending_confirm'
  )

  const filteredRecords = records.filter((r) => {
    if (activeTab === 'all') return true
    if (activeTab === 'smooth') return r.recordType === 'smooth'
    if (activeTab === 'mixed_currency') return r.hasMixedCurrency
    if (activeTab === 'supplementary') return r.recordType === 'supplementary'
    return true
  })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'smooth', label: '顺利' },
    { key: 'mixed_currency', label: '同列' },
    { key: 'supplementary', label: '补录' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-[#1B2A4A]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-3xl font-semibold text-navy-500">{smoothCount}</div>
              <div className="text-sm text-navy-300 mt-1">顺利记录</div>
            </div>
            <CheckCircle className="w-8 h-8 text-[#1B2A4A] opacity-40" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-[#D4A843]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-3xl font-semibold text-navy-500">{mixedReviewCount}</div>
              <div className="text-sm text-navy-300 mt-1">同列待复核</div>
            </div>
            <AlertTriangle className="w-8 h-8 text-[#D4A843] opacity-40" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-[#8E9BB3]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-3xl font-semibold text-navy-500">{supplementaryCount}</div>
              <div className="text-sm text-navy-300 mt-1">补录记录</div>
            </div>
            <FileText className="w-8 h-8 text-[#8E9BB3] opacity-40" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-[#DC2626]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-3xl font-semibold text-navy-500">{pendingConflictCount}</div>
              <div className="text-sm text-navy-300 mt-1">冲突待确认</div>
            </div>
            <AlertCircle className="w-8 h-8 text-[#DC2626] opacity-40" />
          </div>
        </div>
      </div>

      {pendingItems.length > 0 && (
        <div className="bg-amber-500 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-white" />
            <span className="text-white font-medium">
              当前有 {pendingItems.length} 条记录待处理
            </span>
          </div>
          <button
            onClick={() => setActiveTab('all')}
            className="text-white text-sm underline hover:no-underline"
          >
            查看待处理记录
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b border-navy-50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-navy-500 border-b-2 border-navy-500'
                  : 'text-navy-300 hover:text-navy-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-50">
                <th className="text-left px-6 py-3 text-sm font-medium text-navy-300">产品名称</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-navy-300">类型</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-navy-300">货币</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-navy-300">水位线金额</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-navy-300">状态</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-navy-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-navy-50 last:border-b-0 hover:bg-navy-50/30 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-navy-500">
                    {record.productName}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        TYPE_BADGE[record.recordType]?.className || ''
                      }`}
                    >
                      {TYPE_BADGE[record.recordType]?.label || record.recordType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-navy-400">{record.currency}</td>
                  <td className="px-6 py-4 text-sm font-mono text-navy-500">
                    {record.waterlineAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-navy-400">
                    {STATUS_MAP[record.status] || record.status}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/detail/${record.id}`)}
                      className="text-navy-300 hover:text-navy-500 text-sm transition-colors"
                    >
                      查看明细
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <div className="text-center py-12 text-sm text-navy-200">暂无记录</div>
          )}
        </div>
      </div>
    </div>
  )
}
