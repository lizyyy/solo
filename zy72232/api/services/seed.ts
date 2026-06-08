import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

const SCREENSHOT_URL = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=financial+ex-rights+date+statement+screenshot&image_size=square'

export function seedDemoData(): void {
  const db = getDb()
  const now = new Date().toISOString()

  db.transaction(() => {
    db.prepare('DELETE FROM operation_logs').run()
    db.prepare('DELETE FROM screenshots').run()
    db.prepare('DELETE FROM ledger_records').run()

    const r1 = uuidv4()
    const r2 = uuidv4()
    const r3 = uuidv4()

    const s1 = uuidv4()
    const s2 = uuidv4()
    const s3 = uuidv4()

    const insertRecord = db.prepare(`
      INSERT INTO ledger_records (id, trade_no, institution_name_source1, institution_name_source2, institution_name_consistent, ex_rights_date, extension_date, tax_rate, tax_rate_remark, tax_rate_source, status, screenshot_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertRecord.run(r1, 'TX-2024-001', '国泰君安证券', '国泰君安证券', 1, '2024-12-15', '2025-03-15', 3.00, '', 'original', 'normal', s1, now, now)
    insertRecord.run(r2, 'TX-2024-002', '中信建投证券', '中信建投', 0, '2024-12-16', '2025-03-16', 2.80, '', 'original', 'inconsistent', s2, now, now)
    insertRecord.run(r3, 'TX-2024-003', '华泰证券', '华泰证券', 1, '2024-12-17', '2025-03-17', 2.50, '旧口径，来自税费率备注', 'supplemented', 'supplemented', s3, now, now)

    const insertScreenshot = db.prepare(`
      INSERT INTO screenshots (id, record_id, filename, data_url, captured_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    insertScreenshot.run(s1, r1, 'TX-2024-001.png', SCREENSHOT_URL, now)
    insertScreenshot.run(s2, r2, 'TX-2024-002.png', SCREENSHOT_URL, now)
    insertScreenshot.run(s3, r3, 'TX-2024-003.png', SCREENSHOT_URL, now)

    const insertLog = db.prepare(`
      INSERT INTO operation_logs (id, record_id, action, detail, cli_command, operator, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const t1 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    insertLog.run(uuidv4(), null, 'import', '导入3条展期记录', 'npm run cli -- import --file batch-2024.xlsx', 'system', t1)

    const t2 = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    insertLog.run(uuidv4(), r2, 'detect', '检测到 TX-2024-002 机构简称不一致：中信建投证券 vs 中信建投', 'npm run cli -- detect --record TX-2024-002', 'system', t2)

    const t3 = new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString()
    insertLog.run(uuidv4(), r3, 'supplement', '补录 TX-2024-003 税费率备注：2.50%，旧口径', 'npm run cli -- supplement --record TX-2024-003 --rate 2.50 --remark "旧口径"', 'system', t3)
  })()
}
