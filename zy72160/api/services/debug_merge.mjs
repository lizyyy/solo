import db from '../database.js'
import { getImportJobsByBatch, getRawRecordsByJob } from '../repositories/import-job.repo.js'
import { getMergedPointsByBatch } from '../repositories/merged-point.repo.js'

const batchId = process.argv[2]

console.log('=== Import Jobs (confirmed) ===')
const jobs = getImportJobsByBatch(batchId).filter(j => j.status === 'confirmed')
for (const j of jobs) {
  console.log(`  ${j.sourceType}: ${j.fileName} (${j.recordCount} records)`)
  const records = getRawRecordsByJob(j.id)
  for (const r of records) {
    console.log(`    record ${r.rowIndex}: hasMapped=${!!r.mappedData}`)
    const data = r.mappedData || r.rawData
    console.log(`      address="${data.address}" type=${typeof data.address}`)
  }
}

console.log('\n=== Merged Points ===')
const points = getMergedPointsByBatch(batchId)
for (const p of points) {
  console.log(`  "${p.address}" (sourceCount=${p.sourceCount}, sources.len=${p.sources.length})`)
  const key = p.address.toLowerCase().trim()
  console.log(`    key="${key}" len=${key.length}`)
}

console.log('\n=== evidence_record table ===')
const rows = db.prepare('SELECT * FROM evidence_record').all()
for (const r of rows) {
  console.log(`  ${r.source_type}: ${r.file_name} -> ${r.merged_point_id.slice(0, 8)}`)
}
