import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '@/store/useStore'
import { useFilteredPoints, useStats } from '@/hooks/useDerivedData'
import {
  SEVERITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  QC_ISSUE_LABELS,
  JUDGMENT_TYPE_LABELS,
} from '@/types'
import { FileText } from 'lucide-react'

const POINT_HEADERS = [
  '点位ID', '管线编号', '坐标X', '坐标Y', '坐标Z', '腐蚀等级',
  '数据来源', '来源文件', '导入时间', '巡检日期', '状态',
  '腐蚀深度(mm)', '剩余壁厚(mm)', '描述'
]

const QC_HEADERS = [
  '问题ID', '关联点位', '问题类型', '描述', '状态', '检测时间'
]

const JUDGMENT_HEADERS = [
  '记录ID', '关联点位', '操作人', '判断类型', '原值', '新值', '理由', '时间'
]

const IMPORT_ERROR_HEADERS = [
  '错误ID', '来源文件', '行号', '字段', '原值', '错误类型', '原因说明'
]

const IMPORT_ERROR_TYPE_LABELS: Record<string, string> = {
  missing_field: '缺失字段',
  invalid_format: '格式错误',
  out_of_range: '范围越界',
  duplicate_id: '重复ID',
  unknown_pipe: '未知管线',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function formatNum(n: number | null | undefined): string {
  if (n == null) return ''
  return String(n)
}

function autoWidth(ws: XLSX.WorkSheet, data: any[][]) {
  const colWidths = data[0].map((_, i) =>
    Math.max(...data.map(row => {
      const val = row[i]
      const len = val ? String(val).length : 10
      return Math.min(len + 2, 50)
    }))
  )
  ws['!cols'] = colWidths.map(w => ({ wch: w }))
}

function boldHeader(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
    if (cell) {
      cell.s = { font: { bold: true } }
    }
  }
}

export default function ReportExport() {
  const [busy, setBusy] = useState(false)
  const filteredPoints = useFilteredPoints()
  const stats = useStats()
  const filters = useStore((s) => s.filters)
  const qcRecords = useStore((s) => s.qcRecords)
  const judgments = useStore((s) => s.judgments)
  const importErrors = useStore((s) => s.importErrors)
  const pipes = useStore((s) => s.pipes)

  function getPipeName(pipeId: string): string {
    const pipe = pipes.find(p => p.id === pipeId)
    return pipe ? pipe.name : pipeId
  }

  function buildSummaryData(): any[][] {
    const data: any[][] = []
    data.push(['管线腐蚀检测报告', ''])
    data.push(['', ''])
    data.push(['筛选条件', ''])
    data.push(['腐蚀等级', filters.severity.length > 0
      ? filters.severity.map(s => SEVERITY_LABELS[s]).join(', ')
      : '全部'])
    data.push(['数据来源', filters.sources.length > 0
      ? filters.sources.map(s => SOURCE_LABELS[s]).join(', ')
      : '全部'])
    data.push(['管线', filters.pipeIds.length > 0
      ? filters.pipeIds.map(id => getPipeName(id)).join(', ')
      : '全部'])
    data.push(['状态', filters.status.length > 0
      ? filters.status.map(s => STATUS_LABELS[s]).join(', ')
      : '全部'])
    data.push(['日期范围', `${filters.dateRange[0]} ~ ${filters.dateRange[1]}`])
    data.push(['', ''])
    data.push(['统计数据', ''])
    data.push(['总点位', stats.total])
    data.push(['异常点位', stats.anomaly])
    data.push(['例外点位', stats.exception])
    data.push(['冲突点位', stats.conflict])
    data.push(['导入错误', importErrors.length])
    data.push(['', ''])
    data.push(['导出时间', new Date().toLocaleString('zh-CN', { hour12: false })])
    return data
  }

  function buildPointsData(): any[][] {
    const data: any[][] = [POINT_HEADERS]
    filteredPoints.forEach(p => {
      data.push([
        p.id,
        getPipeName(p.pipeId),
        formatNum(p.x),
        formatNum(p.y),
        formatNum(p.z),
        SEVERITY_LABELS[p.severity],
        SOURCE_LABELS[p.source],
        p.sourceFile,
        formatDate(p.importedAt),
        p.inspectedAt,
        STATUS_LABELS[p.status],
        formatNum(p.depth),
        formatNum(p.thickness),
        p.description || ''
      ])
    })
    return data
  }

  function buildQCData(): any[][] {
    const data: any[][] = [QC_HEADERS]
    const filteredPointIds = new Set(filteredPoints.map(p => p.id))
    const filteredQC = qcRecords.filter(q => filteredPointIds.has(q.pointId))
    filteredQC.forEach(q => {
      data.push([
        q.id,
        q.pointId,
        QC_ISSUE_LABELS[q.issueType],
        q.description,
        q.status === 'open' ? '待处理' : '已解决',
        formatDate(q.detectedAt)
      ])
    })
    return data
  }

  function buildJudgmentData(): any[][] {
    const data: any[][] = [JUDGMENT_HEADERS]
    const filteredPointIds = new Set(filteredPoints.map(p => p.id))
    const filteredJudgments = judgments.filter(j => filteredPointIds.has(j.pointId))
    filteredJudgments.forEach(j => {
      data.push([
        j.id,
        j.pointId,
        j.operator,
        JUDGMENT_TYPE_LABELS[j.judgmentType],
        j.oldValue,
        j.newValue,
        j.reason,
        formatDate(j.createdAt)
      ])
    })
    return data
  }

  function buildImportErrorsData(): any[][] {
    const data: any[][] = [IMPORT_ERROR_HEADERS]
    importErrors.forEach(e => {
      data.push([
        e.id,
        e.sourceFile,
        e.rowNumber ?? '',
        e.field ?? '',
        e.value ?? '',
        IMPORT_ERROR_TYPE_LABELS[e.errorType] || e.errorType,
        e.message
      ])
    })
    return data
  }

  async function handleExport() {
    setBusy(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 300))

      const wb = XLSX.utils.book_new()

      const summaryData = buildSummaryData()
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
      autoWidth(wsSummary, summaryData)
      boldHeader(wsSummary)
      XLSX.utils.book_append_sheet(wb, wsSummary, '统计摘要')

      const pointsData = buildPointsData()
      const wsPoints = XLSX.utils.aoa_to_sheet(pointsData)
      autoWidth(wsPoints, pointsData)
      boldHeader(wsPoints)
      XLSX.utils.book_append_sheet(wb, wsPoints, '点位明细')

      const qcData = buildQCData()
      const wsQC = XLSX.utils.aoa_to_sheet(qcData)
      autoWidth(wsQC, qcData)
      boldHeader(wsQC)
      XLSX.utils.book_append_sheet(wb, wsQC, '质控问题')

      const judgmentData = buildJudgmentData()
      const wsJudgment = XLSX.utils.aoa_to_sheet(judgmentData)
      autoWidth(wsJudgment, judgmentData)
      boldHeader(wsJudgment)
      XLSX.utils.book_append_sheet(wb, wsJudgment, '判断记录')

      const importErrorData = buildImportErrorsData()
      const wsImportError = XLSX.utils.aoa_to_sheet(importErrorData)
      autoWidth(wsImportError, importErrorData)
      boldHeader(wsImportError)
      XLSX.utils.book_append_sheet(wb, wsImportError, '导入错误明细')

      const now = new Date()
      const ts = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '-' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0')
      const fileName = `pipeline-corrosion-report-${ts}.xlsx`

      XLSX.writeFile(wb, fileName)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={busy}
        className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-black/60 px-4 py-2 text-sm text-emerald-400 backdrop-blur-sm transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <FileText size={16} />
        {busy ? '导出中...' : '导出报告'}
      </button>

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-64 rounded-xl border border-white/10 bg-gray-900 p-6 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            <div className="text-sm font-medium text-white">正在生成报告...</div>
            <div className="mt-1 text-xs text-gray-400">请稍候</div>
          </div>
        </div>
      )}
    </>
  )
}
