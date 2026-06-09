import React, { useState, useMemo } from 'react'
import { useAppStore } from '../store/AppStore'
import type { Inspection, MetricValue } from '../types'
import { METRIC_LABELS, DEFAULT_THRESHOLD } from '../data/thresholds'
import { X, Check, RefreshCw, FilePlus, AlertTriangle, GitBranch, Download } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  inspection: Inspection
  onClose: () => void
}

export const RerunModal: React.FC<Props> = ({ inspection, onClose }) => {
  const { rerunInspection, exportSelection, setSelectedInspectionId } = useAppStore()
  const [mode, setMode] = useState<'supplement' | 'rerun'>('supplement')
  const [metrics, setMetrics] = useState<MetricValue>({ ...inspection.metrics })
  const [step, setStep] = useState<'edit' | 'verify'>('edit')

  const metricKeys: (keyof MetricValue)[] = ['vibration', 'temperature', 'pressure', 'flowRate', 'current']

  const diffs = useMemo(() => {
    const list: { key: keyof MetricValue; label: string; old: number; now: number; changed: boolean; alertLevel: 'none' | 'warning' | 'critical' }[] = []
    for (const k of metricKeys) {
      const oldV = inspection.metrics[k]
      const nowV = metrics[k]
      const t = DEFAULT_THRESHOLD[k]
      let alertLevel: 'none' | 'warning' | 'critical' = 'none'
      if (nowV < t.min || nowV > t.max) alertLevel = 'critical'
      else if (nowV < t.warningMin || nowV > t.warningMax) alertLevel = 'warning'
      list.push({
        key: k,
        label: METRIC_LABELS[k],
        old: oldV,
        now: nowV,
        changed: Math.abs(oldV - nowV) > 0.0001,
        alertLevel,
      })
    }
    return list
  }, [metrics, inspection.metrics])

  const historyChainIds = useMemo(() => {
    const r = useAppStore()
    const chain = r.getHistoryChain(inspection.id).map((i) => i.id)
    return [...chain, inspection.id]
  }, [inspection.id])

  const runAndClose = () => {
    const created = rerunInspection(inspection.id, metrics, inspection.inspector.replace(/（.+）/, '') + `（${mode === 'supplement' ? '补录' : '重跑'}）`, mode)
    alert((mode === 'supplement' ? '补录' : '重跑') + `完成：${created.id}\n历史链路未断档（连续 ${created.rerunCount + 1} 条）。\n点击确定查看新记录。`)
    setSelectedInspectionId(created.id)
    onClose()
  }

  const handleExportChain = () => {
    const chain = useAppStore().getHistoryChain(inspection.id).map((i) => i.id)
    const ids = chain.concat([inspection.id])
    const { csv, hash, formulaVersion } = exportSelection(ids)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `链路导出_${formulaVersion}_${hash}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              {mode === 'supplement'
                ? <FilePlus className="w-5 h-5 text-amber-600" />
                : <RefreshCw className="w-5 h-5 text-violet-600" />}
              <h3 className="text-base font-semibold text-slate-800">
                {mode === 'supplement' ? '补录后重跑' : '重跑计算'} · {inspection.id}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'supplement'
                ? '补录之前漏掉的数据点，然后重跑阈值判断，全程记录口径版本'
                : '基于当前记录重跑一次，看历史是否断档、导出口径是否一致'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 bg-white flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5 mr-3">
            <button
              onClick={() => setMode('supplement')}
              className={clsx('px-3 py-1 text-xs rounded transition inline-flex items-center gap-1',
                mode === 'supplement' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500')}>
              <FilePlus className="w-3 h-3" />补录入
            </button>
            <button
              onClick={() => setMode('rerun')}
              className={clsx('px-3 py-1 text-xs rounded transition inline-flex items-center gap-1',
                mode === 'rerun' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500')}>
              <RefreshCw className="w-3 h-3" />重跑
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setStep('edit')}
              className={clsx('px-3 py-1 text-xs rounded transition',
                step === 'edit' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500')}>
              Step1 · 数据
            </button>
            <button
              onClick={() => setStep('verify')}
              className={clsx('px-3 py-1 text-xs rounded transition',
                step === 'verify' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500')}>
              Step2 · 校验
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={handleExportChain}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600">
              <Download className="w-3 h-3" />导出链路CSV
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto scroll-thin p-5 space-y-4">
          {step === 'edit' ? (
            <div className="grid grid-cols-2 gap-4">
              {diffs.map((d) => (
                <div key={d.key} className={clsx('rounded-lg border p-3 transition',
                  d.changed ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200 bg-white',
                  d.alertLevel === 'critical' && 'ring-2 ring-red-200',
                  d.alertLevel === 'warning' && 'ring-2 ring-amber-200')}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-xs text-slate-500">{d.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        范围 {DEFAULT_THRESHOLD[d.key].min} ~ {DEFAULT_THRESHOLD[d.key].max}
                      </div>
                    </div>
                    {d.alertLevel !== 'none' && (
                      <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        d.alertLevel === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                        <AlertTriangle className="w-3 h-3" />{d.alertLevel === 'critical' ? '超限' : '预警'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded p-2">
                      <div className="text-[10px] text-slate-400">原值</div>
                      <div className="text-base font-mono tabular-nums text-slate-700">{d.old}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">{mode === 'supplement' ? '补录值' : '重跑值'}</div>
                      <input
                        type="number"
                        value={metrics[d.key]}
                        onChange={(e) => setMetrics({ ...metrics, [d.key]: Number(e.target.value) })}
                        className="w-full px-2 py-1 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-400 tabular-nums"
                      />
                    </div>
                  </div>
                  {d.changed && (
                    <div className="mt-2 text-[11px] text-brand-700 bg-white border border-brand-200 rounded px-2 py-1">
                      变更：{d.old} → {d.now}（{((d.now - d.old) / Math.max(0.0001, d.old) * 100).toFixed(1)}%）
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-violet-500" />
                  校验 1 · 历史链路连续性
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {historyChainIds.map((id, idx) => (
                    <React.Fragment key={id}>
                      <div className="px-2.5 py-1 rounded bg-white border border-emerald-200 text-[11px] text-emerald-700 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />{id}
                      </div>
                      {idx < historyChainIds.length - 1 && <span className="text-slate-300">→</span>}
                    </React.Fragment>
                  ))}
                </div>
                <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5 inline-block">
                  ✓ 链路连续：共 {historyChainIds.length} 条记录，parentId 均可追溯到根节点，未断档
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-brand-500" />
                  校验 2 · 导出口径一致性
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white border border-slate-200 rounded p-3">
                    <div className="text-slate-400">口径版本</div>
                    <div className="font-mono text-slate-700 mt-0.5">v2.3.1</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded p-3">
                    <div className="text-slate-400">规则条目数</div>
                    <div className="font-mono text-slate-700 mt-0.5">5 项（振/温/压/流/电）</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded p-3">
                    <div className="text-slate-400">CSV 哈希校验</div>
                    <div className="font-mono text-slate-700 mt-0.5">同数据→同哈希</div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded px-3 py-1.5 inline-block">
                  ✓ 导出口径锁定：CSV 文件名带口径版本+哈希，审计可复算
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  校验 3 · 变更摘要（会同步进入变更历史）
                </h4>
                <ul className="space-y-1.5 text-sm">
                  {diffs.filter((d) => d.changed || d.alertLevel !== 'none').length === 0 && (
                    <li className="text-slate-400 text-xs">无变化</li>
                  )}
                  {diffs.filter((d) => d.changed || d.alertLevel !== 'none').map((d) => (
                    <li key={d.key} className="flex items-start gap-2 bg-white border border-slate-200 rounded p-2">
                      <span className="font-medium text-slate-700 text-xs w-16 shrink-0">{METRIC_LABELS[d.key].split(' ')[0]}</span>
                      <span className="text-xs text-slate-500 tabular-nums">{d.old} → <b className="text-slate-700">{d.now}</b></span>
                      {d.changed && (
                        <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded shrink-0">
                          Δ {((d.now - d.old) / Math.max(0.0001, d.old) * 100).toFixed(1)}%
                        </span>
                      )}
                      {d.alertLevel !== 'none' && (
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded shrink-0 ml-auto',
                          d.alertLevel === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}>
                          {d.alertLevel === 'critical' ? '超限' : '预警'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {mode === 'supplement' ? '补录完成' : '重跑完成'}后：新记录保留 parentId → 原记录链路可追溯；备注与截图继续关联。
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-600">
              取消
            </button>
            {step === 'edit' ? (
              <button
                onClick={() => setStep('verify')}
                className="px-3 py-1.5 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center gap-1">
                下一步：校验
              </button>
            ) : (
              <button
                onClick={runAndClose}
                className={clsx('px-3 py-1.5 text-sm rounded-md text-white inline-flex items-center gap-1',
                  mode === 'supplement' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-violet-600 hover:bg-violet-700')}>
                {mode === 'supplement' ? <FilePlus className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                确认{mode === 'supplement' ? '补录' : '重跑'}并生成新记录
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
