import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { Exposure, HedgeContract, Anomaly, ExposureSummary } from '@/types'
import { exportToExcel } from './parser'

export async function captureScreenshot(elementId: string): Promise<string> {
  const el = document.getElementById(elementId)
  if (!el) throw new Error('Element not found')
  const canvas = await html2canvas(el, {
    backgroundColor: '#0A1628',
    scale: 2,
    useCORS: true,
  })
  return canvas.toDataURL('image/png')
}

export function downloadScreenshot(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export function exportPDF(
  screenshotUrl: string,
  summary: ExposureSummary,
  exposures: Exposure[],
  hedgeContracts: HedgeContract[],
  anomalies: Anomaly[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFillColor(10, 22, 40)
  doc.rect(0, 0, 297, 210, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.text('FX Exposure Report', 15, 20)

  doc.setFontSize(10)
  doc.setTextColor(136, 153, 170)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 28)

  doc.addImage(screenshotUrl, 'PNG', 15, 35, 130, 75)

  doc.setFontSize(12)
  doc.setTextColor(0, 229, 160)
  doc.text('Exposure Summary', 155, 40)
  doc.setFontSize(9)
  doc.setTextColor(200, 210, 220)
  const lines = [
    `Total Long: ${fmtNum(summary.totalLong)}`,
    `Total Short: ${fmtNum(summary.totalShort)}`,
    `Net Exposure: ${fmtNum(summary.netExposure)}`,
    `Natural Hedge Ratio: ${(summary.naturalHedgeRatio * 100).toFixed(1)}%`,
    `Hedge Coverage: ${(summary.hedgeCoverageRatio * 100).toFixed(1)}%`,
  ]
  lines.forEach((l, i) => doc.text(l, 155, 48 + i * 6))

  doc.setFontSize(11)
  doc.setTextColor(255, 107, 107)
  doc.text('Anomalies', 15, 120)
  doc.setFontSize(8)
  doc.setTextColor(200, 210, 220)
  anomalies.slice(0, 8).forEach((a, i) => {
    doc.text(`[${a.severity}] ${a.description}`, 15, 128 + i * 5)
  })

  doc.save('fx-exposure-report.pdf')
}

export function exportExcel(
  exposures: Exposure[],
  hedgeContracts: HedgeContract[],
  anomalies: Anomaly[]
): void {
  exportToExcel(
    {
      Exposures: exposures.map((e) => ({
        Subsidiary: e.subsidiaryId,
        Currency: e.currencyCode,
        Amount: e.amount,
        Direction: e.direction,
        DueDate: e.dueDate,
        Hedged: e.hedged,
        HedgeContract: e.hedgeContractNo,
        ManualNote: e.manualNote,
        OriginalRaw: e.originalRaw,
      })),
      HedgeContracts: hedgeContracts.map((h) => ({
        ContractNo: h.contractNo,
        Subsidiary: h.subsidiaryId,
        Currency: h.currencyCode,
        NotionalAmount: h.notionalAmount,
        Direction: h.direction,
        DueDate: h.dueDate,
        HedgeType: h.hedgeType,
        Counterparty: h.counterparty,
        ManualNote: h.manualNote,
      })),
      Anomalies: anomalies.map((a) => ({
        Type: a.type,
        Severity: a.severity,
        Description: a.description,
        Resolution: a.resolution,
        UserNote: a.userNote,
      })),
    },
    'fx-exposure-report.xlsx'
  )
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toFixed(2)
}
