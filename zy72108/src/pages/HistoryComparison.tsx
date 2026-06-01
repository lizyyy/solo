import { useState, Fragment } from 'react'
import { GitCompare, Download, Clock, User } from 'lucide-react'
import { useReviewStore } from '@/store'
import { getPrimaryMeasurements, getEnvironment } from '@/utils/reviewEngine'
import { exportComparisonReport } from '@/utils/exporter'
import type { StringName, Batch } from '@/types'

const STATUS_MAP: Record<Batch['status'], { label: string; cls: string }> = {
  pending: { label: '待复核', cls: 'status-pending' },
  reviewing: { label: '复核中', cls: 'status-reviewing' },
  passed: { label: '已通过', cls: 'status-passed' },
  anomaly: { label: '异常', cls: 'status-anomaly' },
}

const STRING_ORDER: StringName[] = ['E弦', 'A弦', 'D弦', 'G弦']

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function HistoryComparison() {
  const { batches, getBatchById, getThresholdById } = useReviewStore()
  const [batchAId, setBatchAId] = useState('')
  const [batchBId, setBatchBId] = useState('')

  const batchA = batchAId ? getBatchById(batchAId) : undefined
  const batchB = batchBId ? getBatchById(batchBId) : undefined
  const bothSelected = !!(batchA && batchB)

  const measA = batchA ? getPrimaryMeasurements(batchA) : []
  const measB = batchB ? getPrimaryMeasurements(batchB) : []
  const envA = batchA ? getEnvironment(batchA) : null
  const envB = batchB ? getEnvironment(batchB) : null

  const thVerA = batchA?.auditLogs.find((l) => l.thresholdVersionId)?.thresholdVersionId
  const thVerB = batchB?.auditLogs.find((l) => l.thresholdVersionId)?.thresholdVersionId
  const thresholdA = thVerA ? getThresholdById(thVerA) : undefined
  const thresholdB = thVerB ? getThresholdById(thVerB) : undefined

  const mergedLogs = bothSelected
    ? [...batchA.auditLogs.map((l) => ({ ...l, _side: 'A' as const })), ...batchB.auditLogs.map((l) => ({ ...l, _side: 'B' as const }))]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <GitCompare className="w-5 h-5 text-brand" />
        <h2 className="text-lg font-semibold text-gray-100">历史对比</h2>
      </div>

      <div className="card p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">批次 A</label>
            <select className="input-field w-full" value={batchAId} onChange={(e) => setBatchAId(e.target.value)}>
              <option value="">选择批次</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">批次 B</label>
            <select className="input-field w-full" value={batchBId} onChange={(e) => setBatchBId(e.target.value)}>
              <option value="">选择批次</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {bothSelected && (
            <button className="btn-primary flex items-center gap-2" onClick={() => exportComparisonReport(batchA, batchB)}>
              <Download className="w-4 h-4" />导出报告
            </button>
          )}
        </div>

        {(batchA || batchB) && (
          <div className="flex gap-4 mt-3">
            {[batchA, batchB].map((b) => b && (
              <div key={b.id} className="flex-1 text-xs text-gray-400">
                <span className="text-gray-200 font-medium">{b.name}</span>
                <span className="mx-2">·</span>{formatTime(b.createdAt)}
                <span className={`ml-2 ${STATUS_MAP[b.status].cls}`}>{STATUS_MAP[b.status].label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {bothSelected && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-gray-400 text-xs">
                <th className="px-3 py-2 text-left">弦别</th>
                <th className="px-3 py-2 text-right" colSpan={4}>批次 A</th>
                <th className="px-3 py-2 text-right" colSpan={4}>批次 B</th>
              </tr>
              <tr className="border-b border-surface-border text-gray-500 text-xs">
                <th />
                <th className="px-3 py-1.5 text-right">标准</th>
                <th className="px-3 py-1.5 text-right">实测</th>
                <th className="px-3 py-1.5 text-right">偏差(%)</th>
                <th className="px-3 py-1.5 text-right">状态</th>
                <th className="px-3 py-1.5 text-right">标准</th>
                <th className="px-3 py-1.5 text-right">实测</th>
                <th className="px-3 py-1.5 text-right">偏差(%)</th>
                <th className="px-3 py-1.5 text-right">状态</th>
              </tr>
            </thead>
            <tbody>
              {STRING_ORDER.map((sn) => {
                const mA = measA.find((m) => m.stringName === sn)
                const mB = measB.find((m) => m.stringName === sn)
                const diff = mA && mB && mA.deviationRate !== mB.deviationRate
                return (
                  <tr key={sn} className={`border-b border-surface-border/50 ${diff ? 'bg-brand/5' : ''}`}>
                    <td className="px-3 py-2 text-gray-300 font-medium">{sn}</td>
                    {[mA, mB].map((m, i) => (
                      <Fragment key={i}>
                        <td className="px-3 py-2 text-right font-mono text-gray-300">{m?.standardTension ?? '-'}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-300">{m?.measuredTension ?? '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${m?.isAnomaly ? 'text-data-anomaly' : 'text-data-normal'}`}>
                          {m ? `${m.deviationRate > 0 ? '+' : ''}${m.deviationRate}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {m ? <span className={m.isAnomaly ? 'text-data-anomaly' : 'text-data-normal'}>{m.isAnomaly ? '异常' : '正常'}</span> : '-'}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {envA && envB && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">环境工况对比</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-gray-500 text-xs">{' '}</div>
            <div className="text-center text-xs text-brand-light">批次 A</div>
            <div className="text-center text-xs text-data-info">批次 B</div>
            {(['temperature', 'humidity', 'note'] as const).map((key) => {
              const labels = { temperature: '温度', humidity: '湿度', note: '备注' }
              const units = { temperature: '°C', humidity: '%', note: '' }
              const vA = envA[key], vB = envB[key]
              const diff = vA !== vB
              return (
                <Fragment key={key}>
                  <div className="text-gray-400">{labels[key]}</div>
                  <div className={`text-center font-mono ${diff ? 'text-data-warning' : 'text-gray-300'}`}>{vA}{units[key]}</div>
                  <div className={`text-center font-mono ${diff ? 'text-data-warning' : 'text-gray-300'}`}>{vB}{units[key]}</div>
                </Fragment>
              )
            })}
          </div>
        </div>
      )}

      {(thresholdA || thresholdB) && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">阈值版本对比</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[{ t: thresholdA, label: '批次 A' }, { t: thresholdB, label: '批次 B' }].map(({ t, label }) => t && (
              <div key={label} className="bg-surface rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">{label} · <span className="text-brand-light font-mono">{t.version}</span></div>
                <div className="space-y-1">
                  {STRING_ORDER.map((sn) => (
                    <div key={sn} className="flex justify-between text-xs">
                      <span className="text-gray-500">{sn}</span>
                      <span className="font-mono text-gray-300">±{t.thresholds[sn]}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-gray-500">生效: {formatTime(t.effectiveAt)} · 变更: {t.changeReason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mergedLogs.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">审计时间线</h3>
          <div className="space-y-0">
            {mergedLogs.map((log) => {
              const borderCls = log._side === 'A' ? 'border-l-brand-light' : 'border-l-data-info'
              const batchName = log._side === 'A' ? batchA.name : batchB.name
              return (
                <div key={log.id} className={`border-l-2 ${borderCls} pl-4 py-2.5`}>
                  <div className="flex items-center gap-3 text-xs">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="font-mono text-gray-500">{formatTime(log.timestamp)}</span>
                    <span className={`font-medium ${log._side === 'A' ? 'text-brand-light' : 'text-data-info'}`}>{batchName}</span>
                    <span className="text-gray-300">{log.action}</span>
                    <User className="w-3 h-3 text-gray-500 ml-auto" />
                    <span className="text-gray-400">{log.actor}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 ml-6">
                    阈值版本: <span className="font-mono">{log.thresholdVersion}</span>
                    {log.reason && <> · {log.reason}</>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

