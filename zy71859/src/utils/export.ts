import * as XLSX from 'xlsx'
import { PracticeRecord, Part } from '@/types'

export function exportRecordsToExcel(
  records: PracticeRecord[],
  parts: Part[],
  filename: string = '焊接练习记录.xlsx'
) {
  const partMap = new Map(parts.map((p) => [p.id, p]))

  const data = records.map((record) => {
    const part = partMap.get(record.partId)
    return {
      '学生姓名': record.studentName,
      '学号': record.studentId,
      '练习日期': new Date(record.practiceDate).toLocaleDateString('zh-CN'),
      '状态': getStatusText(record.status),
      '分数': record.score,
      '使用零件': part?.name || record.partId,
      '零件规格': part?.specification || '-',
      '操作员': record.operator,
      '备注': record.remark || '-',
      '记录ID': record.id,
    }
  })

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '练习记录')
  XLSX.writeFile(wb, filename)
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '进行中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}
