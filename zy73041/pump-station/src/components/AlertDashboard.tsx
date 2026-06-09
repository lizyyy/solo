import React, { useState, useMemo } from 'react'
import { useAppStore } from '../store/AppStore'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ScatterChart, Scatter, Cell, ZAxis,
  BarChart, Bar,
} from 'recharts'
import type { MetricValue, Inspection, AlertPoint } from '../types'
import { METRIC_LABELS, DEFAULT_THRESHOLD, METRIC_UNITS, THRESHOLD_VERSION, CALC_FORMULA_NOTES } from '../data/thresholds'
import clsx from 'clsx'
import { AlertTriangle, ShieldCheck, PauseCircle, Clock, ChevronRight, TrendingUp, Link as LinkIcon, FileText } from 'lucide-react'
import { StatusBadge, formatDateTime } from './StatusBadge'

const COLORS: Record<keyof MetricValue, string> = {
  vibration: '#ef4444',
  temperature: '#f59e0b',
  pressure: '#3b82f6',
  flowRate: '#10b981',
  current: '#8b5cf6',
}

export const AlertDashboard: React.FC = () => {
  const { inspections, setSelectedInspectionId, setHighlightAlertMetric, changes, notes } = useAppStore()
  const [selectedMetric, setSelectedMetric] = useState<keyof MetricValue | 'all'>('all')
  const [showFormula, setShowFormula] = useState(false)

  const metricKeys: (keyof MetricValue)[] = ['vibration', 'temperature', 'pressure', 'flowRate', 'current']

  const sorted = useMemo(
    () => [...inspections].sort((a, b) => a.createTime.localeCompare(b.createTime)),
    [inspections]
  )

  const chartData = useMemo(() => {
    return sorted.map((i) => ({
      id: i.id,
      name: `${i.inspectionDate.slice(5)} ${i.shift === 'morning' ? '早' : i.shift === 'afternoon' ? '中' : '夜'}`,
      fullLabel: `${i.pumpName} ${i.inspectionDate} ${i.inspector}`,
      status: i.status,
      source: i.source,
      alertsCount: i.alerts.length,
      criticalCount: i.alerts.filter((a) => a.level === 'critical').length,
      warningCount: i.alerts.filter((a) => a.level === 'warning').length,
      ...i.metrics,
      raw: i,
    }))
  }, [sorted])

  const summary = useMemo(() => {
    const allAlerts = sorted.flatMap((i) => i.alerts.map((a) => ({ ...a, insp: i })))
    const critical = allAlerts.filter((a) => a.level === 'critical')
    const warning = allAlerts.filter((a) => a.level === 'warning')
    const lastChange = [...changes].sort((a, b) => b.changeTime.localeCompare(a.changeTime))[0]
    const lastNote = [...notes].sort((a, b) => b.createTime.localeCompare(a.createTime))[0]
    return {
      total: sorted.length,
      normal: sorted.filter((i) => i.status === 'normal').length,
      warning: sorted.filter((i) => i.status === 'warning').length,
      critical: sorted.filter((i) => i.status === 'critical').length,
      pending: sorted.filter((i) => i.status === 'pending_confirm').length,
      criticalCount: critical.length,
      warningCount: warning.length,
      lastChange,
      lastNote,
      topAlerts: allAlerts.sort((a, b) => (b.level === 'critical' ? 1 : 0) - (a.level === 'critical' ? 1 : 0)).slice(0, 8),
    }
  }, [sorted, changes, notes])

  const handleClickPoint = (id: string, metric?: keyof MetricValue) => {
    setSelectedInspectionId(id)
    if (metric) setHighlightAlertMetric(metric)
    setTimeout(() => setHighlightAlertMetric(null), 4000)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    const d = payload[0].payload as any
    const insp: Inspection = d.raw
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[240px] text-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-slate-800">{insp.pumpName}</div>
          <StatusBadge status={insp.status} />
        </div>
        <div className="text-[11px] text-slate-500 space-y-0.5 mb-2">
          <div>编号：<span className="font-mono text-slate-700">{insp.id}</span></div>
          <div>时间：{formatDateTime(insp.createTime)} · {insp.inspector}</div>
          <div>来源：{insp.source === 'routine' ? '常规' : insp.source === 'supplement' ? '补录' : '重跑'}</div>
        </div>
        <div className="border-t border-slate-100 pt-2 space-y-0.5">
          {metricKeys.map((k) => {
            const alert = insp.alerts.find((a) => a.metric === k)
            return (
              <div key={k} className={clsx('flex items-center justify-between', {
                'text-red-600 font-medium': alert?.level === 'critical',
                'text-amber-600': alert?.level === 'warning',
                'text-slate-600': !alert,
              })}>
                <span>{METRIC_LABELS[k].split(' ')[0]}</span>
                <span className="tabular-nums">{insp.metrics[k]} {METRIC_UNITS[k]}
                  {alert && <span className="ml-1">({alert.level === 'critical' ? '超限' : '预警'})</span>}
                </span>
              </div>
            )
          })}
        </div>
        <button
          onClick={() => handleClickPoint(insp.id)}
          className="mt-2 w-full text-center py-1 rounded bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center justify-center gap-1"
        >
          <ChevronRight className="w-3 h-3" /> 打开巡检表 · 查看计算口径
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">泵站巡检阈值预警</h2>
              <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                口径版本 {THRESHOLD_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              点击图表上的异常点，可直达巡检表对应字段并高亮判定公式。
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {(['all', ...metricKeys] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setSelectedMetric(k)}
                  className={clsx('px-2.5 py-1 text-xs rounded transition',
                    selectedMetric === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {k === 'all' ? '全部指标' : <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[k] }} />
                    {METRIC_LABELS[k].split(' ')[0]}
                  </span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFormula((s) => !s)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600">
              <FileText className="w-3 h-3" />{showFormula ? '隐藏' : '查看'}计算口径
            </button>
          </div>
        </div>
      </div>

      {showFormula && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <pre className="text-[11px] leading-relaxed text-slate-500 whitespace-pre-wrap">
{CALC_FORMULA_NOTES.trim()}
          </pre>
        </div>
      )}

      <div className="flex-1 overflow-auto scroll-thin p-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: '巡检总数', value: summary.total, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: '正常', value: summary.normal, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '预警', value: summary.warning, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '超限', value: summary.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: '待主管确认', value: summary.pending, icon: PauseCircle, color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map((s, i) => (
            <div key={i} className={clsx('rounded-lg border border-slate-200 p-3 bg-white')}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">{s.label}</span>
                <s.icon className={clsx('w-3.5 h-3.5', s.color)} />
              </div>
              <div className={clsx('text-2xl font-semibold tabular-nums', s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {(summary.lastChange || summary.lastNote) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.lastChange && (
              <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs text-brand-700 font-medium mb-1">
                  <Clock className="w-3 h-3" /> 最近修改（交接必看）
                </div>
                <p className="text-xs text-slate-700">
                  <b>{summary.lastChange.operator}</b>（{summary.lastChange.operatorRole}）在 {formatDateTime(summary.lastChange.changeTime)}
                  修改了 <code className="bg-white px-1 rounded text-[11px]">{summary.lastChange.field}</code>：
                  <span className="line-through text-red-500/70 mx-1">{summary.lastChange.oldValue}</span>→
                  <span className="text-emerald-700 font-medium mx-1">{summary.lastChange.newValue}</span>
                </p>
                {summary.lastChange.reason && <p className="text-[11px] text-slate-500 mt-1">原因：{summary.lastChange.reason}</p>}
              </div>
            )}
            {summary.lastNote && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs text-violet-700 font-medium mb-1">
                  <FileText className="w-3 h-3" /> 最近备注
                </div>
                <p className="text-xs text-slate-700 line-clamp-2">{summary.lastNote.content}</p>
                <p className="text-[11px] text-slate-500 mt-1">— {summary.lastNote.author}（{summary.lastNote.authorRole}）@{formatDateTime(summary.lastNote.createTime)}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              指标趋势（点击数据点 → 打开巡检表 + 对应字段 + 计算口径）
            </h3>
            <span className="text-[11px] text-slate-400">按时间顺序 · {chartData.length} 条</span>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {(selectedMetric === 'all' || selectedMetric === 'vibration') && (
                  <Line type="monotone" dataKey="vibration" name={METRIC_LABELS.vibration.split(' ')[0]}
                    stroke={COLORS.vibration} strokeWidth={2} dot={{ r: 4, fill: COLORS.vibration, cursor: 'pointer' }}
                    activeDot={{ r: 7, cursor: 'pointer' }}
                    onClick={(d: any) => handleClickPoint(d.activePayload?.[0]?.payload?.id, 'vibration')} />
                )}
                {(selectedMetric === 'all' || selectedMetric === 'temperature') && (
                  <Line type="monotone" dataKey="temperature" name={METRIC_LABELS.temperature.split(' ')[0]}
                    stroke={COLORS.temperature} strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }}
                    activeDot={{ r: 7, cursor: 'pointer' }}
                    onClick={(d: any) => handleClickPoint(d.activePayload?.[0]?.payload?.id, 'temperature')} />
                )}
                {(selectedMetric === 'all' || selectedMetric === 'pressure') && (
                  <Line type="monotone" dataKey="pressure" name={METRIC_LABELS.pressure.split(' ')[0]}
                    stroke={COLORS.pressure} strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }}
                    activeDot={{ r: 7, cursor: 'pointer' }}
                    onClick={(d: any) => handleClickPoint(d.activePayload?.[0]?.payload?.id, 'pressure')} />
                )}
                {(selectedMetric === 'all' || selectedMetric === 'flowRate') && (
                  <Line type="monotone" dataKey="flowRate" name={METRIC_LABELS.flowRate.split(' ')[0]}
                    stroke={COLORS.flowRate} strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }}
                    activeDot={{ r: 7, cursor: 'pointer' }}
                    onClick={(d: any) => handleClickPoint(d.activePayload?.[0]?.payload?.id, 'flowRate')} />
                )}
                {(selectedMetric === 'all' || selectedMetric === 'current') && (
                  <Line type="monotone" dataKey="current" name={METRIC_LABELS.current.split(' ')[0]}
                    stroke={COLORS.current} strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }}
                    activeDot={{ r: 7, cursor: 'pointer' }}
                    onClick={(d: any) => handleClickPoint(d.activePayload?.[0]?.payload?.id, 'current')} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                预警/超限计数（按次巡检）
              </h3>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
                    cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="warningCount" name="预警项" stackId="a" fill="#f59e0b" cursor="pointer"
                    onClick={(d: any) => handleClickPoint(d.id)} />
                  <Bar dataKey="criticalCount" name="超限项" stackId="a" fill="#dc2626" cursor="pointer"
                    onClick={(d: any) => handleClickPoint(d.id)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                异常点速查（点击直达巡检表并高亮字段）
              </h3>
              <span className="text-[11px] text-slate-400">{summary.topAlerts.length} 项</span>
            </div>
            {summary.topAlerts.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                <ShieldCheck className="w-6 h-6 mr-2 text-emerald-400" />
                暂无异常
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-auto scroll-thin pr-1">
                {summary.topAlerts.map((a, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleClickPoint(a.insp.id, a.metric)}
                    className={clsx('w-full text-left rounded-lg border p-2.5 transition hover:shadow-sm',
                      a.level === 'critical'
                        ? 'border-red-200 bg-red-50/60 hover:bg-red-50'
                        : 'border-amber-200 bg-amber-50/60 hover:bg-amber-50')}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={clsx('w-2 h-2 rounded-full shrink-0',
                          a.level === 'critical' ? 'bg-red-500' : 'bg-amber-500')} />
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {a.insp.pumpName}
                        </span>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {a.insp.inspectionDate}
                        </span>
                      </div>
                      <LinkIcon className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5 text-xs">
                      <span className="font-mono" style={{ color: COLORS[a.metric] }}>
                        {METRIC_LABELS[a.metric].split(' ')[0]}
                      </span>
                      <span className={clsx('tabular-nums font-semibold',
                        a.level === 'critical' ? 'text-red-700' : 'text-amber-700')}>
                        {a.value}
                      </span>
                      <span className="text-slate-400">{METRIC_UNITS[a.metric]}</span>
                      <span className="text-[11px] text-slate-500 ml-auto truncate">
                        阈值 [{a.thresholdMin} ~ {a.thresholdMax}]
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 bg-white/60 border border-slate-100 rounded px-2 py-0.5 line-clamp-1">
                      判定：{a.formula}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
