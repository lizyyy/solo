import { create } from 'zustand'
import type { InspectionReport, RiskItem, ChangeOrder } from '@/types'
import { generateReport, exportToCSV } from '@/engine/reportGenerator'

interface ReportState {
  currentReport: InspectionReport | null
  isGenerating: boolean
  generate: (risks: RiskItem[], changeOrders: ChangeOrder[], title?: string) => void
  exportPDF: () => void
  exportExcel: () => void
}

export const useReportStore = create<ReportState>((set, get) => ({
  currentReport: null,
  isGenerating: false,
  generate: (risks, changeOrders, title) => {
    set({ isGenerating: true })
    const report = generateReport(risks, changeOrders, title)
    set({ currentReport: report, isGenerating: false })
  },
  exportPDF: async () => {
    const report = get().currentReport
    if (!report) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(report.title, 20, 20)
    doc.setFontSize(11)
    const lines = report.summary.split('\n')
    let y = 35
    for (const line of lines) {
      doc.text(line, 20, y)
      y += 7
    }
    y += 10
    doc.setFontSize(14)
    doc.text('Risk Items', 20, y)
    y += 8
    doc.setFontSize(10)
    for (const risk of report.topRisks) {
      const riskText = `[${risk.severity.toUpperCase()}] ${risk.riskType}: ${risk.description}`
      const splitLines = doc.splitTextToSize(riskText, 170)
      for (const sl of splitLines) {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        doc.text(sl, 20, y)
        y += 6
      }
      y += 3
    }
    doc.save(`${report.title}.pdf`)
  },
  exportExcel: async () => {
    const report = get().currentReport
    if (!report) return
    const XLSX = await import('xlsx')
    const csvContent = exportToCSV(report)
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      [report.title],
      [],
      ['Summary'],
      ...report.summary.split('\n').map((l) => [l]),
      [],
      ['Type', 'Severity', 'Description', 'Impact', 'Status'],
      ...report.topRisks.map((r) => [r.riskType, r.severity, r.description, r.impactRange, r.status]),
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, `${report.title}.xlsx`)
  },
}))
