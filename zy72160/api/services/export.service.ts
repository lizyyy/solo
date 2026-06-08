import xlsx from 'xlsx'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getMergedPointsByBatch } from '../repositories/merged-point.repo.js'
import { getAnomaliesByBatch } from '../repositories/anomaly.repo.js'
import { createAuditLog } from '../repositories/audit-log.repo.js'
import type { MergedPoint, Anomaly } from '../../shared/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function exportToExcel(batchId: string, filters?: { district?: string; businessType?: string; conflictStatus?: string }) {
  let points = getMergedPointsByBatch(batchId)

  if (filters?.businessType) {
    points = points.filter(p => p.businessType === filters.businessType)
  }
  if (filters?.conflictStatus) {
    points = points.filter(p => p.conflictStatus === filters.conflictStatus)
  }

  const anomalies = getAnomaliesByBatch(batchId)
  const anomalyMap = new Map<string, Anomaly[]>()
  for (const a of anomalies) {
    const list = anomalyMap.get(a.mergedPointId) || []
    list.push(a)
    anomalyMap.set(a.mergedPointId, list)
  }

  const wb = xlsx.utils.book_new()

  const header = ['GIS编号', '地址', '业态', '面积(㎡)', '来源数量', '冲突状态', '备注', '异常描述']
  const rows = points.map(p => {
    const pointAnomalies = anomalyMap.get(p.id) || []
    return [
      p.gisId,
      p.address,
      p.businessType,
      p.area,
      p.sourceCount,
      p.conflictStatus === 'none' ? '无冲突' : p.conflictStatus === 'conflict' ? '有冲突' : '已解决',
      p.originalNotes,
      pointAnomalies.map(a => a.humanReadable).join('；'),
    ]
  })

  const ws = xlsx.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [
    { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 40 },
  ]
  xlsx.utils.book_append_sheet(wb, ws, '合并点位数据')

  const anomalyHeader = ['地址', '异常类型', '异常描述', '检测时间']
  const anomalyRows = anomalies.map(a => {
    const point = points.find(p => p.id === a.mergedPointId)
    return [point?.address || '', a.type, a.humanReadable, a.detectedAt]
  })
  const ws2 = xlsx.utils.aoa_to_sheet([anomalyHeader, ...anomalyRows])
  xlsx.utils.book_append_sheet(wb, ws2, '异常记录')

  const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  const outputPath = path.join(uploadsDir, `export_${batchId}_${Date.now()}.xlsx`)
  xlsx.writeFile(wb, outputPath)

  createAuditLog({
    batchId,
    action: 'export',
    detail: `导出Excel文件，包含 ${points.length} 条合并点位数据`,
    relatedId: batchId,
  })

  return outputPath
}

export function exportToPdf(batchId: string, filters?: { district?: string; businessType?: string; conflictStatus?: string }) {
  let points = getMergedPointsByBatch(batchId)

  if (filters?.businessType) {
    points = points.filter(p => p.businessType === filters.businessType)
  }
  if (filters?.conflictStatus) {
    points = points.filter(p => p.conflictStatus === filters.conflictStatus)
  }

  const anomalies = getAnomaliesByBatch(batchId)

  const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  const outputPath = path.join(uploadsDir, `export_${batchId}_${Date.now()}.pdf`)

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const stream = fs.createWriteStream(outputPath)
  doc.pipe(stream)

  const fontPath = '/System/Library/Fonts/PingFang.ttc'
  if (fs.existsSync(fontPath)) {
    doc.registerFont('Chinese', fontPath)
    doc.font('Chinese')
  }

  doc.fontSize(20).text('历史街区业态更新管理报告', { align: 'center' })
  doc.moveDown()
  doc.fontSize(12).text(`生成时间：${new Date().toLocaleString('zh-CN')}`)
  doc.moveDown(0.5)
  doc.text(`合并点位总数：${points.length}`)
  doc.text(`异常总数：${anomalies.length}`)
  doc.moveDown()

  doc.fontSize(14).text('合并点位数据')
  doc.moveDown(0.5)

  for (const point of points) {
    doc.fontSize(10)
    doc.text(`地址：${point.address}`, { continued: false })
    doc.text(`  GIS编号：${point.gisId} | 业态：${point.businessType} | 面积：${point.area}㎡`)
    doc.text(`  来源数量：${point.sourceCount} | 冲突状态：${point.conflictStatus}`)
    if (point.originalNotes) {
      doc.text(`  备注：${point.originalNotes}`)
    }
    doc.moveDown(0.3)
  }

  if (anomalies.length > 0) {
    doc.moveDown()
    doc.fontSize(14).text('异常记录')
    doc.moveDown(0.5)

    for (const a of anomalies) {
      doc.fontSize(10)
      const point = points.find(p => p.id === a.mergedPointId)
      doc.text(`地址：${point?.address || '未知'} | 类型：${a.type}`)
      doc.text(`  ${a.humanReadable}`)
      doc.moveDown(0.3)
    }
  }

  doc.end()

  createAuditLog({
    batchId,
    action: 'export',
    detail: `导出PDF文件，包含 ${points.length} 条合并点位数据`,
    relatedId: batchId,
  })

  return new Promise<string>((resolve) => {
    stream.on('finish', () => resolve(outputPath))
  })
}
