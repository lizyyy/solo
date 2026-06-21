import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, '..', 'data', 'livehouse.db')
const ATTACHMENTS_DIR = path.join(__dirname, '..', 'data', 'attachments')

let db: Database.Database | null = null

function ensureAttachmentsDir(): void {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
  }
}

function createSampleAttachment(storedName: string, content: string): void {
  ensureAttachmentsDir()
  const filePath = path.join(ATTACHMENTS_DIR, storedName)
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8')
  }
}

function seedSampleAttachments(): void {
  createSampleAttachment(
    'sample-001-att-01.txt',
    '夏夜晚风 - 回声乐队\n演出日期：2024-12-15\n场次：20:00 场\n观众人数：300人\n票价：40元/人\n票房收入：12000元\n分账比例：50%\n分账金额：6000元\n备注：合同已签，流程顺利\n'
  )
  createSampleAttachment(
    'sample-002-att-01.txt',
    '深巷 - 锈色吉他\n演出日期：2024-12-16\n场次：21:30 场\n观众人数：180人\n票价：45元/人\n票房收入：8000元\n分账比例：待核实\n备注：比例未定，需与经纪人确认\n'
  )
  createSampleAttachment(
    'sample-003-att-01.txt',
    '旧日之光 - 老王\n演出日期：2024-10-20\n旧口径比例：60%\n当前标准：40%\n票房收入：5000元\n按老规矩分\n备注：旧Excel导入，口径已调整\n'
  )
  createSampleAttachment(
    'sample-003-att-02.txt',
    '【历史聊天记录-2024-10-15】\n老王：这次演出还按老规矩分吧？\n林老师：行，按60%算\n老王：好嘞，谢了\n【2024-12月更新】\n林老师：从11月起统一按新标准40%执行\n老王：收到\n'
  )
}

const SAMPLE_RECORDS = [
  {
    id: 'sample-001',
    track_name: '夏夜晚风',
    artist: '回声乐队',
    revenue: 12000,
    share_ratio: 0.50,
    share_amount: 6000,
    status: 'smooth',
    source: 'excel',
    original_note: '',
    current_note: '',
    attachments: JSON.stringify([
      { id: 'sample-001-att-01', fileName: '夏夜晚风_原始对账.txt', storedPath: 'sample-001-att-01.txt', fileType: 'text', fileSize: 180 }
    ])
  },
  {
    id: 'sample-002',
    track_name: '深巷',
    artist: '锈色吉他',
    revenue: 8000,
    share_ratio: null,
    share_amount: null,
    status: 'needs_confirmation',
    source: 'excel',
    original_note: '比例未定 待核实',
    current_note: '比例未定 待核实',
    attachments: JSON.stringify([
      { id: 'sample-002-att-01', fileName: '深巷_待核实.txt', storedPath: 'sample-002-att-01.txt', fileType: 'text', fileSize: 150 }
    ])
  },
  {
    id: 'sample-003',
    track_name: '旧日之光',
    artist: '老王',
    revenue: 5000,
    share_ratio: 0.40,
    share_amount: 2000,
    status: 'old_standard',
    source: 'excel',
    original_note: '按老规矩分',
    current_note: '按老规矩分（旧口径比例60%，当前40%）',
    attachments: JSON.stringify([
      { id: 'sample-003-att-01', fileName: '旧日之光_旧口径说明.txt', storedPath: 'sample-003-att-01.txt', fileType: 'text', fileSize: 160 },
      { id: 'sample-003-att-02', fileName: '历史聊天记录.txt', storedPath: 'sample-003-att-02.txt', fileType: 'text', fileSize: 200 }
    ])
  },
]

const SAMPLE_JUDGMENTS = [
  { id: 'j-001-1', record_id: 'sample-001', step: 1, type: 'system_auto', description: '系统匹配到合同分账比例', result: '分账比例50%，分账金额6000元，状态标记为顺利' },
  { id: 'j-002-1', record_id: 'sample-002', step: 1, type: 'system_auto', description: '系统未找到合同分账比例', result: '分账比例缺失，状态标记为待确认' },
  { id: 'j-003-1', record_id: 'sample-003', step: 1, type: 'system_auto', description: '来自旧Excel，检测到比例与当前标准不一致', result: '旧口径比例60%与当前标准40%不一致，标记为旧口径' },
  { id: 'j-003-2', record_id: 'sample-003', step: 2, type: 'diff_detected', description: '补录备注后对比差异', result: '比例从旧口径60%调整为当前40%，差异原因：按新标准执行' },
]

function initTables(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      track_name TEXT NOT NULL,
      artist TEXT NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      share_ratio REAL,
      share_amount REAL,
      status TEXT NOT NULL CHECK(status IN ('smooth', 'needs_confirmation', 'old_standard')),
      source TEXT NOT NULL CHECK(source IN ('excel', 'audio', 'contract', 'chat_annotation')),
      original_note TEXT DEFAULT '',
      current_note TEXT DEFAULT '',
      attachments TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS judgment_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      step INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('system_auto', 'manual_override', 'note_added', 'diff_detected')),
      description TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      import_time TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      total_files INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      failed_files TEXT DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
    CREATE INDEX IF NOT EXISTS idx_records_source ON records(source);
    CREATE INDEX IF NOT EXISTS idx_judgment_logs_record_id ON judgment_logs(record_id);
  `)
}

function seedSampleData(d: Database.Database) {
  seedSampleAttachments()

  const count = d.prepare('SELECT COUNT(*) as cnt FROM records').get() as { cnt: number }

  if (count.cnt === 0) {
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
    const insertRecord = d.prepare(`
      INSERT INTO records (id, track_name, artist, revenue, share_ratio, share_amount, status, source, original_note, current_note, attachments, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertJudgment = d.prepare(`
      INSERT INTO judgment_logs (id, record_id, step, type, description, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const transaction = d.transaction(() => {
      for (const r of SAMPLE_RECORDS) {
        insertRecord.run(r.id, r.track_name, r.artist, r.revenue, r.share_ratio, r.share_amount, r.status, r.source, r.original_note, r.current_note, r.attachments, now, now)
      }
      for (const j of SAMPLE_JUDGMENTS) {
        insertJudgment.run(j.id, j.record_id, j.step, j.type, j.description, j.result, now)
      }
    })
    transaction()
    return
  }

  const resetRecord = d.prepare(`
    UPDATE records SET
      track_name = ?, artist = ?, revenue = ?, share_ratio = ?, share_amount = ?,
      status = ?, source = ?, original_note = ?, current_note = ?, attachments = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `)
  const resetJudgment = d.prepare(`
    INSERT OR REPLACE INTO judgment_logs (id, record_id, step, type, description, result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `)

  const sampleIds = SAMPLE_RECORDS.map(r => r.id)
  const sampleJudgmentIds = SAMPLE_JUDGMENTS.map(j => j.id)
  const jidPlaceholders = sampleJudgmentIds.length > 0 ? sampleJudgmentIds.map(() => '?').join(',') : 'SELECT NULL'

  const transaction = d.transaction(() => {
    for (const rid of sampleIds) {
      d.prepare(`DELETE FROM judgment_logs WHERE record_id = ? AND id NOT IN (${jidPlaceholders})`).run(rid, ...sampleJudgmentIds)
    }
    for (const r of SAMPLE_RECORDS) {
      const existing = d.prepare('SELECT id FROM records WHERE id = ?').get(r.id)
      if (existing) {
        resetRecord.run(r.track_name, r.artist, r.revenue, r.share_ratio, r.share_amount, r.status, r.source, r.original_note, r.current_note, r.attachments, r.id)
      } else {
        d.prepare(`
          INSERT INTO records (id, track_name, artist, revenue, share_ratio, share_amount, status, source, original_note, current_note, attachments, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
        `).run(r.id, r.track_name, r.artist, r.revenue, r.share_ratio, r.share_amount, r.status, r.source, r.original_note, r.current_note, r.attachments)
      }
    }
    for (const j of SAMPLE_JUDGMENTS) {
      resetJudgment.run(j.id, j.record_id, j.step, j.type, j.description, j.result)
    }
  })
  transaction()
}

export function getDb(): Database.Database {
  if (db) return db
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initTables(db)
  seedSampleData(db)
  return db
}
