import Papa from 'papaparse'
import type { ImportRow } from '@/types'

export function parseCSV(text: string): ImportRow[] {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  })
  return result.data.map((row) => mapRow(row as Record<string, string>))
}

export function parseJSON(text: string): ImportRow[] {
  const data = JSON.parse(text)
  const arr = Array.isArray(data) ? data : data.records ?? []
  return arr.map((row: Record<string, string>) => mapRow(row))
}

function mapRow(row: Record<string, string>): ImportRow {
  return {
    fontName: row.fontName || row['字体名称'] || row['字体'] || '',
    foundry: row.foundry || row['厂商'] || row['字体厂商'] || '',
    licenseType: row.licenseType || row['授权类型'] || '',
    expiryDate: row.expiryDate || row['到期日'] || row['过期日期'] || undefined,
    usageScope: row.usageScope || row['使用范围'] || undefined,
    colorCardName: row.colorCardName || row['色卡名称'] || undefined,
    colorCardVersion: row.colorCardVersion || row['色卡版本'] || undefined,
    customNotes: row.customNotes || row['备注'] || row['说明'] || undefined,
  }
}
