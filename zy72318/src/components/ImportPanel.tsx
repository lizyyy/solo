import { useState, useCallback } from 'react'
import { Upload, AlertCircle, FileUp, Eye, RefreshCcw } from 'lucide-react'
import { useVarStore } from '@/store'
import type { QuestionnaireRow, FormatType } from '@/types'

function detectFormatType(fields: Record<string, string>): FormatType {
  const all = Object.values(fields).join(' ')
  const hasPercent = /%/.test(all)
  const hasDecimal = /(^|[\s,])0?\.\d+/.test(all.replace(/[%]/g, ''))
  if (hasPercent && hasDecimal) return 'mixed'
  if (hasPercent) return 'percent'
  return 'decimal'
}

function cloneFields(f: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(f))
}

function parseCSV(text: string): QuestionnaireRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows: QuestionnaireRow[] = []
  const batch = 'batch-' + Date.now().toString(36)
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim())
    const fields: Record<string, string> = {}
    let remark = ''
    headers.forEach((h, idx) => {
      if (h === '备注') remark = values[idx] || ''
      else fields[h] = values[idx] || ''
    })
    const fmt = detectFormatType(fields)
    rows.push({
      id: 'r' + Math.random().toString(36).slice(2, 8),
      rowIndex: i,
      fields: cloneFields(fields),
      originalFields: cloneFields(fields),
      remark,
      importBatch: batch,
      importTime: Date.now(),
      formatType: fmt,
      needsReview: fmt === 'mixed',
      reviewOwner: fmt === 'mixed' ? '活动负责人' : undefined,
      reviewStatus: fmt === 'mixed' ? 'pending' : 'released',
      valueChanges: [],
      recalcRequired: fmt === 'mixed',
    })
  }
  return rows
}

export default function ImportPanel() {
  const { rows, addRows, addAudit, setCurrentStep, setSelectedRowId, resetAll } = useVarStore()
  const [dragOver, setDragOver] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const handleImport = useCallback(
    (text: string) => {
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setImportMsg('解析失败：文件格式不正确')
        return
      }
      addRows(parsed)
      addAudit({
        entityType: 'row',
        entityId: parsed.map((r) => r.id).join(','),
        action: '导入',
        operator: '唐老师',
        timestamp: Date.now(),
        reason: `导入${parsed.length}行问卷数据`,
        affectedResults: [],
      })
      const dupes = parsed.filter((r) => r.needsReview && r.formatType !== 'mixed')
      setImportMsg(
        dupes.length > 0
          ? `导入${parsed.length}行，其中${dupes.length}行疑似重复，已标记待复核`
          : `成功导入${parsed.length}行问卷数据`
      )
    },
    [addRows, addAudit]
  )

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          handleImport(ev.target?.result as string)
        }
        reader.readAsText(file)
      }
    },
    [handleImport]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          handleImport(ev.target?.result as string)
        }
        reader.readAsText(file)
      }
    },
    [handleImport]
  )

  const duplicateRows = rows.filter((r) => r.needsReview)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`flex-1 min-w-[420px] border-2 border-dashed rounded-xl p-6 flex items-center justify-center gap-4 transition-all duration-300 ${
            dragOver
              ? 'border-accent-gold bg-accent-gold/5 shadow-[0_0_24px_rgba(240,165,0,0.1)]'
              : 'border-surface-border bg-base-700/50 hover:border-surface-border/80'
          }`}
        >
          <FileUp size={32} className={dragOver ? 'text-accent-gold' : 'text-text-muted'} />
          <div className="text-center">
            <p className="text-sm text-text-secondary font-sans">
              拖拽 CSV 文件到此处，或
              <label className="ml-1 text-text-gold cursor-pointer hover:underline">
                选择文件
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </p>
            <p className="text-xs text-text-muted mt-1 font-sans">
              支持 CSV 格式，首行为表头，含「备注」列
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setCurrentStep('boundary')}
            className="btn-primary flex items-center gap-2"
          >
            <Eye size={16} />
            下一步：补看边界值说明
          </button>
          <button
            onClick={() => {
              resetAll()
              setImportMsg('已重置：所有问卷、冲突、明细、审计均已还原为初始样例')
            }}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCcw size={14} />
            重置样例数据
          </button>
        </div>
      </div>

      {importMsg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-sans ${
            importMsg.includes('重复') || importMsg.includes('重置')
              ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30'
              : 'bg-accent-green/10 text-text-green border border-accent-green/30'
          }`}
        >
          <AlertCircle size={16} />
          <span>{importMsg}</span>
        </div>
      )}

      {duplicateRows.length > 0 && (
        <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-accent-red" />
            <span className="text-sm text-text-red font-sans font-medium">重复导入 / 格式告警</span>
          </div>
          <p className="text-xs text-text-muted font-sans">
            检测到 {duplicateRows.length} 行数据疑似重复导入或存在格式问题，
            已在表格中标记为「待复核」，<strong className="text-accent-amber">不会自动清洗</strong>。
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-medium text-text-primary font-sans">
            问卷原始行（含原始字段、变更追踪）
          </h3>
          <span className="badge-muted">{rows.length} 行</span>
        </div>
        <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>投资组合</th>
                <th>置信度（原）/（今）</th>
                <th>VaR（原）/（今）</th>
                <th>格式</th>
                <th>变更</th>
                <th>备注</th>
                <th>下一步</th>
                <th>状态</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cChanged = row.fields.confidence !== row.originalFields.confidence
                const vChanged = row.fields.varAmount !== row.originalFields.varAmount
                const anyChanged = cChanged || vChanged || row.valueChanges.length > 0
                return (
                  <tr key={row.id} className={row.needsReview ? 'bg-accent-gold/5' : ''}>
                    <td className="text-text-muted">{row.rowIndex}</td>
                    <td className="text-text-primary">{row.fields.portfolio || '-'}</td>
                    <td className="font-mono text-xs">
                      <div>
                        <span className={cChanged ? 'text-text-muted line-through' : 'text-text-secondary'}>
                          {row.originalFields.confidence || '-'}
                        </span>
                      </div>
                      {cChanged && (
                        <div className="text-text-green">{row.fields.confidence}</div>
                      )}
                    </td>
                    <td className="font-mono text-xs">
                      <div>
                        <span className={vChanged ? 'text-text-muted line-through' : 'text-text-secondary'}>
                          {row.originalFields.varAmount || '-'}
                        </span>
                      </div>
                      {vChanged && (
                        <div className="text-text-green">{row.fields.varAmount}</div>
                      )}
                    </td>
                    <td>
                      {row.formatType === 'percent' && <span className="badge-gold">百分数</span>}
                      {row.formatType === 'decimal' && <span className="badge-muted">小数</span>}
                      {row.formatType === 'mixed' && <span className="badge-red">混搭</span>}
                    </td>
                    <td>
                      {anyChanged ? (
                        <span className="badge-green">{row.valueChanges.length} 次</span>
                      ) : (
                        <span className="badge-muted">无</span>
                      )}
                    </td>
                    <td className="max-w-[180px] truncate text-text-secondary text-xs font-sans">
                      {row.remark || <span className="text-text-muted">—</span>}
                    </td>
                    <td>
                      {row.reviewOwner ? (
                        <span className="badge-gold text-[10px]">→ {row.reviewOwner}</span>
                      ) : (
                        <span className="text-[10px] text-text-muted">已完成</span>
                      )}
                    </td>
                    <td>
                      {row.needsReview ? (
                        <span className="badge-red">待复核</span>
                      ) : row.valueChanges.length > 0 ? (
                        <span className="badge-gold">已修正</span>
                      ) : (
                        <span className="badge-green">正常</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedRowId(row.id)}
                        className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-gold transition-colors"
                        title="查看复核详情"
                      >
                        <Eye size={14} />
                      </button>
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
