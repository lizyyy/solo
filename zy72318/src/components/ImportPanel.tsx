import { useState, useCallback } from 'react'
import { Upload, AlertCircle, FileUp } from 'lucide-react'
import { useVarStore } from '@/store'
import type { QuestionnaireRow, FormatType } from '@/types'

function detectFormatType(value: string): FormatType {
  const hasPercent = /%\s*$/.test(value)
  const hasDecimal = /^0?\.\d+$/.test(value.replace(/[%,]/g, ''))
  if (hasPercent && hasDecimal) return 'mixed'
  if (hasPercent) return 'percent'
  if (hasDecimal) return 'decimal'
  const allFields = value
  if (/%/.test(allFields) && /\d+\.\d+/.test(allFields)) return 'mixed'
  return 'decimal'
}

function parseCSV(text: string): QuestionnaireRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows: QuestionnaireRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim())
    const fields: Record<string, string> = {}
    let remark = ''
    headers.forEach((h, idx) => {
      if (h === '备注') {
        remark = values[idx] || ''
      } else {
        fields[h] = values[idx] || ''
      }
    })
    const allValues = Object.values(fields).join(' ')
    rows.push({
      id: 'r' + Math.random().toString(36).slice(2, 8),
      rowIndex: i,
      fields,
      remark,
      importBatch: 'batch-' + Date.now().toString(36),
      importTime: Date.now(),
      formatType: detectFormatType(allValues),
      needsReview: detectFormatType(allValues) === 'mixed',
    })
  }
  return rows
}

export default function ImportPanel() {
  const { rows, addRows, addAudit, setCurrentStep } = useVarStore()
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
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-300 ${
          dragOver
            ? 'border-accent-gold bg-accent-gold/5 shadow-[0_0_24px_rgba(240,165,0,0.1)]'
            : 'border-surface-border bg-base-700/50 hover:border-surface-border/80'
        }`}
      >
        <FileUp size={40} className={dragOver ? 'text-accent-gold' : 'text-text-muted'} />
        <p className="mt-3 text-sm text-text-secondary font-sans">
          拖拽 CSV 文件到此处，或
          <label className="ml-1 text-text-gold cursor-pointer hover:underline">
            选择文件
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
          </label>
        </p>
        <p className="text-xs text-text-muted mt-1 font-sans">支持 CSV 格式，首行为表头，含"备注"列</p>
      </div>

      {importMsg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-sans ${
            importMsg.includes('重复')
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
            <span className="text-sm text-text-red font-sans font-medium">重复导入告警</span>
          </div>
          <p className="text-xs text-text-muted font-sans">
            检测到 {duplicateRows.length} 行数据可能为重复导入或存在格式问题，已在表格中标记为"待复核"
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary font-sans">问卷原始行</h3>
          <span className="badge-muted">{rows.length} 行</span>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>投资组合</th>
                <th>置信度</th>
                <th>持有期</th>
                <th>VaR</th>
                <th>格式</th>
                <th>备注</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.needsReview ? 'bg-accent-gold/5' : ''}>
                  <td className="text-text-muted">{row.rowIndex}</td>
                  <td className="text-text-primary">{row.fields.portfolio || '-'}</td>
                  <td>
                    <span className={row.formatType === 'mixed' && /0\.\d+/.test(row.fields.confidence || '') ? 'text-accent-amber' : 'text-text-primary'}>
                      {row.fields.confidence || '-'}
                    </span>
                  </td>
                  <td className="text-text-primary">{row.fields.holdingPeriod || '-'}</td>
                  <td>
                    <span className={row.formatType === 'mixed' ? 'text-accent-amber' : 'text-text-primary'}>
                      {row.fields.varAmount || '-'}
                    </span>
                  </td>
                  <td>
                    {row.formatType === 'percent' && <span className="badge-gold">百分数</span>}
                    {row.formatType === 'decimal' && <span className="badge-muted">小数</span>}
                    {row.formatType === 'mixed' && <span className="badge-red">混搭</span>}
                  </td>
                  <td className="max-w-[200px] truncate text-text-secondary text-xs font-sans">
                    {row.remark || <span className="text-text-muted">—</span>}
                  </td>
                  <td>
                    {row.needsReview ? (
                      <span className="badge-red">待复核</span>
                    ) : (
                      <span className="badge-green">正常</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setCurrentStep('boundary')}
          className="btn-primary flex items-center gap-2"
        >
          <Upload size={16} />
          下一步：补看边界值说明
        </button>
      </div>
    </div>
  )
}
