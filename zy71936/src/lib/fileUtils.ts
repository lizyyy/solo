import * as XLSX from "xlsx"
import Papa from "papaparse"
import type { FieldMapping } from "./types"

export interface ParsedData {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCSV(content: string): ParsedData {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  })
  return {
    headers: result.meta.fields || [],
    rows: result.data as Record<string, string>[],
  }
}

export function parseExcel(buffer: ArrayBuffer): ParsedData {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

export function autoMapFields(headers: string[]): FieldMapping[] {
  const keywordMap: Record<string, string[]> = {
    fileName: ["文件名", "文件", "filename", "file_name", "name"],
    shootDate: ["拍摄日期", "日期", "shoot_date", "date", "拍摄时间"],
    sourceType: ["来源类型", "来源", "source", "source_type", "类型"],
    authorizationStatus: ["授权状态", "状态", "auth_status", "authorization", "授权"],
    authorizationExpiry: ["授权到期", "到期日", "expiry", "auth_expiry", "过期日期", "到期日期"],
    authorizationContact: ["授权联系人", "联系人", "contact", "auth_contact", "负责人"],
    reviewOpinion: ["审稿意见", "意见", "review", "opinion", "审核意见"],
    specVersion: ["规格版本", "版本", "spec", "version", "spec_version"],
  }

  return headers.map((header) => {
    const lowerHeader = header.toLowerCase().trim()
    let matchedTarget = ""
    for (const [target, keywords] of Object.entries(keywordMap)) {
      for (const keyword of keywords) {
        if (lowerHeader.includes(keyword.toLowerCase())) {
          matchedTarget = target
          break
        }
      }
      if (matchedTarget) break
    }
    return { source: header, target: matchedTarget }
  })
}

export function applyMapping(
  rows: Record<string, string>[],
  mappings: FieldMapping[]
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {}
    for (const mapping of mappings) {
      if (mapping.target) {
        mapped[mapping.target] = row[mapping.source] || ""
      }
    }
    return mapped
  })
}

export function exportToCSV(data: Record<string, string>[], columns: string[]): string {
  return Papa.unparse(data, { columns })
}

export function exportToExcel(data: Record<string, string>[], columns: string[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(data, { header: columns })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "摄影选片标记")
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
}

export function downloadFile(content: string | ArrayBuffer, filename: string, type: string) {
  const blob =
    content instanceof ArrayBuffer
      ? new Blob([content], { type })
      : new Blob([content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
