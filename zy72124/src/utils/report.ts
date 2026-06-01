import type { Report } from "@/types"

export function generateReport(report: Report): string {
  return JSON.stringify(report, null, 2)
}

export function downloadReport(report: Report): void {
  const content = generateReport(report)
  const blob = new Blob([content], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `mooring-force-report-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
