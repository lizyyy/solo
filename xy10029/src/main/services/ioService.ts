import { run, get, all } from '../database/index'
import {
  Device,
  DeviceCategory,
  DeviceStatus,
  BorrowRecord,
  User,
  PaginationParams,
  PaginatedResult,
  ExportOptions,
  ImportResult,
  ImportError,
  BatchOperation,
  BatchResult,
  BatchStatus
} from '@shared/types'
import { generateId, getCurrentTimestamp } from '@shared/utils'
import * as XLSX from 'exceljs'
import * as Papa from 'papaparse'
import * as fs from 'fs'

export async function exportToExcel(
  options: ExportOptions,
  getData: () => any[]
): Promise<Buffer> {
  const workbook = new XLSX.Workbook()
  const worksheet = workbook.addWorksheet(options.dataType)

  const data = getData()

  if (data.length > 0) {
    const headers = options.fields || Object.keys(data[0])
    worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }))
    worksheet.addRows(data)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function exportToCSV(
  options: ExportOptions,
  getData: () => any[]
): Promise<string> {
  const data = getData()
  return Papa.unparse(data, {
    columns: options.fields,
    header: options.includeHeaders !== false
  })
}

export function parseExcel(filePath: string): any[] {
  const workbook = new XLSX.Workbook()
  const content = fs.readFileSync(filePath)
  const worksheet = workbook.xlsx.load(content)
  return []
}

export function parseCSV(content: string): any[] {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  })
  return result.data as any[]
}

export function validateDeviceData(data: any[]): { valid: any[]; errors: ImportError[] } {
  const valid: any[] = []
  const errors: ImportError[] = []

  const requiredFields = ['deviceCode', 'name', 'category']
  const validCategories = Object.values(DeviceCategory)

  data.forEach((row, index) => {
    const rowErrors: string[] = []

    for (const field of requiredFields) {
      if (!row[field]) {
        rowErrors.push(`缺少必需字段: ${field}`)
      }
    }

    if (row.category && !validCategories.includes(row.category)) {
      rowErrors.push(`无效的设备类别: ${row.category}`)
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: index + 1,
        message: rowErrors.join('; '),
        data: row
      })
    } else {
      valid.push(row)
    }
  })

  return { valid, errors }
}

export async function createBatchOperation(
  operationType: string,
  totalCount: number,
  createdBy: string,
  createdByName: string
): Promise<BatchOperation> {
  const now = getCurrentTimestamp()

  const operation: BatchOperation = {
    id: generateId(),
    operationType,
    totalCount,
    successCount: 0,
    failedCount: 0,
    status: BatchStatus.PENDING,
    startedAt: now,
    completedAt: null,
    results: [],
    createdBy,
    createdByName
  }

  await run(`
    INSERT INTO batch_operations (
      id, operation_type, total_count, success_count, failed_count,
      status, started_at, completed_at, results, created_by, created_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    operation.id,
    operation.operationType,
    operation.totalCount,
    operation.successCount,
    operation.failedCount,
    operation.status,
    operation.startedAt,
    operation.completedAt,
    JSON.stringify(operation.results),
    operation.createdBy,
    operation.createdByName
  ])

  return operation
}

export async function addBatchResult(
  batchId: string,
  itemId: string,
  itemCode: string,
  success: boolean,
  errorMessage?: string
): Promise<BatchResult> {
  const now = getCurrentTimestamp()

  const result: BatchResult = {
    id: generateId(),
    batchOperationId: batchId,
    itemId,
    itemCode,
    success,
    errorMessage: errorMessage || null,
    timestamp: now
  }

  const operation = await getBatchOperation(batchId)
  if (operation) {
    operation.results.push(result)
    if (success) {
      operation.successCount++
    } else {
      operation.failedCount++
    }

    await run(`
      UPDATE batch_operations SET
        success_count = ?,
        failed_count = ?,
        results = ?
      WHERE id = ?
    `, [
      operation.successCount,
      operation.failedCount,
      JSON.stringify(operation.results),
      batchId
    ])
  }

  return result
}

export async function completeBatchOperation(batchId: string): Promise<BatchOperation | null> {
  const operation = await getBatchOperation(batchId)
  if (!operation) return null

  const now = getCurrentTimestamp()
  let status: BatchStatus

  if (operation.successCount === operation.totalCount) {
    status = BatchStatus.COMPLETED
  } else if (operation.failedCount === operation.totalCount) {
    status = BatchStatus.FAILED
  } else {
    status = BatchStatus.PARTIAL
  }

  await run(`
    UPDATE batch_operations SET
      status = ?,
      completed_at = ?
    WHERE id = ?
  `, [status, now, batchId])

  return getBatchOperation(batchId)
}

export async function getBatchOperation(id: string): Promise<BatchOperation | null> {
  const row = await get<any>('SELECT * FROM batch_operations WHERE id = ?', [id])
  return row ? mapBatchOperation(row) : null
}

export async function getBatchOperations(params: PaginationParams): Promise<PaginatedResult<BatchOperation>> {
  const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc' } = params

  const countRow = await get<any>('SELECT COUNT(*) as count FROM batch_operations', [])
  const total = countRow?.count || 0

  const offset = (page - 1) * pageSize
  const rows = await all<any>(
    `SELECT * FROM batch_operations ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    [pageSize, offset]
  )

  return {
    items: rows.map(mapBatchOperation),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

function mapBatchOperation(row: any): BatchOperation {
  return {
    id: row.id,
    operationType: row.operation_type,
    totalCount: row.total_count,
    successCount: row.success_count,
    failedCount: row.failed_count,
    status: row.status as BatchStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    results: JSON.parse(row.results || '[]'),
    createdBy: row.created_by,
    createdByName: row.created_by_name
  }
}
