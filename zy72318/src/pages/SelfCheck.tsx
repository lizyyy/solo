import { useState } from 'react'
import { ShieldCheck, Download, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { useVarStore } from '@/store'
import type { CheckStatus } from '@/types'

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle size={20} className="text-accent-green" />
  if (status === 'fail') return <XCircle size={20} className="text-accent-red" />
  return <AlertTriangle size={20} className="text-accent-amber" />
}

function StatusLabel({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <span className="badge-green">通过</span>
  if (status === 'fail') return <span className="badge-red">失败</span>
  return <span className="badge-gold">警告</span>
}

const CHECK_ITEMS = [
  {
    key: 'duplicateImport' as const,
    label: '重复导入检测',
    desc: '检查是否存在同一组合、同一VaR金额的重复导入记录',
  },
  {
    key: 'formatConsistency' as const,
    label: '百分数/小数格式一致性',
    desc: '检查是否存在百分数与小数混搭的行，混搭行需人工复核',
  },
  {
    key: 'recalcAfterSupplement' as const,
    label: '补录后重算验证',
    desc: '检查冲突裁决后计算明细是否已更新，是否存在待裁决冲突',
  },
  {
    key: 'exportConsistency' as const,
    label: '导出一致性校验',
    desc: '验证导出明细、页面展示、接口返回读取同一份数据源',
  },
]

export default function SelfCheck() {
  const { selfCheck, runSelfCheck, rows, calculations } = useVarStore()
  const [exporting, setExporting] = useState(false)

  const handleRunCheck = () => {
    runSelfCheck()
  }

  const allPass = selfCheck && Object.values(selfCheck).every(
    (v) => typeof v === 'string' && v === 'pass'
  )

  const handleExport = () => {
    if (!allPass) return
    setExporting(true)

    const exportData = {
      exportTime: new Date().toISOString(),
      rows: rows.map((r) => ({
        ...r,
        calculation: calculations.find((c) => c.rowId === r.id) || null,
      })),
      selfCheck: selfCheck,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `var-replay-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary font-sans">自检与导出</h1>
          <p className="text-xs text-text-muted font-sans mt-1">
            四项自检确保数据质量，自检全通过后方可导出
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRunCheck} className="btn-primary flex items-center gap-2">
            <RefreshCw size={14} />
            执行自检
          </button>
          <button
            onClick={handleExport}
            disabled={!allPass || exporting}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all font-sans ${
              allPass
                ? 'border border-accent-gold/50 bg-accent-gold/20 text-text-gold hover:bg-accent-gold/30'
                : 'border border-surface-border bg-base-700 text-text-muted cursor-not-allowed opacity-50'
            }`}
          >
            <Download size={14} />
            {exporting ? '导出中...' : '导出结果'}
          </button>
        </div>
      </header>

      {!selfCheck && (
        <div className="card p-12 text-center">
          <ShieldCheck size={48} className="text-text-muted mx-auto mb-4" />
          <p className="text-sm text-text-secondary font-sans">尚未执行自检</p>
          <p className="text-xs text-text-muted font-sans mt-1">点击「执行自检」开始四项校验</p>
        </div>
      )}

      {selfCheck && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {CHECK_ITEMS.map((item) => {
              const status = selfCheck[item.key]
              return (
                <div
                  key={item.key}
                  className={`card p-5 transition-all duration-300 ${
                    status === 'pass'
                      ? 'border-accent-green/20'
                      : status === 'fail'
                      ? 'border-accent-red/20'
                      : 'border-accent-amber/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <StatusIcon status={status} />
                    <StatusLabel status={status} />
                  </div>
                  <h3 className="text-sm font-medium text-text-primary font-sans mb-1">{item.label}</h3>
                  <p className="text-xs text-text-muted font-sans">{item.desc}</p>
                  {selfCheck.details[item.key]?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-surface-border/50 space-y-1">
                      {selfCheck.details[item.key].map((detail, i) => (
                        <p key={i} className="text-[11px] font-sans text-text-secondary">
                          · {detail}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!allPass && (
            <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-accent-amber mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-accent-amber font-sans font-medium">导出受限</p>
                <p className="text-xs text-text-muted font-sans mt-1">
                  自检未全通过时无法导出。请先处理失败的检查项（前往冲突与复核页面裁决冲突或修复格式问题），然后重新执行自检。
                </p>
              </div>
            </div>
          )}

          {allPass && (
            <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle size={18} className="text-accent-green mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-text-green font-sans font-medium">自检全部通过</p>
                <p className="text-xs text-text-muted font-sans mt-1">
                  导出明细、页面展示、接口返回读取同一份数据源，数据一致性校验通过，可安全导出。
                </p>
              </div>
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold text-text-primary font-sans mb-3">导出预览</h2>
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
                <span className="text-xs text-text-muted font-sans">
                  共 {rows.length} 行 · {calculations.length} 条计算明细
                </span>
                <span className="text-[10px] text-text-muted font-sans">
                  数据来源：Zustand Store（同源）
                </span>
              </div>
              <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>投资组合</th>
                      <th>置信度</th>
                      <th>持有期</th>
                      <th>VaR 显示值</th>
                      <th>VaR 内部值</th>
                      <th>格式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const calc = calculations.find((c) => c.rowId === row.id)
                      return (
                        <tr key={row.id}>
                          <td className="text-text-muted">{row.rowIndex}</td>
                          <td className="text-text-primary">{row.fields.portfolio}</td>
                          <td>{row.fields.confidence}</td>
                          <td>{row.fields.holdingPeriod}</td>
                          <td className="text-text-gold font-mono">{calc?.displayValue || '-'}</td>
                          <td className="text-text-secondary font-mono">{calc?.varValue ?? '-'}</td>
                          <td>
                            {calc?.displayFormat === 'percent' ? (
                              <span className="badge-gold">%</span>
                            ) : (
                              <span className="badge-muted">小数</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
