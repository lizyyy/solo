import Papa from 'papaparse'
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { FileFormat } from '../../shared/types'

export interface ParseOptions {
  delimiter?: string
  hasHeader?: boolean
  sheetName?: string
  skipRows?: number
}

export interface ParsedData {
  headers: string[]
  rows: Record<string, any>[]
  totalRows: number
}

export class FileParser {
  async parse(
    filePath: string,
    format: FileFormat,
    options: ParseOptions = {}
  ): Promise<ParsedData> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`)
    }

    switch (format.toLowerCase() as FileFormat) {
      case 'csv':
        return this.parseCsv(filePath, options)
      case 'xlsx':
      case 'xls':
        return this.parseExcel(filePath, options)
      default:
        throw new Error(`不支持的文件格式: ${format}`)
    }
  }

  private async parseCsv(
    filePath: string,
    options: ParseOptions
  ): Promise<ParsedData> {
    const content = fs.readFileSync(filePath, 'utf-8')
    
    const result = Papa.parse(content, {
      header: options.hasHeader !== false,
      delimiter: options.delimiter || ',',
      skipEmptyLines: true,
      dynamicTyping: false
    })

    if (result.errors.length > 0) {
      throw new Error(`CSV解析错误: ${result.errors.map(e => e.message).join(', ')}`)
    }

    const rows = result.data as Record<string, any>[]
    const headers = Array.isArray(rows[0]) 
      ? rows[0].map((h: any) => String(h)) 
      : Object.keys(rows[0])

    return {
      headers,
      rows: this.normalizeRows(rows, headers),
      totalRows: rows.length
    }
  }

  private async parseExcel(
    filePath: string,
    options: ParseOptions
  ): Promise<ParsedData> {
    const workbook = XLSX.readFile(filePath, { type: 'file', cellDates: true })
    const sheetName = options.sheetName || workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    if (!sheet) {
      throw new Error(`工作表不存在: ${sheetName}`)
    }

    const data = XLSX.utils.sheet_to_json(sheet, {
      header: options.hasHeader !== false ? 1 : 'A',
      defval: ''
    })

    if (!data || data.length === 0) {
      return { headers: [], rows: [], totalRows: 0 }
    }

    const rows = data as Record<string, any>[]
    const headers = options.hasHeader !== false 
      ? rows[0] as string[]
      : Object.keys(rows[0] || {})

    const actualRows = options.hasHeader !== false ? rows.slice(1) : rows

    return {
      headers: headers.map(h => String(h)),
      rows: this.normalizeRows(actualRows, headers),
      totalRows: actualRows.length
    }
  }

  private normalizeRows(
    rows: Record<string, any>[],
    headers: string[]
  ): Record<string, any>[] {
    return rows.map((row, index) => {
      if (Array.isArray(row)) {
        const obj: Record<string, any> = {}
        headers.forEach((header, i) => {
          obj[header] = row[i] !== undefined ? String(row[i]).trim() : ''
        })
        return obj
      }
      
      const normalized: Record<string, any> = {}
      headers.forEach(header => {
        normalized[header] = row[header] !== undefined 
          ? String(row[header]).trim() 
          : ''
      })
      return normalized
    })
  }

  getSampleData(filePath: string, format: FileFormat, count: number = 5): Promise<ParsedData> {
    return this.parse(filePath, format, { hasHeader: true }).then(result => ({
      headers: result.headers,
      rows: result.rows.slice(0, count),
      totalRows: count
    }))
  }
}

export const fileParser = new FileParser()
