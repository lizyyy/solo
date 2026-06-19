import * as billRecordRepo from '../repositories/billRecordRepository'
import * as teacherNoteRepo from '../repositories/teacherNoteRepository'
import * as samplingListRepo from '../repositories/samplingListRepository'
import * as gapRepo from '../repositories/gapRecordRepository'
import * as conflictRepo from '../repositories/conflictRecordRepository'
import * as XLSX from 'xlsx'

const STATUS_LABELS: Record<string, string> = {
  smooth: '顺利',
  gap: '断档',
  supplement: '补录',
  conflict: '冲突',
  pending: '待处理',
  reviewed_normal: '复核正常',
  reviewed_abnormal: '复核异常',
  approved: '已通过',
  rejected: '已驳回',
}

function getExportData() {
  const records = billRecordRepo.findAll()
  const teacherNotes = new Map(teacherNoteRepo.findAll().map((n) => [n.id, n]))
  const samplingLists = new Map(samplingListRepo.findAll().map((s) => [s.id, s]))
  const gaps = new Map(gapRepo.findAll().map((g) => [g.recordId, g]))
  const conflicts = new Map(conflictRepo.findAll().map((c) => [c.recordId, c]))

  const exportRows = records.map((record) => {
    const teacherNote = record.teacherNoteId ? teacherNotes.get(record.teacherNoteId) : undefined
    const samplingList = record.samplingListId ? samplingLists.get(record.samplingListId) : undefined
    const gap = gaps.get(record.id)
    const conflict = conflicts.get(record.id)

    return {
      '记录编号': record.recordNo,
      '日期': record.date,
      '老师姓名': record.teacherName,
      '金额': record.amount,
      '项目类型': record.itemType,
      '当前状态': STATUS_LABELS[record.status] || record.status,
      '老师批注原文': teacherNote?.annotation || '',
      '抽样场景描述': samplingList?.sceneDescription || '',
      '断档缺失编号': gap?.missingRecordNo || '',
      '断档复核状态': gap ? (gap.reviewStatus === 'pending' ? '待复核' : gap.reviewStatus === 'normal' ? '复核正常' : '复核异常') : '',
      '断档复核意见': gap?.reviewNote || '',
      '冲突字段': conflict ? conflict.conflictingFields.map((f) => f.field).join('、') : '',
      '冲突处理方案': conflict?.resolution || '',
      '冲突处理说明': conflict?.resolutionNote || '',
    }
  })

  return exportRows
}

function exportToExcel(): Buffer {
  const data = getExportData()
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '对账结果')

  const stats = billRecordRepo.getRecordCounts()
  const statsData = [
    { '统计项': '顺利记录', '数量': stats.smooth },
    { '统计项': '断档记录', '数量': stats.gap },
    { '统计项': '补录记录', '数量': stats.supplement },
    { '统计项': '冲突记录', '数量': stats.conflict },
    { '统计项': '总计', '数量': stats.smooth + stats.gap + stats.supplement + stats.conflict },
  ]
  const statsSheet = XLSX.utils.json_to_sheet(statsData)
  XLSX.utils.book_append_sheet(workbook, statsSheet, '统计汇总')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return buffer as Buffer
}

function exportToCSV(): string {
  const data = getExportData()
  const worksheet = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  return csv
}

export { getExportData, exportToExcel, exportToCSV }
