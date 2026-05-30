import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toKg, type RiggingPoint, type ForceDecomposition, type LoadVerification, type RiskItem } from '../../shared/types.js'
import * as schemeService from './scheme.service.js'
import * as calculationService from './calculation.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPORTS_DIR = path.join(__dirname, '..', 'data', 'reports')

const PAGE_WIDTH = 595.28
const PAGE_MARGIN = 50

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

function drawHorizontalLine(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_WIDTH - PAGE_MARGIN, y)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke()
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colWidths: number[],
  startY: number
): number {
  const rowHeight = 18
  const headerHeight = 22
  let y = startY

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
  let x = PAGE_MARGIN
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, y + 4, { width: colWidths[i], align: 'left' })
    x += colWidths[i]
  }
  y += headerHeight
  drawHorizontalLine(doc, y)

  doc.font('Helvetica').fontSize(8).fillColor('#000000')
  for (const row of rows) {
    if (y + rowHeight > 780) {
      doc.addPage()
      y = PAGE_MARGIN
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
      let hx = PAGE_MARGIN
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], hx, y + 4, { width: colWidths[i], align: 'left' })
        hx += colWidths[i]
      }
      y += headerHeight
      drawHorizontalLine(doc, y)
      doc.font('Helvetica').fontSize(8).fillColor('#000000')
    }

    x = PAGE_MARGIN
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i], x, y + 3, { width: colWidths[i], align: 'left' })
      x += colWidths[i]
    }
    y += rowHeight
  }

  y += 4
  drawHorizontalLine(doc, y)
  return y + 10
}

export function generateReport(schemeId: string): Promise<string> {
  const detail = schemeService.getSchemeDetail(schemeId)
  const decompositions = calculationService.decompose(schemeId)
  const verifications = calculationService.verify(schemeId)

  ensureReportsDir()

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `report_${schemeId}_${timestamp}.pdf`
  const filepath = path.join(REPORTS_DIR, filename)

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN })
  const stream = fs.createWriteStream(filepath)
  doc.pipe(stream)

  doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000')
  doc.text('Rigging Load Estimation Report', { align: 'center' })
  doc.moveDown(0.5)

  doc.fontSize(12).font('Helvetica')
  doc.text(`Scheme: ${detail.scheme.name}`)
  doc.text(`Date: ${new Date().toISOString().split('T')[0]}`)
  doc.text(`Status: ${detail.scheme.status}`)
  doc.text(`Safety Factor: ${detail.scheme.safetyFactor}`)
  doc.moveDown(1.5)

  doc.fontSize(14).font('Helvetica-Bold')
  doc.text('Rigging Points', { underline: true })
  doc.moveDown(0.5)

  const pointHeaders = ['Label', 'X', 'Y', 'Rated Load(kg)', 'Actual Load(kg)', 'Load Ratio', 'Status']
  const pointRows = detail.points.map((p: RiggingPoint) => {
    const v = verifications.find((v: LoadVerification) => v.pointId === p.id)
    return [
      p.label,
      String(p.x),
      String(p.y),
      toKg(p.ratedLoad, p.ratedLoadUnit).toFixed(1),
      v ? v.actualLoadKg.toFixed(1) : '-',
      v ? v.loadRatio.toFixed(2) : '-',
      v ? v.status : '-'
    ]
  })
  const pointColWidths = [70, 55, 55, 85, 85, 75, 70]
  let currentY = drawTable(doc, pointHeaders, pointRows, pointColWidths, doc.y)
  doc.y = currentY
  doc.moveDown(0.5)

  doc.fontSize(14).font('Helvetica-Bold')
  doc.text('Force Decomposition', { underline: true })
  doc.moveDown(0.5)

  const decompHeaders = ['Point', 'Total Weight(kg)', 'Vertical Force(N)', 'Horizontal Force(N)', 'Angle(deg)', 'Direction']
  const decompRows = decompositions.map((d: ForceDecomposition) => [
    d.pointLabel,
    d.totalWeightKg.toFixed(1),
    d.verticalForceN.toFixed(1),
    d.horizontalForceN.toFixed(1),
    d.angleDeg.toFixed(1),
    d.angleDirection
  ])
  const decompColWidths = [70, 95, 95, 95, 70, 70]
  currentY = drawTable(doc, decompHeaders, decompRows, decompColWidths, doc.y)
  doc.y = currentY
  doc.moveDown(0.5)

  doc.fontSize(14).font('Helvetica-Bold')
  doc.text('Risk Summary', { underline: true })
  doc.moveDown(0.5)

  const riskHeaders = ['Severity', 'Category', 'Message', 'Status']
  const riskRows = detail.risks.map((r: RiskItem) => [
    r.severity,
    r.category,
    r.message,
    r.status
  ])
  const riskColWidths = [70, 100, 225, 75]
  drawTable(doc, riskHeaders, riskRows, riskColWidths, doc.y)

  doc.end()

  return new Promise<string>((resolve, reject) => {
    stream.on('finish', () => resolve(filename))
    stream.on('error', reject)
  })
}

export function getReportPath(filename: string): string {
  return path.join(REPORTS_DIR, filename)
}
