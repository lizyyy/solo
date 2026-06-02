import xlsx from 'xlsx'
import path from 'path'
import { createImportJob, updateImportJobMapping, updateImportJobStatus, createRawRecords, getImportJobById, getRawRecordsByJob } from '../repositories/import-job.repo.js'
import { createAuditLog } from '../repositories/audit-log.repo.js'

export function processUploadedFile(filePath: string, originalName: string, sourceType: string, batchId: string) {
  const ext = path.extname(originalName).toLowerCase()
  let data: Record<string, unknown>[] = []

  if (ext === '.csv') {
    const workbook = xlsx.readFile(filePath, { type: 'file', raw: true })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    data = xlsx.utils.sheet_to_json(sheet)
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = xlsx.readFile(filePath, { type: 'file' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    data = xlsx.utils.sheet_to_json(sheet)
  } else {
    throw new Error(`Unsupported file format: ${ext}`)
  }

  const recordCount = data.length
  const preview = data.slice(0, 20)

  const defaultMapping: Record<string, string> = {}
  if (data.length > 0) {
    const headers = Object.keys(data[0])
    for (const h of headers) {
      const lower = h.toLowerCase()
      if (lower.includes('地址') || lower.includes('address')) defaultMapping[h] = 'address'
      else if (lower.includes('业态') || lower.includes('business')) defaultMapping[h] = 'businessType'
      else if (lower.includes('面积') || lower.includes('area')) defaultMapping[h] = 'area'
      else if (lower.includes('gis') || lower.includes('编号') || lower.includes('id')) defaultMapping[h] = 'gisId'
      else defaultMapping[h] = h
    }
  }

  const job = createImportJob({
    batchId,
    sourceType,
    fileName: originalName,
    recordCount,
    fieldMapping: defaultMapping,
    rawPreview: preview,
  })

  createRawRecords(
    job.id,
    data.map(row => ({ rawData: row }))
  )

  return {
    jobId: job.id,
    recordCount,
    preview,
    fieldMapping: defaultMapping,
    headers: data.length > 0 ? Object.keys(data[0]) : [],
  }
}

export function mapFields(jobId: string, fieldMapping: Record<string, string>) {
  const job = getImportJobById(jobId)
  if (!job) throw new Error('Import job not found')

  updateImportJobMapping(jobId, fieldMapping)

  const records = getRawRecordsByJob(jobId)
  const mappedRecords = records.map(r => {
    const raw = r.rawData as Record<string, unknown>
    const mapped: Record<string, unknown> = {}
    for (const [srcField, targetField] of Object.entries(fieldMapping)) {
      if (raw[srcField] !== undefined) {
        mapped[targetField] = raw[srcField]
      }
    }
    return { ...r, mappedData: mapped }
  })

  return { jobId, mappedCount: mappedRecords.length }
}

export function confirmImport(jobId: string, actor: string = 'system') {
  const job = getImportJobById(jobId)
  if (!job) throw new Error('Import job not found')

  updateImportJobStatus(jobId, 'confirmed')

  createAuditLog({
    batchId: job.batchId,
    action: 'import',
    actor,
    detail: `确认导入文件 ${job.fileName}，共 ${job.recordCount} 条记录`,
    relatedId: jobId,
  })

  return { jobId, status: 'confirmed' }
}
