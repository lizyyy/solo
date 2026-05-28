import type { Subsidiary, Currency, Exposure, HedgeContract, ExchangeRate } from '@/types'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type DataType = 'subsidiary' | 'currency' | 'exposure' | 'hedge' | 'rate' | 'report'

interface ParseResult {
  type: DataType
  data: Subsidiary[] | Currency[] | Exposure[] | HedgeContract[] | ExchangeRate[]
  warnings: string[]
  rawRows: string[]
}

function genId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

export function parseCSV(content: string, type: DataType): ParseResult {
  const result = Papa.parse(content, { header: true, skipEmptyLines: true })
  const warnings: string[] = []
  const rawRows = result.data.map((r: Record<string, string>) => JSON.stringify(r))

  if (result.errors.length > 0) {
    result.errors.forEach((e) => warnings.push(`CSV解析警告: 行${e.row} - ${e.message}`))
  }

  return transformRows(result.data as Record<string, string>[], type, warnings, rawRows)
}

export function parseExcel(buffer: ArrayBuffer, type: DataType): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
  const warnings: string[] = []
  const rawRows = rows.map((r) => JSON.stringify(r))

  return transformRows(rows, type, warnings, rawRows)
}

function transformRows(
  rows: Record<string, string>[],
  type: DataType,
  warnings: string[],
  rawRows: string[]
): ParseResult {
  switch (type) {
    case 'subsidiary': {
      const data: Subsidiary[] = rows.map((r) => ({
        id: genId(),
        code: r['公司编码'] || r['code'] || '',
        name: r['公司名称'] || r['name'] || '',
        region: r['所属区域'] || r['region'] || '',
        functionalCurrency: r['功能货币'] || r['functionalCurrency'] || 'CNY',
        consolidationLevel: parseInt(r['合并层级'] || r['consolidationLevel'] || '0', 10),
      }))
      return { type, data, warnings, rawRows }
    }
    case 'currency': {
      const data: Currency[] = rows.map((r) => ({
        code: r['币种代码'] || r['code'] || '',
        name: r['币种名称'] || r['name'] || '',
      }))
      return { type, data, warnings, rawRows }
    }
    case 'exposure': {
      const data: Exposure[] = rows.map((r) => {
        const amt = parseFloat(r['金额'] || r['amount'] || '0')
        const dir = (r['方向'] || r['direction'] || '').toUpperCase()
        const direction = dir === '收' || dir === 'RECEIVE' || dir === 'LONG' ? 'LONG' : 'SHORT'
        if (isNaN(amt)) warnings.push(`金额解析失败: ${r['金额'] || r['amount']}`)
        return {
          id: genId(),
          subsidiaryId: r['子公司编码'] || r['subsidiaryId'] || '',
          currencyCode: r['币种'] || r['currencyCode'] || '',
          amount: amt,
          direction,
          dueDate: r['到期日'] || r['dueDate'] || '',
          contractNo: r['合同编号'] || r['contractNo'] || '',
          originalRaw: rawRows[0] || JSON.stringify(r),
          manualNote: r['手工备注'] || r['manualNote'] || '',
          source: 'import',
          hedged: false,
          hedgeContractNo: '',
        }
      })
      return { type, data, warnings, rawRows }
    }
    case 'hedge': {
      const data: HedgeContract[] = rows.map((r) => {
        const amt = parseFloat(r['名义金额'] || r['notionalAmount'] || '0')
        const dir = (r['方向'] || r['direction'] || '').toUpperCase()
        const direction = dir === '买' || dir === 'LONG' || dir === 'BUY' ? 'LONG' : 'SHORT'
        return {
          id: genId(),
          contractNo: r['合约编号'] || r['contractNo'] || '',
          subsidiaryId: r['子公司编码'] || r['subsidiaryId'] || '',
          currencyCode: r['币种'] || r['currencyCode'] || '',
          notionalAmount: amt,
          direction,
          dueDate: r['到期日'] || r['dueDate'] || '',
          hedgeType: r['套保工具类型'] || r['hedgeType'] || '',
          counterparty: r['对手方'] || r['counterparty'] || '',
          originalRaw: JSON.stringify(r),
          manualNote: r['手工备注'] || r['manualNote'] || '',
        }
      })
      return { type, data, warnings, rawRows }
    }
    case 'rate': {
      const data: ExchangeRate[] = rows.map((r) => ({
        id: genId(),
        pair: r['币种对'] || r['pair'] || '',
        spotRate: parseFloat(r['即期汇率'] || r['spotRate'] || '0'),
        forwardRate: parseFloat(r['远期汇率'] || r['forwardRate'] || '0'),
        rateDate: r['汇率日期'] || r['rateDate'] || '',
      }))
      return { type, data, warnings, rawRows }
    }
    default: {
      return { type, data: [], warnings: ['未知数据类型'], rawRows: [] }
    }
  }
}

export function exportToExcel(data: Record<string, unknown[]>, filename: string): void {
  const wb = XLSX.utils.book_new()
  Object.entries(data).forEach(([sheetName, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })
  XLSX.writeFile(wb, filename)
}
