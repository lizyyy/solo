import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { RiskLevel, Report, ReportSnapshot } from '@/lib/api'
import { reportsApi } from '@/lib/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Search, FileDown, History, FileText, ChevronRight } from 'lucide-react'

const RISK_COLORS: Record<string, string> = {
  safe: '#22c55e',
  warning: '#eab308',
  margin_call: '#f97316',
  force_liquidation: '#ef4444',
}

function formatDate(t: string | null) {
  if (!t) return '--'
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 text-sm shadow-lg">
      <p className="text-text-secondary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono-num">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Reports() {
  const { list, current, filters, history, loading } = useAppStore(s => s.reports)
  const fetchReports = useAppStore(s => s.fetchReports)
  const fetchReport = useAppStore(s => s.fetchReport)
  const generateReport = useAppStore(s => s.generateReport)
  const setReportFilters = useAppStore(s => s.setReportFilters)
  const fetchReportHistory = useAppStore(s => s.fetchReportHistory)
  const showConfirmModal = useAppStore(s => s.showConfirmModal)

  const [showHistory, setShowHistory] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    fetchReports()
    fetchReportHistory()
  }, [fetchReports, fetchReportHistory, filters])

  const handleGenerate = () => {
    showConfirmModal('生成报告', '确认按当前筛选条件生成催缴报告？', async () => {
      await generateReport()
    })
  }

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (!current) return
    window.open(reportsApi.exportReport(current.id, format), '_blank')
    setExportOpen(false)
  }

  const chartData = current?.content?.content_json
    ? (() => {
        try { return JSON.parse(current.content.content_json) } catch { return null }
      })()
    : null

  const riskDistribution = chartData?.riskDistribution || [
    { level: 'safe', count: 45 },
    { level: 'warning', count: 12 },
    { level: 'margin_call', count: 8 },
    { level: 'force_liquidation', count: 3 },
  ]

  const notificationStats = chartData?.notificationStats || [
    { name: '已发送', count: 15 },
    { name: '已确认', count: 8 },
    { name: '已撤回', count: 2 },
    { name: '已结清', count: 5 },
  ]

  const matchRate = chartData?.matchRate || { matched: 18, unmatched: 7 }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={filters.start_date}
            onChange={e => setReportFilters({ start_date: e.target.value, page: 1 })}
            className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={e => setReportFilters({ end_date: e.target.value, page: 1 })}
            className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <select
            value={filters.risk_level}
            onChange={e => setReportFilters({ risk_level: e.target.value as RiskLevel | '', page: 1 })}
            className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">全部风险</option>
            <option value="safe">安全</option>
            <option value="warning">预警</option>
            <option value="margin_call">追保</option>
            <option value="force_liquidation">强平</option>
          </select>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <FileText size={14} /> 生成报告
          </button>
          <div className="ml-auto relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-card transition-colors"
            >
              <FileDown size={14} /> 导出
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-bg-card border border-border rounded-lg shadow-lg z-10">
                <button onClick={() => handleExport('csv')} className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary">CSV</button>
                <button onClick={() => handleExport('xlsx')} className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary">Excel</button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              showHistory ? 'bg-accent/15 text-accent' : 'border border-border text-text-secondary hover:bg-bg-card'
            }`}
          >
            <History size={14} /> 历史
          </button>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-4">
            <div className="bg-bg-card border border-border rounded-lg p-4">
              <h3 className="font-heading text-sm text-text-secondary mb-3">报告列表</h3>
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-4 text-text-secondary text-sm">加载中...</div>
                ) : list.length === 0 ? (
                  <div className="text-center py-4 text-text-secondary text-sm">暂无报告</div>
                ) : (
                  list.map(r => (
                    <div
                      key={r.id}
                      onClick={() => fetchReport(r.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        current?.id === r.id
                          ? 'border-accent/50 bg-accent/5'
                          : 'border-border hover:border-accent/30 hover:bg-bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-text-primary">{r.title}</span>
                        <ChevronRight size={14} className="text-text-secondary" />
                      </div>
                      <div className="text-xs text-text-secondary">{formatDate(r.generated_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            <div className="bg-bg-card border border-border rounded-lg p-4">
              <h3 className="font-heading text-sm text-text-secondary mb-3">客户风险分布</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    strokeWidth={0}
                  >
                    {riskDistribution.map((entry, i) => (
                      <Cell key={i} fill={RISK_COLORS[entry.level] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value: string) => {
                      const labels: Record<string, string> = { safe: '安全', warning: '预警', margin_call: '追保', force_liquidation: '强平' }
                      return <span className="text-text-secondary text-xs">{labels[value] || value}</span>
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-bg-card border border-border rounded-lg p-4">
              <h3 className="font-heading text-sm text-text-secondary mb-3">通知统计</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={notificationStats}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#e8883a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-bg-card border border-border rounded-lg p-4">
              <h3 className="font-heading text-sm text-text-secondary mb-3">入金匹配率</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '已匹配', value: matchRate.matched },
                        { name: '未匹配', value: matchRate.unmatched },
                      ]}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      strokeWidth={0}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#334155" />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-safe" />
                    <span className="text-sm text-text-secondary">已匹配</span>
                    <span className="font-mono-num text-sm text-text-primary">{matchRate.matched}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-border" />
                    <span className="text-sm text-text-secondary">未匹配</span>
                    <span className="font-mono-num text-sm text-text-primary">{matchRate.unmatched}</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-text-secondary">匹配率</span>
                    <span className="font-mono-num text-lg text-safe ml-2">
                      {matchRate.matched + matchRate.unmatched > 0
                        ? ((matchRate.matched / (matchRate.matched + matchRate.unmatched)) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="w-64 bg-bg-card border border-border rounded-lg p-4 shrink-0">
          <h3 className="font-heading font-semibold text-text-primary mb-3">历史快照</h3>
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-4 text-text-secondary text-sm">暂无历史</div>
            ) : (
              history.map(h => (
                <div
                  key={h.id}
                  onClick={() => {
                    fetchReport(h.report_id)
                  }}
                  className="p-2 rounded border border-border hover:border-accent/30 cursor-pointer transition-colors"
                >
                  <div className="text-xs text-text-secondary">{formatDate(h.snapshot_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
