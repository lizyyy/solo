import db from '../database.js'
import { getImportJobsByBatch, getRawRecordsByJob } from '../repositories/import-job.repo.js'
import { getMergedPointsByBatch } from '../repositories/merged-point.repo.js'

const batchId = process.argv[2]

console.log('=== All import jobs in batch ===')
const jobs = getImportJobsByBatch(batchId)
console.log(`Total jobs: ${jobs.length}`)
for (const j of jobs) {
  console.log(`  ${j.sourceType}: ${j.fileName} status=${j.status} records=${j.recordCount}`)
  const records = getRawRecordsByJob(j.id)
  console.log(`    raw records: ${records.length}`)
  for (const r of records) {
    const data = r.mappedData || r.rawData
    console.log(`    record ${r.rowIndex}: address="${data.address}" (type=${typeof data.address}, len=${data.address ? data.address.length : 0})`)
    console.log(`      hasMappedData=${!!r.mappedData}`)
    if (r.mappedData) {
      console.log(`      mapped keys: ${Object.keys(r.mappedData).join(', ')}`)
    }
  }
}

console.log('\n=== Simulate merge data collection ===')
const allRecords: any[] = []
for (const job of jobs.filter(j => j.status === 'confirmed' || j.status === 'merged')) {
  const records = getRawRecordsByJob(job.id)
  for (const r of records) {
    allRecords.push({
      jobId: job.id,
      sourceType: job.sourceType,
      fileName: job.fileName,
      importTime: job.importTime,
      mappedData: (r.mappedData || r.rawData) as Record<string, unknown>,
    })
  }
}
console.log(`allRecords count: ${allRecords.length}`)

const fileRecords = allRecords.filter(r => r.sourceType === 'photo' || r.sourceType === 'approval')
const tableRecords = allRecords.filter(r => r.sourceType === 'gis' || r.sourceType === 'street_table')
console.log(`tableRecords: ${tableRecords.length}`)
console.log(`fileRecords: ${fileRecords.length}`)

for (const r of fileRecords) {
  const address = String(r.mappedData.address || '').trim()
  console.log(`  fileRecord: type=${r.sourceType}, file=${r.fileName}, address="${address}", key="${address.toLowerCase().trim()}"`)
}

console.log('\n=== Address map keys ===')
const points = getMergedPointsByBatch(batchId)
for (const p of points) {
  const key = p.address.toLowerCase().trim()
  console.log(`  point: "${p.address}" key="${key}" (len=${key.length})`)
  // 检查是否匹配
  for (const r of fileRecords) {
    const addr = String(r.mappedData.address || '').trim()
    const fkey = addr.toLowerCase().trim()
    if (fkey === key) {
      console.log(`    MATCHES with ${r.sourceType}: ${r.fileName}`)
    }
  }
}
