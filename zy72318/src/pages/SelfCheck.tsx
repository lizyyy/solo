import { useState } from 'react'
import { ShieldCheck, Download, CheckCircle, XCircle, AlertTriangle, RefreshCw, FileJson, Clock, User } from 'lucide-react'
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
    desc: '检测同一组合+同一VaR是否出现多次；重复记录留待人工复核，不静默合并',
  },
  {
    key: 'formatConsistency' as const,
    label: '百分数/小数格式一致性',
    desc: '存在混搭行一律判定失败，绝不静默归正常。混搭行需活动负责人逐条确认',
  },
  {
    key: 'recalcAfterSupplement' as const,
    label: '补录后重算验证',
    desc: '冲突裁决/人工补录后是否完成重算；未重算的记录不能进入导出',
  },
  {
    key: 'exportConsistency' as const,
    label: '导出一致性校验',
    desc: '导出明细、页面展示、接口返回三者同源；边界值备注、冲突裁决、审计轨迹需同步导出',
  },
]

export default function SelfCheck() {
  const { selfCheck, runSelfCheck, rows, calculations, exportPayload, addAudit, boundaryNotes, conflicts, audits } = useVarStore()
  const [exporting, setExporting] = useState(false)
  const [lastExportAt, setLastExportAt] = useState<number | null>(null)

  const handleRunCheck = () => {
    runSelfCheck()
  }

  const corePass = selfCheck &&
    selfCheck.formatConsistency === 'pass' &&
    selfCheck.recalcAfterSupplement === 'pass' &&
    selfCheck.exportConsistency === 'pass'

  const allPass = selfCheck &&
    selfCheck.duplicateImport === 'pass' &&
    selfCheck.formatConsistency === 'pass' &&
    selfCheck.recalcAfterSupplement === 'pass' &&
    selfCheck.exportConsistency === 'pass'

  const handleExport = () => {
    if (!corePass) return
    setExporting(true)
    const payload = exportPayload()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `var-replay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)

    addAudit({
      entityType: 'export',
      entityId: 'export-' + Date.now(),
      action: '导出',
      operator: '唐老师',
      timestamp: Date.now(),
      reason: `自检全通过后导出。共${payload.rows.length}行，${payload.calculations.length}条计算明细，${payload.audits.length}条审计。`,
      affectedResults: payload.calculations.map((c) => c.id),
      extra: {
        rowCount: payload.rows.length,
        calcCount: payload.calculations.length,
        auditCount: payload.audits.length,
        conflictCount: payload.conflicts.length,
        boundaryCount: payload.boundaryNotes.length,
      },
    })
    setLastExportAt(Date.now())
    setExporting(false)
  }

  const reportRowCount = rows.length
  const releasedCount = calculations.filter((c) => c.released).length
  const pendingReview = rows.filter((r) => r.needsReview).length
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary font-sans">自检与导出</h1>
          <p className="text-xs text-text-muted font-sans mt-1">
            四项自检 + 全链路同源。<span className="text-accent-amber">核心自检不通过时禁止导出</span>。
            导出的 JSON 包含完整的问卷行、边界值备注、冲突记录、计算明细及版本历史、审计轨迹。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRunCheck} className="btn-primary flex items-center gap-2">
            <RefreshCw size={14} />
            执行自检
          </button>
          <button
            onClick={handleExport}
            disabled={!corePass || exporting}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all font-sans ${
              corePass
                ? 'border border-accent-gold/50 bg-accent-gold/20 text-text-gold hover:bg-accent-gold/30'
                : 'border border-surface-border bg-base-700 text-text-muted cursor-not-allowed opacity-50'
            }`}
          >
            <Download size={14} />
            {exporting ? '导出中...' : '导出（完整JSON）'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-6 gap-3">
        {[
          { label: '问卷行', v: reportRowCount, color: 'text-text-primary' },
          { label: '计算明细', v: calculations.length, color: 'text-text-primary' },
          { label: '已发布', v: releasedCount, color: 'text-accent-green' },
          { label: '待复核', v: pendingReview, color: 'text-accent-amber' },
          { label: '未裁决冲突', v: pendingConflicts, color: 'text-accent-red' },
          { label: '边界值备注', v: boundaryNotes.length, color: 'text-text-gold' },
        ].map((x) => (
          <div key={x.label} className="card p-4">
            <div className={`text-2xl font-mono font-bold ${x.color}`}>{x.v}</div>
            <div className="text-xs text-text-muted font-sans mt-1">{x.label}</div>
          </div>
        ))}
      </div>

      {!selfCheck && (
        <div className="card p-12 text-center">
          <ShieldCheck size={48} className="text-text-muted mx-auto mb-4" />
          <p className="text-sm text-text-secondary font-sans">尚未执行自检</p>
          <p className="text-xs text-text-muted font-sans mt-1">
            点击右上角「执行自检」开始四项校验。导出前必须核心自检通过。
          </p>
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
                  <p className="text-xs text-text-muted font-sans leading-relaxed">{item.desc}</p>
                  {selfCheck.details[item.key]?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-surface-border/50 space-y-1">
                      {selfCheck.details[item.key].map((detail, i) => (
                        <p key={i} className="text-[11px] font-sans text-text-secondary leading-relaxed">
                          · {detail}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!corePass && (
            <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-accent-amber mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-accent-amber font-sans font-medium">导出受限</p>
                <p className="text-xs text-text-muted font-sans mt-1 leading-relaxed">
                  核心自检未通过时无法导出。请前往「冲突与复核」处理：①裁决待处理冲突
                  ②由活动负责人复核百分数/小数混搭记录
                  ③裁决后系统会自动重算；也可在「回放工作台→更新计算明细」手动触发全量重算
                  ④全部记录发布后回到此处再次执行自检。
                </p>
              </div>
            </div>
          )}

          {corePass && (
            <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle size={18} className="text-accent-green mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-text-green font-sans font-medium">核心自检通过，可导出</p>
                <p className="text-xs text-text-muted font-sans mt-1 leading-relaxed">
                  导出的 JSON、页面所有表格、接口（store 模拟）均从 Zustand 同一份 store 读取。
                  数据包含：问卷行+originalFields+valueChanges、边界值说明原文及 appliedRowIds、
                  冲突记录及裁决轨迹、计算明细及 versionHistory、完整审计。
                  {lastExportAt && (
                    <span className="block mt-1 text-accent-green">
                      最近导出：{new Date(lastExportAt).toLocaleString('zh-CN')}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold text-text-primary font-sans mb-3 flex items-center gap-2">
              <FileJson size={14} className="text-accent-gold" />
              导出预览（与页面/接口同源）
            </h2>
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 text-xs font-sans">
                  <span className="text-text-secondary">问卷行：{rows.length}</span>
                  <span className="text-text-secondary">计算：{calculations.length}</span>
                  <span className="text-text-secondary">冲突：{conflicts.length}</span>
                  <span className="text-text-secondary">边界备注：{boundaryNotes.length}</span>
                  <span className="text-text-secondary">审计：{audits.length}</span>
                </div>
                <span className="text-[10px] text-text-muted font-sans">
                  来源：Zustand store · useVarStore · 同源三端
                </span>
              </div>
              <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>投资组合</th>
                      <th>置信度</th>
                      <th>VaR 显示</th>
                      <th>VaR 内部</th>
                      <th>版本</th>
                      <th>重算来源</th>
                      <th>发布</th>
                      <th>边界备注生效</th>
                      <th>变更次数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const calc = calculations.find((c) => c.rowId === row.id)
                      const relatedNoteIds = boundaryNotes
                        .filter(
                          (n) =>
                            n.relatedRowIds.includes(row.id) || n.appliedRowIds.includes(row.id)
                        )
                        .map((n) => n.id)
                      const applied = boundaryNotes.filter((n) => n.appliedRowIds.includes(row.id)).length
                      return (
                        <tr key={row.id}>
                          <td className="text-text-muted">{row.rowIndex}</td>
                          <td className="text-text-primary">{row.fields.portfolio}</td>
                          <td className="font-mono">{row.fields.confidence}</td>
                          <td className="text-text-gold font-mono">{calc?.displayValue || '-'}</td>
                          <td className="text-text-secondary font-mono text-xs">
                            {calc?.varValue ?? '-'}
                          </td>
                          <td>
                            {calc ? (
                              <span className="badge-gold">v{calc.recalcVersion}</span>
                            ) : (
                              <span className="badge-muted">无</span>
                            )}
                          </td>
                          <td className="max-w-[120px] truncate text-xs font-sans text-text-secondary">
                            {calc?.recalcSource || '-'}
                          </td>
                          <td>
                            {calc?.released ? (
                              <span className="badge-green">是</span>
                            ) : (
                              <span className="badge-muted">否</span>
                            )}
                          </td>
                          <td className="text-xs">
                            {relatedNoteIds.length > 0 ? (
                              <span className="text-xs">
                                {applied}/{relatedNoteIds.length}
                              </span>
                            ) : (
                              <span className="text-text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <span className={`text-xs ${row.valueChanges.length > 0 ? 'text-accent-green' : 'text-text-muted'}`}>
                              {row.valueChanges.length}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-text-primary font-sans mb-3 flex items-center gap-2">
              <Clock size={14} className="text-accent-gold" />
              审计摘要（导出中包含完整轨迹）
            </h2>
            <div className="card p-4">
              {audits.length === 0 ? (
                <p className="text-xs text-text-muted font-sans text-center py-4">暂无审计记录</p>
              ) : (
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {[...audits].reverse().slice(0, 18).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 text-xs font-sans p-2 rounded hover:bg-surface-hover transition-colors"
                    >
                      <User size={12} className="text-text-muted shrink-0" />
                      <span className="text-text-gold shrink-0 w-14">{a.operator}</span>
                      <span className="text-text-primary shrink-0 w-24">{a.action}</span>
                      <span className="text-text-secondary flex-1 truncate">{a.reason}</span>
                      <span className="text-text-muted shrink-0 font-mono text-[10px]">
                        {new Date(a.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
