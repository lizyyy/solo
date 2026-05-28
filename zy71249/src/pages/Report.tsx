import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { exportAsJson, exportAsCsv } from '@/utils/reportExport'
import { MATERIALS } from '@/data/gameConfig'
import {
  FileDown, FileSpreadsheet, AlertTriangle, TrendingDown,
  DollarSign, Package, BarChart3, ArrowLeft, Ship,
} from 'lucide-react'
import type { RiskType } from '@/types/game'

const BG = '#0D1B2A'
const CARD = '#1B2838'
const ACCENT = '#E85D04'
const TEXT = '#E0E1DD'
const BORDER = '#415A77'

const RISK_LABELS: Record<RiskType, { label: string; icon: React.ReactNode; color: string }> = {
  DISRUPTION: { label: '供应商断供', icon: <AlertTriangle size={20} />, color: '#EF4444' },
  BACKLOG: { label: '库存积压', icon: <Package size={20} />, color: '#F59E0B' },
  FX_LOSS: { label: '汇率亏损', icon: <DollarSign size={20} />, color: '#3B82F6' },
}

export default function Report() {
  const navigate = useNavigate()
  const { report, isFinished, cashTransactions, events } = useGameStore()

  if (!report || !isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG, color: TEXT }}>
        <div className="text-center">
          <p className="text-xl mb-4">暂无报告数据</p>
          <button onClick={() => navigate('/game')} className="px-6 py-3 rounded-lg font-bold text-white" style={{ background: ACCENT }}>
            返回游戏
          </button>
        </div>
      </div>
    )
  }

  const disruptionCount = report.riskRecords.filter(r => r.type === 'DISRUPTION').length
  const backlogAmount = report.riskRecords.filter(r => r.type === 'BACKLOG').reduce((s, r) => s + r.amount, 0)
  const fxLossAmount = report.riskRecords.filter(r => r.type === 'FX_LOSS').reduce((s, r) => s + r.amount, 0)

  const seenKeys = new Set<string>()
  const dedupedRisks = report.riskRecords.filter(r => {
    const key = `${r.materialId}-${r.type}-${r.round}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT }}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:opacity-80" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 size={24} style={{ color: ACCENT }} /> 经营报告
            </h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => exportAsJson(report)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: '#3B82F6' }}>
              <FileDown size={16} /> 导出JSON
            </button>
            <button onClick={() => exportAsCsv(report)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: '#10B981' }}>
              <FileSpreadsheet size={16} /> 导出CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: '总收入', value: report.totalRevenue, color: '#10B981' },
            { label: '总支出', value: report.totalExpense, color: '#EF4444' },
            { label: '汇率亏损', value: report.totalFxLoss, color: '#3B82F6' },
            { label: '违约罚金', value: report.totalPenalty, color: '#F59E0B' },
            { label: '净利润', value: report.netProfit, color: report.netProfit >= 0 ? '#10B981' : '#EF4444' },
          ].map(m => (
            <div key={m.label} className="rounded-lg p-4 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="text-xs opacity-60 mb-1">{m.label}</p>
              <p className="text-xl font-bold" style={{ color: m.color }}>¥{m.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: '断供次数', value: disruptionCount, cfg: RISK_LABELS.DISRUPTION },
            { label: '积压金额', value: `¥${backlogAmount.toLocaleString()}`, cfg: RISK_LABELS.BACKLOG },
            { label: '汇率亏损', value: `¥${fxLossAmount.toLocaleString()}`, cfg: RISK_LABELS.FX_LOSS },
          ].map(m => (
            <div key={m.label} className="rounded-lg p-5 flex items-center gap-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: `${m.cfg.color}22`, color: m.cfg.color }}>
                {m.cfg.icon}
              </div>
              <div>
                <p className="text-xs opacity-60">{m.label}</p>
                <p className="text-xl font-bold" style={{ color: m.cfg.color }}>{m.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingDown size={18} style={{ color: ACCENT }} /> 回合利润走势</h3>
            <div className="space-y-2">
              {report.roundSummaries.map(rs => (
                <div key={rs.round} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-xs opacity-60 shrink-0">回合{rs.round}</span>
                  <div className="flex-1 h-6 rounded" style={{ background: BG }}>
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${Math.min(Math.abs(rs.profit) / Math.max(report.totalRevenue || 1, 1) * 100, 100)}%`,
                        background: rs.profit >= 0 ? '#10B981' : '#EF4444',
                        minWidth: rs.profit !== 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs font-mono" style={{ color: rs.profit >= 0 ? '#10B981' : '#EF4444' }}>
                    {rs.profit >= 0 ? '+' : ''}¥{rs.profit.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold mb-4 flex items-center gap-2"><Ship size={18} style={{ color: ACCENT }} /> 事件统计</h3>
            <div className="space-y-3">
              {report.roundSummaries.filter(rs => rs.eventCount > 0).map(rs => (
                <div key={rs.round} className="flex items-center justify-between text-sm p-2 rounded" style={{ background: BG }}>
                  <span className="text-xs opacity-60">回合{rs.round}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span style={{ color: '#3B82F6' }}>港口{events.filter(e => e.round === rs.round && e.type === 'PORT_CONGESTION').length}</span>
                    <span style={{ color: '#10B981' }}>汇率{events.filter(e => e.round === rs.round && e.type === 'EXCHANGE_RATE').length}</span>
                    <span style={{ color: '#EF4444' }}>断供{events.filter(e => e.round === rs.round && e.type === 'SUPPLIER_DISRUPTION').length}</span>
                  </div>
                </div>
              ))}
              {report.roundSummaries.filter(rs => rs.eventCount > 0).length === 0 && (
                <p className="text-xs opacity-50">无事件记录</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><AlertTriangle size={18} style={{ color: ACCENT }} /> 风险事件明细（去重）</h3>
            <span className="text-xs opacity-50">共{dedupedRisks.length}条 · 涉及{report.materialIds.length}种物料</span>
          </div>
          {dedupedRisks.length === 0 ? (
            <p className="text-sm opacity-50">无风险记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs opacity-50 border-b" style={{ borderColor: BORDER }}>
                    <th className="pb-2 pr-4">回合</th>
                    <th className="pb-2 pr-4">风险类型</th>
                    <th className="pb-2 pr-4">物料编号</th>
                    <th className="pb-2 pr-4">物料名称</th>
                    <th className="pb-2 pr-4">影响金额</th>
                    <th className="pb-2">描述</th>
                  </tr>
                </thead>
                <tbody>
                  {dedupedRisks.map(r => {
                    const mat = MATERIALS.find(m => m.id === r.materialId)
                    const cfg = RISK_LABELS[r.type]
                    return (
                      <tr key={r.id} className="border-b" style={{ borderColor: `${BORDER}44` }}>
                        <td className="py-2 pr-4 font-mono text-xs">{r.round}</td>
                        <td className="py-2 pr-4">
                          <span className="flex items-center gap-1 text-xs" style={{ color: cfg.color }}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs" style={{ color: ACCENT }}>{r.materialId}</td>
                        <td className="py-2 pr-4 text-xs">{mat?.name || r.materialId}</td>
                        <td className="py-2 pr-4 font-mono text-xs" style={{ color: '#EF4444' }}>¥{r.amount.toLocaleString()}</td>
                        <td className="py-2 text-xs opacity-70 max-w-xs truncate">{r.description}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold mb-4">现金流水</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs opacity-50 border-b" style={{ borderColor: BORDER }}>
                  <th className="pb-2 pr-4">回合</th>
                  <th className="pb-2 pr-4">类型</th>
                  <th className="pb-2 pr-4">金额</th>
                  <th className="pb-2">描述</th>
                </tr>
              </thead>
              <tbody>
                {cashTransactions.map(t => {
                  const typeLabels: Record<string, string> = { INCOME: '收入', EXPENSE: '支出', FX_LOSS: '汇兑损失', PENALTY: '违约罚金' }
                  const typeColors: Record<string, string> = { INCOME: '#10B981', EXPENSE: '#EF4444', FX_LOSS: '#3B82F6', PENALTY: '#F59E0B' }
                  return (
                    <tr key={t.id} className="border-b" style={{ borderColor: `${BORDER}44` }}>
                      <td className="py-2 pr-4 font-mono text-xs">{t.round}</td>
                      <td className="py-2 pr-4 text-xs" style={{ color: typeColors[t.type] }}>{typeLabels[t.type]}</td>
                      <td className="py-2 pr-4 font-mono text-xs" style={{ color: typeColors[t.type] }}>
                        {t.type === 'INCOME' ? '+' : '-'}¥{t.amount.toLocaleString()}
                      </td>
                      <td className="py-2 text-xs opacity-70">{t.description}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-center gap-4 pt-4 pb-8">
          <button onClick={() => navigate('/')} className="px-6 py-3 rounded-lg font-bold text-white" style={{ background: ACCENT }}>
            返回首页
          </button>
          <button onClick={() => navigate('/replay')} className="px-6 py-3 rounded-lg font-bold" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            查看回放
          </button>
        </div>
      </div>
    </div>
  )
}
