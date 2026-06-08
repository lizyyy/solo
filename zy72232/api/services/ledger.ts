import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

export function getAll(status?: string) {
  const db = getDb()
  if (status) {
    return db.prepare('SELECT * FROM ledger_records WHERE status = ? ORDER BY created_at DESC').all(status)
  }
  return db.prepare('SELECT * FROM ledger_records ORDER BY created_at DESC').all()
}

export function getById(id: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM ledger_records WHERE id = ?').get(id)
}

export function importRecords(records: any[], operator = 'system') {
  const db = getDb()
  const now = new Date().toISOString()
  const insertRecord = db.prepare(`
    INSERT INTO ledger_records (id, trade_no, institution_name_source1, institution_name_source2, institution_name_consistent, ex_rights_date, extension_date, tax_rate, tax_rate_remark, tax_rate_source, status, created_at, updated_at)
    VALUES (@id, @trade_no, @institution_name_source1, @institution_name_source2, @institution_name_consistent, @ex_rights_date, @extension_date, @tax_rate, @tax_rate_remark, @tax_rate_source, @status, @created_at, @updated_at)
  `)
  const insertLog = db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, detail, cli_command, operator, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const r of records) {
      const consistent = r.institution_name_source1 === r.institution_name_source2 ? 1 : 0
      const status = consistent ? 'normal' : 'inconsistent'
      const id = uuidv4()

      insertRecord.run({
        id,
        trade_no: r.trade_no,
        institution_name_source1: r.institution_name_source1,
        institution_name_source2: r.institution_name_source2,
        institution_name_consistent: consistent,
        ex_rights_date: r.ex_rights_date,
        extension_date: r.extension_date,
        tax_rate: r.tax_rate ?? null,
        tax_rate_remark: r.tax_rate_remark ?? '',
        tax_rate_source: r.tax_rate_source ?? 'original',
        status,
        created_at: now,
        updated_at: now,
      })

      const cliCommand = `npm run cli -- import --file ${r.trade_no}`
      const detail = consistent
        ? `导入记录 ${r.trade_no}，机构简称一致`
        : `导入记录 ${r.trade_no}，机构简称不一致：${r.institution_name_source1} vs ${r.institution_name_source2}`
      insertLog.run(uuidv4(), id, 'import', detail, cliCommand, operator, now)
    }
  })

  transaction()
}

export function supplement(id: string, rate: number, remark: string, operator = 'system') {
  const db = getDb()
  const now = new Date().toISOString()
  const record = db.prepare('SELECT * FROM ledger_records WHERE id = ?').get(id) as any
  if (!record) throw new Error('Record not found')

  db.prepare(`
    UPDATE ledger_records SET tax_rate = ?, tax_rate_remark = ?, tax_rate_source = 'supplemented', status = 'supplemented', updated_at = ? WHERE id = ?
  `).run(rate, remark, now, id)

  const cliCommand = `npm run cli -- supplement --record ${record.trade_no} --rate ${rate} --remark "${remark}"`
  const detail = `补录 ${record.trade_no} 税费率备注：${rate}%，${remark}`
  db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, detail, cli_command, operator, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, 'supplement', detail, cliCommand, operator, now)
}

const ALLOWED_FIELDS = ['institution_name_source1', 'institution_name_source2', 'tax_rate', 'tax_rate_remark', 'ex_rights_date', 'extension_date']

export function correct(id: string, field: string, value: string, operator = 'system') {
  if (!ALLOWED_FIELDS.includes(field)) {
    throw new Error(`Field "${field}" is not allowed for correction`)
  }
  const db = getDb()
  const now = new Date().toISOString()
  const record = db.prepare('SELECT * FROM ledger_records WHERE id = ?').get(id) as any
  if (!record) throw new Error('Record not found')

  const oldValue = record[field]
  db.prepare(`UPDATE ledger_records SET ${field} = ?, updated_at = ? WHERE id = ?`).run(value, now, id)

  const fieldName = field.replace(/_/g, ' ')
  const cliCommand = `npm run cli -- correct --record ${record.trade_no} --field ${field} --value "${value}"`
  const detail = `修正 ${record.trade_no} ${fieldName}：${oldValue} → ${value}`
  db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, detail, cli_command, operator, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, 'correct', detail, cliCommand, operator, now)
}

export function rerun(recordId?: string, operator = 'system') {
  const db = getDb()
  const now = new Date().toISOString()

  const detectOne = (rec: any) => {
    const consistent = rec.institution_name_source1 === rec.institution_name_source2 ? 1 : 0
    const newStatus = consistent ? 'normal' : 'inconsistent'
    db.prepare('UPDATE ledger_records SET institution_name_consistent = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(consistent, newStatus, now, rec.id)

    const cliCommand = `npm run cli -- detect --record ${rec.trade_no}`
    const detail = consistent
      ? `重跑一致性检测，${rec.trade_no} 机构简称已一致`
      : `重跑一致性检测，${rec.trade_no} 机构简称不一致：${rec.institution_name_source1} vs ${rec.institution_name_source2}`
    db.prepare(`
      INSERT INTO operation_logs (id, record_id, action, detail, cli_command, operator, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), rec.id, 'detect', detail, cliCommand, operator, now)
  }

  if (recordId) {
    const record = db.prepare('SELECT * FROM ledger_records WHERE id = ?').get(recordId) as any
    if (record) detectOne(record)
  } else {
    const records = db.prepare('SELECT * FROM ledger_records').all() as any[]
    for (const rec of records) {
      detectOne(rec)
    }
  }
}

export function confirm(id: string, operator = 'system') {
  const db = getDb()
  const now = new Date().toISOString()
  const record = db.prepare('SELECT * FROM ledger_records WHERE id = ?').get(id) as any
  if (!record) throw new Error('Record not found')

  db.prepare('UPDATE ledger_records SET status = ?, updated_at = ? WHERE id = ?').run('confirmed', now, id)

  const cliCommand = `npm run cli -- confirm --record ${record.trade_no}`
  const detail = `财务复核确认 ${record.trade_no}`
  db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, detail, cli_command, operator, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, 'confirm', detail, cliCommand, operator, now)
}

export function reject(id: string, operator = 'system') {
  const db = getDb()
  const now = new Date().toISOString()
  const record = db.prepare('SELECT * FROM ledger_records WHERE id = ?').get(id) as any
  if (!record) throw new Error('Record not found')

  db.prepare('UPDATE ledger_records SET status = ?, updated_at = ? WHERE id = ?').run('inconsistent', now, id)

  const cliCommand = `npm run cli -- reject --record ${record.trade_no}`
  const detail = `财务复核打回 ${record.trade_no}`
  db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, detail, cli_command, operator, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, 'reject', detail, cliCommand, operator, now)
}

export function getStats() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count FROM ledger_records GROUP BY status
  `).all() as any[]

  const stats = { normal: 0, inconsistent: 0, supplemented: 0, confirmed: 0, total: 0 }
  for (const row of rows) {
    stats[row.status as keyof typeof stats] = row.count
    stats.total += row.count
  }
  return stats
}

export function getAuditLogs(recordId?: string) {
  const db = getDb()
  if (recordId) {
    return db.prepare('SELECT * FROM operation_logs WHERE record_id = ? ORDER BY timestamp DESC').all(recordId)
  }
  return db.prepare('SELECT * FROM operation_logs ORDER BY timestamp DESC').all()
}

export function getScreenshot(id: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id)
}

export function getScreenshotByRecordId(recordId: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM screenshots WHERE record_id = ?').get(recordId)
}
