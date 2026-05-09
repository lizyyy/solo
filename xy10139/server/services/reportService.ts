import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import XLSX from 'xlsx'
import { getDb } from '../database'
import { ImportJob, RowResult, ReportFormat } from '../../shared/types'

export class ReportService {
  private db = getDb()
  private reportDir = process.env.REPORT_DIR || './data/reports'

  constructor() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true })
    }
  }

  async generateReport(
    jobId: string,
    format: 'csv' | 'json' | 'xlsx' = 'csv',
    options?: {
      includeSuccess?: boolean
      includeFailed?: boolean
      includeSkipped?: boolean
    }
  ): Promise<ReportFormat> {
    const { includeSuccess = true, includeFailed = true, includeSkipped = true } = options || {}

    const job = this.getJob(jobId)
    if (!job) {
      throw new Error(`任务不存在: ${jobId}`)
    }

    const rows = this.getFilteredRows(jobId, includeSuccess, includeFailed, includeSkipped)
    
    let filePath: string
    let contentType: string

    switch (format) {
      case 'csv':
        filePath = this.generateCsvReport(job, rows)
        contentType = 'text/csv'
        break
      case 'json':
        filePath = this.generateJsonReport(job, rows)
        contentType = 'application/json'
        break
      case 'xlsx':
        filePath = this.generateXlsxReport(job, rows)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        break
      default:
        throw new Error(`不支持的报告格式: ${format}`)
    }

    const report: ReportFormat = {
      id: `report_${jobId}_${Date.now()}`,
      jobId,
      format,
      createdAt: new Date().toISOString(),
      filePath
    }

    this.saveReport(report)

    return report
  }

  private getFilteredRows(
    jobId: string,
    includeSuccess: boolean,
    includeFailed: boolean,
    includeSkipped: boolean
  ): RowResult[] {
    const stmt = this.db.prepare('SELECT * FROM row_results WHERE job_id = ? ORDER BY row_index ASC')
    const rows: any[] = stmt.all(jobId)
    
    return rows
      .map(r => this.mapRowFromRow(r))
      .filter(row => {
        if (row.status === 'success' && !includeSuccess) return false
        if (row.status === 'failed' && !includeFailed) return false
        if (row.status === 'skipped' && !includeSkipped) return false
        return true
      })
  }

  private generateCsvReport(job: ImportJob, rows: RowResult[]): string {
    const headers = this.getHeaders(rows)
    const csvRows = [
      ['导入任务报告'],
      [`任务ID: ${job.id}`],
      [`任务名称: ${job.name}`],
      [`创建时间: ${job.createdAt}`],
      [`总计: ${job.totalRows} | 成功: ${job.successCount} | 失败: ${job.failedCount}`],
      [],
      [...headers, '验证状态', '错误信息', '重试次数']
    ]

    for (const row of rows) {
      const dataRow = headers.map(h => row.data[h] || '')
      csvRows.push([
        ...dataRow,
        row.status,
        row.errors.map(e => `${e.field}: ${e.message}`).join('; '),
        row.retryCount
      ])
    }

    const csvContent = Papa.unparse(csvRows, {
      header: false,
      skipEmptyLines: false
    })

    const fileName = `${job.id}_report_${Date.now()}.csv`
    const filePath = path.join(this.reportDir, fileName)
    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8')

    return filePath
  }

  private generateJsonReport(job: ImportJob, rows: RowResult[]): string {
    const report = {
      job: {
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
        totalRows: job.totalRows,
        successCount: job.successCount,
        failedCount: job.failedCount,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      },
      summary: {
        total: rows.length,
        success: rows.filter(r => r.status === 'success').length,
        failed: rows.filter(r => r.status === 'failed').length,
        byField: this.groupErrorsByField(rows)
      },
      rows: rows.map(r => ({
        rowIndex: r.rowIndex,
        status: r.status,
        data: r.data,
        errors: r.errors.map(e => ({
          field: e.field,
          rule: e.rule,
          message: e.message,
          value: e.value
        })),
        retryCount: r.retryCount
      }))
    }

    const fileName = `${job.id}_report_${Date.now()}.json`
    const filePath = path.join(this.reportDir, fileName)
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')

    return filePath
  }

  private generateXlsxReport(job: ImportJob, rows: RowResult[]): string {
    const headers = this.getHeaders(rows)
    
    const wb = XLSX.utils.book_new()
    
    const summaryData = [
      ['导入任务报告'],
      [`任务ID`, job.id],
      [`任务名称`, job.name],
      [`任务类型`, job.type],
      [`状态`, job.status],
      [`总记录数`, job.totalRows],
      [`成功数`, job.successCount],
      [`失败数`, job.failedCount],
      [`创建时间`, job.createdAt],
      [`更新时间`, job.updatedAt],
      [],
      ['错误统计']
    ]
    
    const errorStats = this.groupErrorsByField(rows)
    for (const [field, errors] of Object.entries(errorStats)) {
      summaryData.push([field, errors.count, errors.messages.join(', ')])
    }
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, '汇总')

    const detailData = [
      [...headers, '验证状态', '错误信息', '重试次数', '最后重试时间']
    ]
    
    for (const row of rows) {
      const dataRow = headers.map(h => row.data[h] || '')
      detailData.push([
        ...dataRow,
        row.status,
        row.errors.map(e => `${e.field}: ${e.message}`).join('; '),
        row.retryCount,
        row.lastRetriedAt || ''
      ])
    }
    
    const detailSheet = XLSX.utils.aoa_to_sheet(detailData)
    XLSX.utils.book_append_sheet(wb, detailSheet, '详细结果')

    const fileName = `${job.id}_report_${Date.now()}.xlsx`
    const filePath = path.join(this.reportDir, fileName)
    XLSX.writeFile(wb, filePath)

    return filePath
  }

  private groupErrorsByField(rows: RowResult[]): Record<string, { count: number; messages: string[] }> {
    const groups: Record<string, { count: number; messages: Set<string> }> = {}
    
    for (const row of rows) {
      for (const error of row.errors) {
        if (!groups[error.field]) {
          groups[error.field] = { count: 0, messages: new Set() }
        }
        groups[error.field].count++
        groups[error.field].messages.add(error.message)
      }
    }

    return Object.fromEntries(
      Object.entries(groups).map(([field, data]) => [
        field,
        {
          count: data.count,
          messages: Array.from(data.messages)
        }
      ])
    )
  }

  private getHeaders(rows: RowResult[]): string[] {
    if (rows.length === 0) return []
    
    const allKeys = new Set<string>()
    for (const row of rows) {
      for (const key of Object.keys(row.data)) {
        allKeys.add(key)
      }
    }
    return Array.from(allKeys)
  }

  private saveReport(report: ReportFormat): void {
    const stmt = this.db.prepare(`
      INSERT INTO reports (id, job_id, format, created_at, file_path)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(
      report.id,
      report.jobId,
      report.format,
      report.createdAt,
      report.filePath
    )
  }

  private getJob(jobId: string): ImportJob | null {
    const stmt = this.db.prepare('SELECT * FROM import_jobs WHERE id = ?')
    const row: any = stmt.get(jobId)
    return row ? this.mapJobFromRow(row) : null
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

  getReport(reportId: string): ReportFormat | null {
    const stmt = this.db.prepare('SELECT * FROM reports WHERE id = ?')
    const row: any = stmt.get(reportId)
    return row ? this.mapReportFromRow(row) : null
  }

  getReportsByJob(jobId: string): ReportFormat[] {
    const stmt = this.db.prepare('SELECT * FROM reports WHERE job_id = ? ORDER BY created_at DESC')
    const rows: any[] = stmt.all(jobId)
    return rows.map(r => this.mapReportFromRow(r))
  }

  private mapReportFromRow(row: any): ReportFormat {
    return {
      id: row.id,
      jobId: row.job_id,
      format: row.format,
      createdAt: row.created_at,
      filePath: row.file_path
    }
  }
}

export const reportService = new ReportService()
