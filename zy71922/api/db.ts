import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'inventory.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS artworks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    dimensions TEXT,
    dimension_unit TEXT DEFAULT 'cm',
    medium TEXT,
    year TEXT,
    status TEXT NOT NULL DEFAULT 'unchecked' CHECK(status IN ('unchecked','checked','disputed','corrected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS source_links (
    id TEXT PRIMARY KEY,
    artwork_id TEXT NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK(source_type IN ('insurance','lighting','artwork_list')),
    source_title TEXT NOT NULL,
    source_summary TEXT,
    source_data TEXT,
    imported_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS corrections (
    id TEXT PRIMARY KEY,
    artwork_id TEXT NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    reverted INTEGER NOT NULL DEFAULT 0,
    revert_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reverted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    artwork_id TEXT NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    current_value TEXT,
    dispute_reason TEXT NOT NULL,
    correction_basis TEXT,
    source_reference TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL CHECK(source_type IN ('insurance','lighting','artwork_list')),
    source_title TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS duplicates (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    existing_artwork_id TEXT NOT NULL REFERENCES artworks(id),
    incoming_data TEXT NOT NULL,
    match_fields TEXT NOT NULL,
    resolution TEXT CHECK(resolution IN ('merge','overwrite','skip')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(status);
  CREATE INDEX IF NOT EXISTS idx_source_links_artwork ON source_links(artwork_id);
  CREATE INDEX IF NOT EXISTS idx_source_links_type ON source_links(source_type);
  CREATE INDEX IF NOT EXISTS idx_corrections_artwork ON corrections(artwork_id);
  CREATE INDEX IF NOT EXISTS idx_disputes_artwork ON disputes(artwork_id);
  CREATE INDEX IF NOT EXISTS idx_disputes_resolved ON disputes(resolved);
  CREATE INDEX IF NOT EXISTS idx_duplicates_batch ON duplicates(batch_id);
  CREATE INDEX IF NOT EXISTS idx_duplicates_resolved ON duplicates(resolved_at);
`)

function seed() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM artworks').get() as { cnt: number }
  if (count.cnt > 0) return

  const artworks = [
    { id: uuidv4(), title: '荷塘月色', artist: '张大千', dimensions: '68×136', dimension_unit: 'cm', medium: '纸本水墨', year: '1973', status: 'checked' },
    { id: uuidv4(), title: '山水清音', artist: '黄宾虹', dimensions: '52×98', dimension_unit: 'cm', medium: '纸本设色', year: '1948', status: 'unchecked' },
    { id: uuidv4(), title: '奔马图', artist: '徐悲鸿', dimensions: '80×150', dimension_unit: 'cm', medium: '纸本水墨', year: '1941', status: 'disputed' },
    { id: uuidv4(), title: '虾趣图', artist: '齐白石', dimensions: '34×100', dimension_unit: 'cm', medium: '纸本水墨', year: '1948', status: 'checked' },
    { id: uuidv4(), title: '万山红遍', artist: '李可染', dimensions: '79×127', dimension_unit: 'cm', medium: '纸本设色', year: '1964', status: 'corrected' },
    { id: uuidv4(), title: '黄山云海', artist: '刘海粟', dimensions: '96×180', dimension_unit: 'cm', medium: '布面油画', year: '1982', status: 'unchecked' },
    { id: uuidv4(), title: '春山伴侣', artist: '傅抱石', dimensions: '45×68', dimension_unit: 'cm', medium: '纸本设色', year: '1956', status: 'checked' },
    { id: uuidv4(), title: '墨竹图', artist: '郑板桥', dimensions: '30×120', dimension_unit: 'cm', medium: '纸本水墨', year: '1756', status: 'unchecked' },
    { id: uuidv4(), title: '长江万里图', artist: '吴冠中', dimensions: '50×500', dimension_unit: 'cm', medium: '纸本设色', year: '1979', status: 'disputed' },
    { id: uuidv4(), title: '幽谷飞瀑', artist: '陆俨少', dimensions: '68×136', dimension_unit: 'cm', medium: '纸本设色', year: '1985', status: 'checked' },
  ]

  const insertArtwork = db.prepare(
    `INSERT INTO artworks (id, title, artist, dimensions, dimension_unit, medium, year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertSource = db.prepare(
    `INSERT INTO source_links (id, artwork_id, source_type, source_title, source_summary, source_data) VALUES (?, ?, ?, ?, ?, ?)`
  )
  const insertDispute = db.prepare(
    `INSERT INTO disputes (id, artwork_id, field, current_value, dispute_reason, correction_basis, source_reference) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const insertCorrection = db.prepare(
    `INSERT INTO corrections (id, artwork_id, field, old_value, new_value, reason) VALUES (?, ?, ?, ?, ?, ?)`
  )
  const insertBatch = db.prepare(
    `INSERT INTO import_batches (id, source_type, source_title, total_rows, imported_count, duplicate_count) VALUES (?, ?, ?, ?, ?, ?)`
  )
  const insertDuplicate = db.prepare(
    `INSERT INTO duplicates (id, batch_id, existing_artwork_id, incoming_data, match_fields) VALUES (?, ?, ?, ?, ?)`
  )

  const transaction = db.transaction(() => {
    for (const a of artworks) {
      insertArtwork.run(a.id, a.title, a.artist, a.dimensions, a.dimension_unit, a.medium, a.year, a.status)
    }

    insertSource.run(uuidv4(), artworks[0].id, 'insurance', '中国人民保险藏品清单', '张大千作品保险估值记录', JSON.stringify({ policy_no: 'PICC-1973-0042', insured_value: 5200000 }))
    insertSource.run(uuidv4(), artworks[0].id, 'artwork_list', '馆藏作品登记册', '馆藏张大千作品登记', JSON.stringify({ catalog_no: 'SC-001', acquisition: '1975年购藏' }))
    insertSource.run(uuidv4(), artworks[1].id, 'lighting', '展厅灯光配置单', '山水画展厅灯光参数', JSON.stringify({ lux: 150, color_temp: '3000K' }))
    insertSource.run(uuidv4(), artworks[2].id, 'insurance', '中国人民保险藏品清单', '徐悲鸿作品保险估值记录', JSON.stringify({ policy_no: 'PICC-1941-0018', insured_value: 8900000 }))
    insertSource.run(uuidv4(), artworks[2].id, 'artwork_list', '馆藏作品登记册', '馆藏徐悲鸿作品登记', JSON.stringify({ catalog_no: 'SC-023', acquisition: '1952年捐赠' }))
    insertSource.run(uuidv4(), artworks[3].id, 'artwork_list', '馆藏作品登记册', '馆藏齐白石作品登记', JSON.stringify({ catalog_no: 'SC-045', acquisition: '1950年购藏' }))
    insertSource.run(uuidv4(), artworks[4].id, 'insurance', '中国人民保险藏品清单', '李可染作品保险估值记录', JSON.stringify({ policy_no: 'PICC-1964-0007', insured_value: 12000000 }))
    insertSource.run(uuidv4(), artworks[4].id, 'artwork_list', '馆藏作品登记册', '馆藏李可染作品登记', JSON.stringify({ catalog_no: 'SC-067', acquisition: '1965年购藏' }))
    insertSource.run(uuidv4(), artworks[5].id, 'lighting', '展厅灯光配置单', '油画展厅灯光参数', JSON.stringify({ lux: 200, color_temp: '3500K' }))
    insertSource.run(uuidv4(), artworks[7].id, 'artwork_list', '馆藏作品登记册', '馆藏清代作品登记', JSON.stringify({ catalog_no: 'SC-089', acquisition: '1960年征集' }))
    insertSource.run(uuidv4(), artworks[8].id, 'insurance', '中国人民保险藏品清单', '吴冠中作品保险估值记录', JSON.stringify({ policy_no: 'PICC-1979-0033', insured_value: 6500000 }))

    insertDispute.run(uuidv4(), artworks[2].id, 'year', '1941', '保险记录与馆藏记录年份不一致，保险记录为1942年', '保险清单记录', 'PICC-1941-0018')

    insertCorrection.run(uuidv4(), artworks[4].id, 'dimensions', '79×127', '79.5×127.3', '经实物重新测量确认精确尺寸')
    insertCorrection.run(uuidv4(), artworks[4].id, 'year', '1964', '1963', '画家年谱记载创作时间为1963年秋')

    const batchId = uuidv4()
    insertBatch.run(batchId, 'insurance', '2024年保险续保清单', 1, 0, 1)
    insertDuplicate.run(uuidv4(), batchId, artworks[0].id, JSON.stringify({ title: '荷塘月色', artist: '张大千', dimensions: '70×140', medium: '纸本水墨', year: '1973' }), JSON.stringify(['title', 'artist']))
  })

  transaction()
}

seed()

export function getDb() {
  return db
}

export default db
