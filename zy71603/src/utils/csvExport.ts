import type { AnomalyRecord, DetailItem } from "@/engine/types"

function escapeCSV(val: unknown): string {
  const s = String(val ?? "")
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportAnomaliesToCSV(anomalies: AnomalyRecord[]): void {
  const headers = ["步骤", "类别", "严重程度", "来源编号", "描述", "影响说明"]
  const rows = anomalies.map((a) => [
    a.stepLabel,
    a.category,
    a.severity === "error" ? "严重" : a.severity === "warning" ? "警告" : "提示",
    a.sourceId,
    a.description,
    a.impact,
  ])
  downloadCSV(headers, rows, "异常留痕清单")
}

export function exportDetailItemsToCSV(items: DetailItem[], title: string): void {
  if (items.length === 0) return
  const keys = Object.keys(items[0]).filter((k) => k !== "id" && typeof items[0][k] !== "object")
  const headers = keys
  const rows = items.map((item) => keys.map((k) => item[k]))
  downloadCSV(headers, rows, title)
}

function downloadCSV(headers: string[], rows: unknown[][], filename: string): void {
  const bom = "\uFEFF"
  const headerLine = headers.map(escapeCSV).join(",")
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","))
  const csv = bom + [headerLine, ...dataLines].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
