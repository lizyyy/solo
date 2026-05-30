import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import { ImportRowError, BusinessError } from '../errors.js'
import { recalculateAllRiskRates } from './riskCalculator.js'
import XLSX from 'xlsx'
import { parse as csvParse } from 'csv-parse/sync'

interface ParsedRow {
  data: Record<string, any>
  dataType: string
}

export function uploadFiles(files: Express.Multer.File[]): {
  batchId: string
  totalRows: number
  successRows: number
  errorRows: number
  errors: ImportRowError[]
} {
  const db = getDb()
  const allErrors: ImportRowError[] = []
  const allRows: { rowNumber: number; dataType: string; rawContent: string; parsed: Record<string, any> | null }[] = []

  for (const file of files) {
    const fileName = file.originalname
    const ext = fileName.toLowerCase().split('.').pop()
    let rows: ParsedRow[] = []

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        rows = parseXlsx(file.buffer, fileName)
      } else if (ext === 'csv') {
        rows = parseCsv(file.buffer, fileName)
      } else {
        allErrors.push(new ImportRowError(fileName, 0, `不支持的文件格式: ${ext}`))
        continue
      }
    } catch (e: any) {
      allErrors.push(new ImportRowError(fileName, 0, `文件解析失败: ${e.message}`))
      continue
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2
      const rawContent = JSON.stringify(row.data)

      const validation = validateRow(row.data, row.dataType, fileName, rowNumber)
      if (validation) {
        allErrors.push(validation)
        allRows.push({ rowNumber, dataType: row.dataType, rawContent, parsed: null })
      } else {
        allRows.push({ rowNumber, dataType: row.dataType, rawContent, parsed: row.data })
      }
    }
  }

  const batchId = uuidv4()
  const now = new Date().toISOString()

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO import_batches (id, file_name, file_type, status, total_rows, success_rows, error_rows, created_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(
      batchId,
      files.map(f => f.originalname).join(','),
      'mixed',
      allRows.length,
      allRows.length - allErrors.length,
      allErrors.length,
      now
    )

    const insertRecord = db.prepare(`
      INSERT INTO import_records (id, batch_id, row_number, data_type, raw_content, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    for (const row of allRows) {
      const error = allErrors.find(e => e.sourceFile === files[0]?.originalname && e.rowNumber === row.rowNumber)
      const recordId = uuidv4()
      insertRecord.run(
        recordId,
        batchId,
        row.rowNumber,
        row.dataType,
        row.rawContent,
        error ? 'error' : 'pending',
        error?.reason || null
      )
    }
  })
  transaction()

  return {
    batchId,
    totalRows: allRows.length,
    successRows: allRows.length - allErrors.length,
    errorRows: allErrors.length,
    errors: allErrors,
  }
}

function parseXlsx(buffer: Buffer, fileName: string): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const results: ParsedRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

    for (const row of rows) {
      const dataType = inferDataType(row)
      results.push({ data: row, dataType })
    }
  }

  return results
}

function parseCsv(buffer: Buffer, fileName: string): ParsedRow[] {
  const content = buffer.toString('utf-8')
  const rows = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, any>[]

  return rows.map(row => ({
    data: row,
    dataType: inferDataType(row),
  }))
}

function inferDataType(row: Record<string, any>): string {
  const keys = Object.keys(row).map(k => k.toLowerCase())
  if (keys.some(k => k.includes('account') || k.includes('客户') || k.includes('账号'))) return 'client'
  if (keys.some(k => k.includes('contract') || k.includes('合约') || k.includes('代码'))) return 'contract'
  if (keys.some(k => k.includes('position') || k.includes('持仓') || k.includes('方向'))) return 'position'
  if (keys.some(k => k.includes('deposit') || k.includes('入金') || k.includes('金额'))) return 'deposit'
  if (keys.some(k => k.includes('price') || k.includes('行情') || k.includes('收盘'))) return 'market'
  return 'unknown'
}

function validateRow(data: Record<string, any>, dataType: string, sourceFile: string, rowNumber: number): ImportRowError | null {
  const db = getDb()

  try {
    switch (dataType) {
      case 'client': {
        if (!data.name && !data['客户名称'] && !data['姓名']) {
          return new ImportRowError(sourceFile, rowNumber, '客户名称不能为空')
        }
        if (!data.account && !data['账号'] && !data['账户']) {
          return new ImportRowError(sourceFile, rowNumber, '客户账号不能为空')
        }
        break
      }
      case 'contract': {
        if (!data.code && !data['合约代码']) {
          return new ImportRowError(sourceFile, rowNumber, '合约代码不能为空')
        }
        break
      }
      case 'position': {
        const clientAccount = data.account || data['账号'] || data['客户账号']
        if (!clientAccount) {
          return new ImportRowError(sourceFile, rowNumber, '持仓记录缺少客户账号', clientAccount)
        }
        const client = db.prepare('SELECT id FROM clients WHERE account = ?').get(clientAccount)
        if (!client) {
          return new ImportRowError(sourceFile, rowNumber, `客户账号 ${clientAccount} 不存在`, clientAccount)
        }
        break
      }
      case 'deposit': {
        const amount = data.amount || data['金额'] || data['入金金额']
        if (!amount || isNaN(Number(amount))) {
          return new ImportRowError(sourceFile, rowNumber, '入金金额无效')
        }
        if (Number(amount) <= 0) {
          return new ImportRowError(sourceFile, rowNumber, '入金金额必须大于0')
        }
        break
      }
      case 'market': {
        const price = data.last_price || data['最新价'] || data['收盘价']
        if (!price || isNaN(Number(price))) {
          return new ImportRowError(sourceFile, rowNumber, '行情价格无效')
        }
        break
      }
      default:
        return new ImportRowError(sourceFile, rowNumber, '无法识别数据类型，请检查列名')
    }
  } catch (e: any) {
    return new ImportRowError(sourceFile, rowNumber, `校验异常: ${e.message}`)
  }

  return null
}

export function confirmImport(batchId: string): {
  merged: number
  preserved: number
  risk_updated: number
  errors: string[]
} {
  const db = getDb()

  const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    throw new BusinessError(`导入批次 ${batchId} 不存在`, { severity: 'error' })
  }
  if (batch.status !== 'pending') {
    throw new BusinessError(`批次状态为${batch.status}，只有待确认状态才能确认导入`, { severity: 'warning' })
  }

  const records = db.prepare('SELECT * FROM import_records WHERE batch_id = ? AND status = ?').all(batchId, 'pending') as any[]
  const errors: string[] = []
  const merged = { clients: 0, contracts: 0, positions: 0, deposits: 0, market: 0 }

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE import_batches SET status = 'confirmed' WHERE id = ?`).run(batchId)

    for (const record of records) {
      const data = JSON.parse(record.raw_content)
      try {
        switch (record.data_type) {
          case 'client': {
            const name = data.name || data['客户名称'] || data['姓名']
            const account = data.account || data['账号'] || data['账户']
            const equity = Number(data.equity || data['权益'] || data['净值'] || 0)
            const existing = db.prepare('SELECT id FROM clients WHERE account = ?').get(account) as any
            if (existing) {
              db.prepare(`UPDATE clients SET name = ?, equity = ?, updated_at = datetime('now') WHERE account = ?`).run(name, equity, account)
            } else {
              db.prepare(`INSERT INTO clients (id, name, account, equity, margin_used, risk_rate, risk_level) VALUES (?, ?, ?, ?, 0, 0, 'safe')`).run(uuidv4(), name, account, equity)
            }
            merged.clients++
            break
          }
          case 'contract': {
            const code = data.code || data['合约代码']
            const name = data.name || data['合约名称'] || code
            const exchange = data.exchange || data['交易所'] || 'UNKNOWN'
            const existing = db.prepare('SELECT id FROM contracts WHERE code = ?').get(code) as any
            if (!existing) {
              db.prepare(`INSERT INTO contracts (id, code, name, exchange) VALUES (?, ?, ?, ?)`).run(uuidv4(), code, name, exchange)
            }
            merged.contracts++
            break
          }
          case 'position': {
            const account = data.account || data['账号'] || data['客户账号']
            const client = db.prepare('SELECT id FROM clients WHERE account = ?').get(account) as any
            const contractCode = data.contract_code || data['合约代码'] || data.code
            const contract = db.prepare('SELECT id FROM contracts WHERE code = ?').get(contractCode) as any
            if (client && contract) {
              const direction = (data.direction || data['方向'] || 'long').toLowerCase() === '空' || (data.direction || '').toLowerCase() === 'short' ? 'short' : 'long'
              const volume = Number(data.volume || data['手数'] || 0)
              const openPrice = Number(data.open_price || data['开仓价'] || 0)
              const margin = Number(data.margin || data['保证金'] || 0)
              db.prepare(`INSERT INTO positions (id, client_id, contract_id, direction, volume, open_price, margin) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), client.id, contract.id, direction, volume, openPrice, margin)
            }
            merged.positions++
            break
          }
          case 'deposit': {
            const account = data.account || data['账号'] || data['客户账号']
            const client = db.prepare('SELECT id FROM clients WHERE account = ?').get(account) as any
            const amount = Number(data.amount || data['金额'] || data['入金金额'])
            const depositTime = data.deposit_time || data['入金时间'] || new Date().toISOString()
            if (client && amount > 0) {
              db.prepare(`INSERT INTO deposits (id, client_id, amount, deposit_time, match_status, source_file, source_line) VALUES (?, ?, ?, ?, 'unmatched', ?, ?)`).run(uuidv4(), client.id, amount, depositTime, record.raw_content.substring(0, 255), record.row_number)
            }
            merged.deposits++
            break
          }
          case 'market': {
            const contractCode = data.code || data['合约代码'] || data.contract_code
            const contract = db.prepare('SELECT id FROM contracts WHERE code = ?').get(contractCode) as any
            if (contract) {
              const lastPrice = Number(data.last_price || data['最新价'] || data['收盘价'])
              const changePct = Number(data.change_pct || data['涨跌幅'] || 0)
              const snapshotTime = data.snapshot_time || data['时间'] || new Date().toISOString()
              db.prepare(`INSERT INTO market_snapshots (id, contract_id, last_price, change_pct, snapshot_time, source) VALUES (?, ?, ?, ?, ?, 'import')`).run(uuidv4(), contract.id, lastPrice, changePct, snapshotTime)
            }
            merged.market++
            break
          }
        }
        db.prepare(`UPDATE import_records SET status = 'success' WHERE id = ?`).run(record.id)
      } catch (e: any) {
        db.prepare(`UPDATE import_records SET status = 'error', error_message = ? WHERE id = ?`).run(e.message, record.id)
        errors.push(`第${record.row_number}行: ${e.message}`)
      }
    }
  })

  transaction()
  recalculateAllRiskRates()

  const totalMerged = merged.clients + merged.contracts + merged.positions + merged.deposits + merged.market
  const clientCount = (db.prepare('SELECT COUNT(*) as cnt FROM clients').get() as any).cnt

  return { merged: totalMerged, preserved: records.length - totalMerged, risk_updated: clientCount, errors }
}

export function cancelImport(batchId: string): void {
  const db = getDb()

  const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    throw new BusinessError(`导入批次 ${batchId} 不存在`, { severity: 'error' })
  }
  if (batch.status === 'confirmed') {
    throw new BusinessError('已确认的批次不能取消', { severity: 'warning' })
  }

  db.prepare(`UPDATE import_batches SET status = 'cancelled' WHERE id = ?`).run(batchId)
  db.prepare(`UPDATE import_records SET status = 'skipped' WHERE batch_id = ? AND status = 'pending'`).run(batchId)
}

export function getImportStatus(batchId: string): any {
  const db = getDb()

  const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    throw new BusinessError(`导入批次 ${batchId} 不存在`, { severity: 'error' })
  }

  const records = db.prepare('SELECT * FROM import_records WHERE batch_id = ?').all(batchId) as any[]
  const errorRecords = records.filter(r => r.status === 'error')

  return {
    batch,
    records,
  }
}
