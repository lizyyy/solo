import { useCraneStore } from '@/store'
import { normalizeAngle, normalizeLength } from '@/utils/physics'
import { FileDown, FileText } from 'lucide-react'
import { useState } from 'react'

export default function ReportPreview() {
  const records = useCraneStore(s => s.records)
  const calculations = useCraneStore(s => s.calculations)
  const validations = useCraneStore(s => s.validations)
  const auditLog = useCraneStore(s => s.auditLog)
  const supplements = useCraneStore(s => s.supplements)
  const [showPreview, setShowPreview] = useState(false)

  function generateReport(): string {
    const lines: string[] = []
    lines.push('═'.repeat(60))
    lines.push('  港口吊机摆动抑制 — 交接报告')
    lines.push(`  生成时间: ${new Date().toLocaleString('zh-CN')}`)
    lines.push('═'.repeat(60))
    lines.push('')

    lines.push('【记录汇总】')
    lines.push(`  总记录数: ${records.length}`)
    lines.push(`  通过: ${records.filter(r => r.status === 'pass').length}`)
    lines.push(`  需确认: ${records.filter(r => r.status === 'needs_review').length}`)
    lines.push(`  已补录: ${records.filter(r => r.status === 'supplemented').length}`)
    lines.push(`  例外: ${records.filter(r => r.status === 'exception').length}`)
    lines.push('')

    records.forEach(record => {
      const calc = calculations.find(c => c.recordId === record.id)
      const steps = validations.filter(v => v.recordId === record.id)
      const sups = supplements.filter(s => s.recordId === record.id)
      const angleDeg = normalizeAngle(record.swingAngle, record.swingAngleUnit)
      const ropeM = normalizeLength(record.ropeLength, record.ropeLengthUnit)

      lines.push(`─ 记录 ${record.id.slice(0, 16)} ─`)
      lines.push(`  来源: ${record.source} | 口径: ${record.caliberTag}`)
      lines.push(`  绳长: ${ropeM.toFixed(1)}m | 摆角: ${angleDeg.toFixed(2)}° | 方向: ${record.direction}`)
      if (calc) {
        lines.push(`  周期: ${calc.period.toFixed(3)}s | 阻尼: ${calc.dampingRatio.toFixed(4)} | 残余角: ${calc.residualAngle.toFixed(4)}°`)
      }
      lines.push(`  状态: ${record.status}`)
      lines.push('  校验:')
      steps.forEach(s => {
        lines.push(`    [${s.result}] ${s.message}`)
      })
      if (sups.length > 0) {
        lines.push('  补录:')
        sups.forEach(s => {
          lines.push(`    ${s.note} → ${s.deltaExplanation}`)
        })
      }
      lines.push('')
    })

    lines.push('【审计日志】')
    auditLog.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleString('zh-CN')
      lines.push(`  ${time} | ${entry.action} | ${entry.detail}`)
    })

    lines.push('')
    lines.push('═'.repeat(60))
    lines.push('  报告结束 — 训练教练老唐交接用')
    lines.push('═'.repeat(60))
    return lines.join('\n')
  }

  function handleExport() {
    const report = generateReport()
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `吊机摆动抑制报告_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (records.length === 0) return null

  return (
    <div className="harbor-panel p-4">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4" />
        交接报告
      </h3>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="harbor-btn-secondary text-xs flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          {showPreview ? '收起预览' : '预览报告'}
        </button>
        <button
          onClick={handleExport}
          className="harbor-btn text-xs flex items-center gap-1"
        >
          <FileDown className="w-3.5 h-3.5" />
          导出 TXT
        </button>
      </div>

      {showPreview && (
        <pre className="bg-harbor-bg border border-harbor-border rounded p-4 text-xs font-mono text-gray-300 max-h-96 overflow-y-auto whitespace-pre-wrap">
          {generateReport()}
        </pre>
      )}
    </div>
  )
}
