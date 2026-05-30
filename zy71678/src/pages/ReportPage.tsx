import { useState, useEffect } from 'react'
import {
  ClipboardList, Download, AlertTriangle, FileText, Globe, Percent,
  CalendarDays, Music, Shield, TrendingUp, Clock, XCircle, AlertCircle, Info,
} from 'lucide-react'
import { useLedgerStore } from '@/store'
import type { RiskItem, RiskSeverity, Contract } from '@/types'
import { exportToCSV, formatDate, daysUntil } from '@/utils/helpers'

type RiskFilter = 'all' | RiskSeverity

const SEVERITY_ICON: Record<RiskSeverity, React.ReactNode> = {
  high: <XCircle size={16} className="text-red-500 shrink-0" />,
  medium: <AlertCircle size={16} className="text-yellow-500 shrink-0" />,
  low: <Info size={16} className="text-blue-500 shrink-0" />,
}

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-active',
  expiring: 'badge-expiring',
  expired: 'badge-expired',
  pending: 'badge-pending',
}

const STATUS_LABEL: Record<string, string> = {
  active: '生效中',
  expiring: '即将到期',
  expired: '已过期',
  pending: '待签署',
}

const STATUS_BAR_COLOR: Record<string, string> = {
  active: 'bg-green-500',
  expiring: 'bg-amber-400',
  expired: 'bg-red-500',
  pending: 'bg-gray-400',
}

export default function ReportPage() {
  const { samples, contracts, platforms, royalties, risks, refreshRisks, refreshContractStatuses } = useLedgerStore()
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')

  useEffect(() => {
    refreshRisks()
    refreshContractStatuses()
  }, [])

  const activeContracts = contracts.filter(c => c.status === 'active').length
  const activePlatforms = platforms.filter(p => p.status === 'active').length

  const filteredRisks = riskFilter === 'all'
    ? risks
    : risks.filter(r => r.severity === riskFilter)

  const validContracts = contracts.filter(c => c.startDate && c.endDate)
  const minDate = validContracts.length > 0
    ? Math.min(...validContracts.map(c => new Date(c.startDate).getTime()))
    : 0
  const maxDate = validContracts.length > 0
    ? Math.max(...validContracts.map(c => new Date(c.endDate).getTime()))
    : 0
  const totalSpan = maxDate - minDate || 1
  const todayOffset = Date.now() - minDate
  const todayPercent = totalSpan > 0 ? (todayOffset / totalSpan) * 100 : 50

  function getBarPositions(contract: Contract) {
    if (!contract.startDate || !contract.endDate) return null
    const start = new Date(contract.startDate).getTime()
    const end = new Date(contract.endDate).getTime()
    const left = ((start - minDate) / totalSpan) * 100
    const width = ((end - start) / totalSpan) * 100
    return { left, width }
  }

  const contractMap = Object.fromEntries(contracts.map(c => [c.id, c]))

  function getRiskCountForSample(sampleId: string): number {
    return risks.filter(r => r.relatedId === sampleId && r.relatedType === 'sample').length
  }

  function getPlatformCountForContract(contractId: string): number {
    return platforms.filter(p => p.contractId === contractId).length
  }

  function getRoyaltySummary(sampleId: string): string {
    const sampleRoyalties = royalties.filter(r => r.sampleId === sampleId)
    if (sampleRoyalties.length === 0) return '未配置'
    return sampleRoyalties.map(r => `${r.rightHolder} ${r.percentage}%`).join('；')
  }

  function getRoyaltyStatus(sampleId: string): string {
    const sampleRoyalties = royalties.filter(r => r.sampleId === sampleId)
    if (sampleRoyalties.length === 0) return '未配置'
    const total = sampleRoyalties.reduce((s, r) => s + r.percentage, 0)
    if (total >= 100) return '已完整'
    return `合计${total}%`
  }

  function handleExport() {
    const headers = ['采样名称', '原始作品', '原始艺人', '关联合同', '合同状态', '分成比例', '授权平台', '风险项']
    const rows = samples.map(s => {
      const contract = contractMap[s.contractId]
      return [
        s.title,
        s.originalWork,
        s.originalArtist,
        contract?.contractNo ?? '-',
        contract ? STATUS_LABEL[contract.status] ?? contract.status : '-',
        getRoyaltySummary(s.id),
        contract ? String(getPlatformCountForContract(contract.id)) : '0',
        String(getRiskCountForSample(s.id)),
      ]
    })
    const dateStr = new Date().toISOString().slice(0, 10)
    exportToCSV(headers, rows, `版权采样授权台账_${dateStr}`)
  }

  const riskTabs: { key: RiskFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'high', label: '高危' },
    { key: 'medium', label: '中危' },
    { key: 'low', label: '低危' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-title text-2xl font-semibold text-forest-700 flex items-center gap-2">
          <ClipboardList size={28} />
          台账报告
        </h1>
        <button className="btn-primary flex items-center gap-2" onClick={handleExport}>
          <Download size={16} />
          导出CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-forest-50 text-forest-600">
            <Music size={20} />
          </div>
          <div>
            <p className="text-sm text-warm-500">采样总数</p>
            <p className="text-xl font-semibold text-forest-700">{samples.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-green-50 text-green-600">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-sm text-warm-500">有效合同</p>
            <p className="text-xl font-semibold text-forest-700">{activeContracts}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-amber-50 text-amber-600">
            <Globe size={20} />
          </div>
          <div>
            <p className="text-sm text-warm-500">授权平台</p>
            <p className="text-xl font-semibold text-forest-700">{activePlatforms}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-md bg-red-50 text-red-600">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-sm text-warm-500">风险条目</p>
            <p className="text-xl font-semibold text-forest-700">{risks.length}</p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-serif-title text-lg font-semibold text-forest-700 flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-amber-500" />
          风险提示
        </h2>
        <div className="flex gap-2 mb-4">
          {riskTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setRiskFilter(tab.key)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                riskFilter === tab.key
                  ? 'bg-forest-700 text-white'
                  : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
              }`}
            >
              {tab.label}
              {tab.key === 'all' && ` (${risks.length})`}
              {tab.key === 'high' && ` (${risks.filter(r => r.severity === 'high').length})`}
              {tab.key === 'medium' && ` (${risks.filter(r => r.severity === 'medium').length})`}
              {tab.key === 'low' && ` (${risks.filter(r => r.severity === 'low').length})`}
            </button>
          ))}
        </div>
        {filteredRisks.length === 0 ? (
          <div className="flex items-center gap-2 py-6 justify-center text-green-600">
            <Shield size={20} />
            <span className="text-sm font-medium">暂无风险项</span>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRisks.map(risk => (
              <div key={risk.id} className={`risk-${risk.severity}`}>
                <div className="flex items-start gap-2">
                  {SEVERITY_ICON[risk.severity]}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-warm-800">{risk.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-warm-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {risk.step}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {risk.relatedType}/{risk.relatedId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-serif-title text-lg font-semibold text-forest-700 flex items-center gap-2 mb-4">
          <CalendarDays size={20} className="text-amber-500" />
          授权状态总览
        </h2>
        {validContracts.length === 0 ? (
          <p className="text-sm text-warm-500 py-4 text-center">暂无合同数据</p>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <div className="h-2 bg-warm-100 rounded-full relative">
                {todayPercent >= 0 && todayPercent <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-forest-600 z-10"
                    style={{ left: `${todayPercent}%` }}
                  >
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-forest-600 whitespace-nowrap font-medium">
                      今天
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-warm-400 mt-1">
                <span>{formatDate(new Date(minDate).toISOString().slice(0, 10))}</span>
                <span>{formatDate(new Date(maxDate).toISOString().slice(0, 10))}</span>
              </div>
            </div>
            {contracts.map(contract => {
              const pos = getBarPositions(contract)
              return (
                <div key={contract.id} className="flex items-center gap-3">
                  <div className="w-44 shrink-0 text-xs text-warm-700 truncate">
                    <span className="font-medium">{contract.contractNo}</span>
                    <br />
                    <span className="text-warm-500">{contract.licensor} → {contract.licensee}</span>
                  </div>
                  <div className="flex-1 h-6 bg-warm-50 rounded relative">
                    {pos ? (
                      <div
                        className={`absolute top-0.5 bottom-0.5 rounded ${STATUS_BAR_COLOR[contract.status] ?? 'bg-gray-300'} opacity-80`}
                        style={{ left: `${pos.left}%`, width: `${Math.max(pos.width, 0.5)}%` }}
                      />
                    ) : null}
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <span className={STATUS_BADGE[contract.status] ?? 'badge-pending'}>
                      {STATUS_LABEL[contract.status] ?? contract.status}
                    </span>
                  </div>
                  <div className="w-40 shrink-0 text-[11px] text-warm-500 text-right">
                    {contract.startDate && contract.endDate
                      ? `${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`
                      : '日期待定'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-serif-title text-lg font-semibold text-forest-700 flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-amber-500" />
          台账汇总
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200">
                <th className="text-left py-2 px-3 text-warm-600 font-medium">采样名称</th>
                <th className="text-left py-2 px-3 text-warm-600 font-medium">关联合同</th>
                <th className="text-left py-2 px-3 text-warm-600 font-medium">合同状态</th>
                <th className="text-left py-2 px-3 text-warm-600 font-medium">分成状态</th>
                <th className="text-left py-2 px-3 text-warm-600 font-medium">授权平台数</th>
                <th className="text-left py-2 px-3 text-warm-600 font-medium">风险项数</th>
              </tr>
            </thead>
            <tbody>
              {samples.map(sample => {
                const contract = contractMap[sample.contractId]
                const riskCount = getRiskCountForSample(sample.id)
                const platformCount = contract ? getPlatformCountForContract(contract.id) : 0
                return (
                  <tr key={sample.id} className="border-b border-warm-100 hover:bg-warm-50 transition-colors">
                    <td className="py-2 px-3 font-medium text-forest-700">{sample.title}</td>
                    <td className="py-2 px-3 text-warm-600">{contract?.contractNo ?? '-'}</td>
                    <td className="py-2 px-3">
                      {contract ? (
                        <span className={STATUS_BADGE[contract.status] ?? 'badge-pending'}>
                          {STATUS_LABEL[contract.status] ?? contract.status}
                        </span>
                      ) : (
                        <span className="badge-pending">未关联</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-warm-600">{getRoyaltyStatus(sample.id)}</td>
                    <td className="py-2 px-3 text-warm-600">{platformCount}</td>
                    <td className="py-2 px-3">
                      {riskCount > 0 ? (
                        <span className="badge-danger">{riskCount}</span>
                      ) : (
                        <span className="badge-active">0</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
