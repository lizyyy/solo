import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { getDb } from '../database'
import { fileParser } from './fileParser'
import { validator } from './validator'
import {
  ImportJob,
  RowResult,
  ValidationSchema,
  FileFormat,
  ImportSummary
} from '../../shared/types'

export interface ImportOptions {
  schemaId: string
  filePath: string
  format: FileFormat
  fileName?: string
  options?: {
    delimiter?: string
    hasHeader?: boolean
    sheetName?: string
  }
}

export class ImportService {
  private db = getDb()

  async processImport(options: ImportOptions): Promise<{
    job: ImportJob
    summary: ImportSummary
  }> {
    const schema = this.getSchema(options.schemaId)
    if (!schema) {
      throw new Error(`校验规则不存在: ${options.schemaId}`)
    }

    const existingJob = this.findExistingJob(options)
    if (existingJob) {
      return this.getJobWithSummary(existingJob.id)
    }

    const parsed = await fileParser.parse(options.filePath, options.format, options.options)
    
    const job: ImportJob = {
      id: uuidv4(),
      name: options.fileName || path.basename(options.filePath),
      type: schema.type as any,
      status: 'validating',
      totalRows: parsed.totalRows,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaId: options.schemaId,
      sourceFile: options.filePath
    }

    this.saveJob(job)

    const context = validator.createContext(job.id, schema, parsed.rows)
    const rowResults: RowResult[] = []
    let successCount = 0
    let failedCount = 0

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i]
      const rowResult = validator.validate(row, i + 1, context)
      rowResults.push(rowResult)
      
      if (rowResult.status === 'success') {
        successCount++
      } else {
        failedCount++
      }
    }

    job.status = 'completed'
    job.successCount = successCount
    job.failedCount = failedCount
    job.updatedAt = new Date().toISOString()

    this.updateJob(job)
    this.saveRowResults(rowResults)

    const summary = this.createSummary(job, rowResults)

    return { job, summary }
  }

  private findExistingJob(options: ImportOptions): ImportJob | null {
    const fileHash = this.getFileHash(options.filePath)
    const stmt = this.db.prepare(`
      SELECT j.* FROM import_jobs j
      WHERE j.source_file = ? AND j.schema_id = ? AND j.status = 'completed'
      ORDER BY j.created_at DESC
      LIMIT 1
    `)
    
    const row: any = stmt.get(options.filePath, options.schemaId)
    if (!row) return null

    return this.mapJobFromRow(row)
  }

  private getFileHash(filePath: string): string {
    const stats = fs.statSync(filePath)
    return `${filePath}-${stats.size}-${stats.mtime.getTime()}`
  }

  async retryFailed(jobId: string, rowIds?: string[], overrideData?: Record<string, Record<string, any>>): Promise<{
    job: ImportJob
    summary: ImportSummary
  }> {
    const job = this.getJob(jobId)
    if (!job) {
      throw new Error(`任务不存在: ${jobId}`)
    }

    const schema = this.getSchema(job.schemaId)
    if (!schema) {
      throw new Error(`校验规则不存在: ${job.schemaId}`)
    }

    const failedRows = this.getFailedRows(jobId, rowIds)
    if (failedRows.length === 0) {
      return this.getJobWithSummary(jobId)
    }

    const successRows = this.getSuccessRows(jobId)
    const allRows = [...successRows.map(r => r.data), ...failedRows.map(r => {
      if (overrideData && overrideData[r.id]) {
        return { ...r.data, ...overrideData[r.id] }
      }
      return r.data
    })]

    const context = validator.createContext(jobId, schema, allRows)
    
    let newSuccessCount = 0
    const updatedRows: RowResult[] = []

    for (const row of failedRows) {
      let data = row.data
      if (overrideData && overrideData[row.id]) {
        data = { ...data, ...overrideData[row.id] }
      }

      const newResult = validator.validate(data, row.rowIndex, context)
      
      const updated: RowResult = {
        ...row,
        data,
        status: newResult.status,
        errors: newResult.errors,
        retryCount: row.retryCount + 1,
        lastRetriedAt: new Date().toISOString()
      }

      updatedRows.push(updated)

      if (newResult.status === 'success') {
        newSuccessCount++
      }
    }

    this.updateRowResults(updatedRows)

    const finalStats = this.calculateJobStats(jobId)
    job.successCount = finalStats.success
    job.failedCount = finalStats.failed
    job.updatedAt = new Date().toISOString()
    this.updateJob(job)

    const summary = this.createSummary(job, this.getAllRows(jobId))

    return { job, summary }
  }

  getJob(jobId: string): ImportJob | null {
    const stmt = this.db.prepare('SELECT * FROM import_jobs WHERE id = ?')
    const row: any = stmt.get(jobId)
    return row ? this.mapJobFromRow(row) : null
  }

  getJobWithSummary(jobId: string): { job: ImportJob; summary: ImportSummary } {
    const job = this.getJob(jobId)
    if (!job) {
      throw new Error(`任务不存在: ${jobId}`)
    }
    const rows = this.getAllRows(jobId)
    const summary = this.createSummary(job, rows)
    return { job, summary }
  }

  getJobs(limit: number = 50, offset: number = 0): ImportJob[] {
    const stmt = this.db.prepare(`
      SELECT * FROM import_jobs 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `)
    const rows: any[] = stmt.all(limit, offset)
    return rows.map(r => this.mapJobFromRow(r))
  }

  getAllRows(jobId: string): RowResult[] {
    const stmt = this.db.prepare('SELECT * FROM row_results WHERE job_id = ? ORDER BY row_index ASC')
    const rows: any[] = stmt.all(jobId)
    return rows.map(r => this.mapRowFromRow(r))
  }

  getFailedRows(jobId: string, rowIds?: string[]): RowResult[] {
    let sql = 'SELECT * FROM row_results WHERE job_id = ? AND status = ?'
    const params: any[] = [jobId, 'failed']

    if (rowIds && rowIds.length > 0) {
      sql += ` AND id IN (${rowIds.map(() => '?').join(',')})`
      params.push(...rowIds)
    }

    sql += ' ORDER BY row_index ASC'
    const stmt = this.db.prepare(sql)
    const rows: any[] = stmt.all(...params)
    return rows.map(r => this.mapRowFromRow(r))
  }

  getSuccessRows(jobId: string): RowResult[] {
    const stmt = this.db.prepare(
      'SELECT * FROM row_results WHERE job_id = ? AND status = ? ORDER BY row_index ASC'
    )
    const rows: any[] = stmt.all(jobId, 'success')
    return rows.map(r => this.mapRowFromRow(r))
  }

  getSchemas(): ValidationSchema[] {
    const stmt = this.db.prepare('SELECT * FROM validation_schemas ORDER BY created_at ASC')
    const rows: any[] = stmt.all()
    return rows.map(r => this.mapSchemaFromRow(r))
  }

  getSchema(schemaId: string): ValidationSchema | null {
    const stmt = this.db.prepare('SELECT * FROM validation_schemas WHERE id = ?')
    const row: any = stmt.get(schemaId)
    return row ? this.mapSchemaFromRow(row) : null
  }

  createSchema(schema: Omit<ValidationSchema, 'id' | 'createdAt'>): ValidationSchema {
    const newSchema: ValidationSchema = {
      id: uuidv4(),
      ...schema,
      createdAt: new Date().toISOString()
    }

    const stmt = this.db.prepare(`
      INSERT INTO validation_schemas (id, name, type, fields, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(
      newSchema.id,
      newSchema.name,
      newSchema.type,
      JSON.stringify(newSchema.fields),
      newSchema.createdAt
    )

    return newSchema
  }

  initDefaultSchemas(): void {
    const existing = this.getSchemas()
    if (existing.length > 0) return

    const schemas: Omit<ValidationSchema, 'id' | 'createdAt'>[] = [
      {
        name: '用户导入',
        type: 'user',
        fields: [
          {
            name: 'username',
            label: '用户名',
            required: true,
            type: 'string',
            rules: [
              { type: 'minLength', value: 2, message: '用户名长度不能小于2位' },
              { type: 'maxLength', value: 50, message: '用户名长度不能大于50位' },
              { type: 'unique', message: '用户名必须唯一' }
            ]
          },
          {
            name: 'email',
            label: '邮箱',
            required: true,
            type: 'email',
            rules: [
              { type: 'unique', message: '邮箱必须唯一' }
            ]
          },
          {
            name: 'age',
            label: '年龄',
            required: false,
            type: 'integer',
            rules: [
              { type: 'min', value: 0, message: '年龄不能小于0' },
              { type: 'max', value: 150, message: '年龄不能大于150' }
            ]
          },
          {
            name: 'status',
            label: '状态',
            required: true,
            type: 'string',
            rules: [
              { type: 'enum', value: ['active', 'inactive', 'pending'], message: '状态必须是 active, inactive, pending 之一' }
            ]
          }
        ]
      },
      {
        name: '商品导入',
        type: 'product',
        fields: [
          {
            name: 'sku',
            label: 'SKU',
            required: true,
            type: 'string',
            rules: [
              { type: 'pattern', value: '^[A-Z0-9-]+$', message: 'SKU只能包含大写字母、数字和连字符' },
              { type: 'unique', message: 'SKU必须唯一' }
            ]
          },
          {
            name: 'name',
            label: '商品名称',
            required: true,
            type: 'string',
            rules: [
              { type: 'minLength', value: 1, message: '商品名称不能为空' }
            ]
          },
          {
            name: 'price',
            label: '价格',
            required: true,
            type: 'number',
            rules: [
              { type: 'min', value: 0, message: '价格不能为负数' }
            ]
          },
          {
            name: 'stock',
            label: '库存',
            required: true,
            type: 'integer',
            rules: [
              { type: 'min', value: 0, message: '库存不能为负数' }
            ]
          }
        ]
      },
      {
        name: '订单导入',
        type: 'order',
        fields: [
          {
            name: 'order_no',
            label: '订单号',
            required: true,
            type: 'string',
            rules: [
              { type: 'minLength', value: 8, message: '订单号长度不能小于8位' },
              { type: 'unique', message: '订单号必须唯一' }
            ]
          },
          {
            name: 'customer_name',
            label: '客户姓名',
            required: true,
            type: 'string',
            rules: []
          },
          {
            name: 'amount',
            label: '订单金额',
            required: true,
            type: 'number',
            rules: [
              { type: 'min', value: 0, message: '订单金额不能为负数' }
            ]
          },
          {
            name: 'order_date',
            label: '订单日期',
            required: true,
            type: 'date',
            rules: []
          }
        ]
      }
    ]

    for (const s of schemas) {
      this.createSchema(s)
    }
  }

  private calculateJobStats(jobId: string): { success: number; failed: number; skipped: number } {
    const stmt = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_count
      FROM row_results WHERE job_id = ?
    `)
    const row: any = stmt.get(jobId)
    return {
      success: row.success_count || 0,
      failed: row.failed_count || 0,
      skipped: row.skipped_count || 0
    }
  }

  private createSummary(job: ImportJob, rows: RowResult[]): ImportSummary {
    const allErrors: { [key: string]: { count: number; message: string } } = {}
    
    for (const row of rows) {
      if (row.status === 'failed') {
        for (const error of row.errors) {
          const key = `${error.field}-${error.rule}`
          if (!allErrors[key]) {
            allErrors[key] = { count: 0, message: error.message }
          }
          allErrors[key].count++
        }
      }
    }

    const failedDetails = Object.entries(allErrors)
      .map(([key, val]) => ({
        field: key.split('-')[0],
        rule: key.split('-').slice(1).join('-'),
        message: `${val.message} (${val.count} 条记录)`,
        value: val.count
      }))
      .sort((a, b) => (b.value as number) - (a.value as number))

    return {
      total: job.totalRows,
      success: job.successCount,
      failed: job.failedCount,
      failedDetails,
      errors: []
    }
  }

  private saveJob(job: ImportJob): void {
    const stmt = this.db.prepare(`
      INSERT INTO import_jobs (
        id, name, type, status, total_rows, success_count, failed_count,
        skipped_count, created_at, updated_at, schema_id, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      job.id,
      job.name,
      job.type,
      job.status,
      job.totalRows,
      job.successCount,
      job.failedCount,
      job.skippedCount,
      job.createdAt,
      job.updatedAt,
      job.schemaId,
      job.sourceFile || null
    )
  }

  private updateJob(job: ImportJob): void {
    const stmt = this.db.prepare(`
      UPDATE import_jobs SET
        status = ?,
        success_count = ?,
        failed_count = ?,
        skipped_count = ?,
        updated_at = ?,
        report_file = ?
      WHERE id = ?
    `)
    stmt.run(
      job.status,
      job.successCount,
      job.failedCount,
      job.skippedCount,
      job.updatedAt,
      job.reportFile || null,
      job.id
    )
  }

  private saveRowResults(rows: RowResult[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO row_results (
        id, job_id, row_index, status, data, errors, created_at, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const tx = this.db.transaction((results: RowResult[]) => {
      for (const row of results) {
        stmt.run(
          row.id,
          row.jobId,
          row.rowIndex,
          row.status,
          JSON.stringify(row.data),
          JSON.stringify(row.errors),
          row.createdAt,
          row.retryCount
        )
      }
    })

    tx(rows)
  }

  private updateRowResults(rows: RowResult[]): void {
    const stmt = this.db.prepare(`
      UPDATE row_results SET
        status = ?,
        data = ?,
        errors = ?,
        retry_count = ?,
        last_retried_at = ?
      WHERE id = ?
    `)

    const tx = this.db.transaction((results: RowResult[]) => {
      for (const row of results) {
        stmt.run(
          row.status,
          JSON.stringify(row.data),
          JSON.stringify(row.errors),
          row.retryCount,
          row.lastRetriedAt || null,
          row.id
        )
      }
    })

    tx(rows)
  }

  private mapJobFromRow(row: any): ImportJob {
    return {
      id: row.id,
      name: row.name,
      type: row.type as any,
      status: row.status as any,
      totalRows: row.total_rows,
      successCount: row.success_count,
      failedCount: row.failed_count,
      skippedCount: row.skipped_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      schemaId: row.schema_id,
      sourceFile: row.source_file,
      resultsFile: row.results_file,
      reportFile: row.report_file,
      errors: row.errors
    }
  }

  private mapRowFromRow(row: any): RowResult {
    return {
      id: row.id,
      jobId: row.job_id,
      rowIndex: row.row_index,
      status: row.status as any,
      data: JSON.parse(row.data || '{}'),
      errors: JSON.parse(row.errors || '[]'),
      createdAt: row.created_at,
      retryCount: row.retry_count,
      lastRetriedAt: row.last_retried_at
    }
  }

  private mapSchemaFromRow(row: any): ValidationSchema {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      fields: JSON.parse(row.fields || '[]'),
      createdAt: row.created_at
    }
  }
}
