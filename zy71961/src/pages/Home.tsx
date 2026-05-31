import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Calendar,
  AlertTriangle,
  Shield,
  Activity,
  ChevronRight,
  Eye,
  FileText,
  BarChart3,
  Filter,
  Zap,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Report, Severity } from '@/types'

const severityConfig: Record<Severity, { label: string; color: string }> = {
  low: { label: '低', color: '#10B981' },
  medium: { label: '中', color: '#F59E0B' },
  high: { label: '高', color: '#F97316' },
  critical: { label: '严重', color: '#EF4444' },
}

const severityScore: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

function DriftTrendChart({ reports }: { reports: Report[] }) {
  const chartData = useMemo(() => {
    const grouped = new Map<string, { date: string; totalScore: number; count: number }>()

    const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date))

    for (const report of sorted) {
      const existing = grouped.get(report.date)
      const score = severityScore[report.severity]
      if (existing) {
        existing.totalScore += score
        existing.count += 1
      } else {
        grouped.set(report.date, { date: report.date, totalScore: score, count: 1 })
      }
    }

    return Array.from(grouped.values()).map((d) => ({
      date: d.date,
      value: d.totalScore / d.count,
    }))
  }, [reports])

  if (chartData.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        暂无趋势数据
      </div>
    )
  }

  const W = 720
  const H = 240
  const pad = { top: 24, right: 24, bottom: 44, left: 50 }
  const cW = W - pad.left - pad.right
  const cH = H - pad.top - pad.bottom
  const maxVal = 4

  const points = chartData.map((d, i) => ({
    x: pad.left + (chartData.length > 1 ? (i / (chartData.length - 1)) * cW : cW / 2),
    y: pad.top + cH - (d.value / maxVal) * cH,
    ...d,
  }))

  const smoothLine = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      const prev = points[i - 1]
      const cpx = ((prev.x + p.x) / 2).toFixed(1)
      return `C ${cpx} ${prev.y.toFixed(1)} ${cpx} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    })
    .join(' ')

  const smoothArea =
    smoothLine +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + cH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(pad.top + cH).toFixed(1)} Z`

  const gridLevels = [
    { v: 0, label: '0' },
    { v: 1, label: '低' },
    { v: 2, label: '中' },
    { v: 3, label: '高' },
    { v: 4, label: '严重' },
  ]

  const fmtDate = (s: string) => {
    const p = s.split('-')
    return p.length >= 3 ? `${p[1]}/${p[2]}` : s
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="driftAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35" />
          <stop offset="80%" stopColor="#F59E0B" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
        <filter id="lineGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {gridLevels.map((g) => {
        const y = pad.top + cH - (g.v / maxVal) * cH
        return (
          <g key={g.v}>
            <line
              x1={pad.left}
              y1={y}
              x2={W - pad.right}
              y2={y}
              stroke="#334155"
              strokeDasharray="3 3"
              strokeWidth="0.5"
            />
            <text x={pad.left - 10} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10">
              {g.label}
            </text>
          </g>
        )
      })}

      <path d={smoothArea} fill="url(#driftAreaGrad)" />
      <path d={smoothLine} fill="none" stroke="#F59E0B" strokeWidth="2.5" filter="url(#lineGlow)" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
          <circle cx={p.x} cy={p.y} r="2" fill="#F59E0B" />
          <text x={p.x} y={H - 10} textAnchor="middle" fill="#64748B" fontSize="10">
            {fmtDate(p.date)}
          </text>
          <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#94A3B8" fontSize="9">
            {p.value.toFixed(1)}
          </text>
        </g>
      ))}
    </svg>
  )
}

const pulseKeyframes = `@keyframes severity-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}`

export default function Home() {
  const navigate = useNavigate()
  const { models, reports, loadModels, loadReports, loading } = useAppStore()

  const [search, setSearch] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadReports({
        modelId: modelFilter || undefined,
        severity: severityFilter || undefined,
        date: dateFilter || undefined,
        search: search || undefined,
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [modelFilter, severityFilter, dateFilter, search])

  const severityCounts = useMemo(
    () => ({
      low: reports.filter((r) => r.severity === 'low').length,
      medium: reports.filter((r) => r.severity === 'medium').length,
      high: reports.filter((r) => r.severity === 'high').length,
      critical: reports.filter((r) => r.severity === 'critical').length,
    }),
    [reports],
  )

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const summaryCards: {
    key: Severity
    icon: typeof Shield
    label: string
    count: number
    color: string
    glow: string
  }[] = [
    { key: 'low', icon: Shield, label: '低风险', count: severityCounts.low, color: '#10B981', glow: 'rgba(16,185,129,0.15)' },
    { key: 'medium', icon: AlertTriangle, label: '中风险', count: severityCounts.medium, color: '#F59E0B', glow: 'rgba(245,158,11,0.15)' },
    { key: 'high', icon: Activity, label: '高风险', count: severityCounts.high, color: '#F97316', glow: 'rgba(249,115,22,0.15)' },
    { key: 'critical', icon: Zap, label: '严重', count: severityCounts.critical, color: '#EF4444', glow: 'rgba(239,68,68,0.15)' },
  ]

  return (
    <div className="space-y-6" style={{ animation: 'fade-in 0.4s ease-out' }}>
      <style>{pulseKeyframes}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            日报总览
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {today}
          </p>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="搜索模型或报告..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-72 rounded-lg border pl-9 pr-4 text-sm outline-none transition-all duration-200 focus:border-[var(--accent-amber)] focus:shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="h-8 rounded-md border px-3 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">全部模型</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 rounded-md border px-3 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">全部严重程度</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="critical">严重</option>
        </select>
        <div className="relative">
          <Calendar
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-8 rounded-md border pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        {(modelFilter || severityFilter || dateFilter) && (
          <button
            onClick={() => {
              setModelFilter('')
              setSeverityFilter('')
              setDateFilter('')
            }}
            className="h-8 rounded-md px-3 text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{ color: 'var(--accent-amber)' }}
          >
            重置筛选
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className="group relative overflow-hidden rounded-lg p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: `1px solid var(--bg-tertiary)`,
              borderLeft: `3px solid ${card.color}`,
            }}
          >
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: `radial-gradient(ellipse at bottom left, ${card.glow}, transparent 70%)` }}
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {card.label}
                </span>
                <card.icon className="h-4 w-4" style={{ color: card.color }} />
              </div>
              <div className="mt-3 text-3xl font-bold tracking-tight" style={{ color: card.color }}>
                {card.count}
              </div>
              {card.key === 'critical' && card.count > 0 && (
                <div
                  className="mt-2 h-1 w-8 rounded-full"
                  style={{ backgroundColor: card.color, animation: 'severity-pulse 2s ease-in-out infinite' }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg border p-5"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-tertiary)' }}
      >
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" style={{ color: 'var(--accent-amber)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            漂移趋势
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            按日期聚合 · 平均严重度评分
          </span>
        </div>
        <DriftTrendChart reports={reports} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            报告列表
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>共 {reports.length} 条</span>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="flex items-center gap-2">
              <div
                className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'var(--bg-tertiary)', borderTopColor: 'var(--accent-amber)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                加载中...
              </span>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div
            className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-tertiary)' }}
          >
            <FileText className="h-8 w-8" style={{ color: 'var(--bg-tertiary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              暂无报告数据
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => {
              const cfg = severityConfig[report.severity]
              return (
                <div
                  key={report.id}
                  className="group flex cursor-pointer items-center justify-between rounded-lg transition-all duration-200 hover:-translate-y-px hover:shadow-md"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: `1px solid var(--bg-tertiary)`,
                    borderLeft: `4px solid ${cfg.color}`,
                  }}
                  onClick={() => navigate(`/report/${report.id}`)}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${cfg.color}15` }}
                    >
                      <FileText className="h-4 w-4" style={{ color: cfg.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {report.model_name || report.model_id}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            `severity-${report.severity}`,
                          )}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {report.date}
                        </span>
                        <span style={{ color: 'var(--bg-tertiary)' }}>·</span>
                        <span>{report.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 pr-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                      style={{ color: 'var(--text-secondary)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/report/${report.id}`)
                      }}
                    >
                      <Eye className="h-3 w-3" />
                      查看
                    </button>
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
