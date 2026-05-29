import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { v4 as uuidv4 } from 'uuid'

const DB_PATH = './data/restoration.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS artworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    era TEXT NOT NULL,
    material TEXT NOT NULL,
    dimensions TEXT NOT NULL,
    accession_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS restorations (
    id TEXT PRIMARY KEY,
    artwork_id TEXT NOT NULL REFERENCES artworks(id),
    restorer_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_progress','under_review','approved','rejected')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS restoration_steps (
    id TEXT PRIMARY KEY,
    restoration_id TEXT NOT NULL REFERENCES restorations(id),
    step_order INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cleaning','color_correction','reinforcement','other')),
    description TEXT NOT NULL,
    notes TEXT DEFAULT '',
    performed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS material_batches (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL REFERENCES restoration_steps(id),
    batch_number TEXT NOT NULL,
    name TEXT NOT NULL,
    supplier TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal','expired','batch_error')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL REFERENCES restoration_steps(id),
    url TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    phase TEXT NOT NULL CHECK(phase IN ('before','during','after')),
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS anomalies (
    id TEXT PRIMARY KEY,
    restoration_id TEXT NOT NULL REFERENCES restorations(id),
    step_id TEXT REFERENCES restoration_steps(id),
    material_id TEXT REFERENCES material_batches(id),
    type TEXT NOT NULL CHECK(type IN ('missing_photo','batch_number_error','step_order_inverted','material_expired')),
    severity TEXT NOT NULL CHECK(severity IN ('warning','error')),
    description TEXT NOT NULL,
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','corrected','confirmed'))
  );

  CREATE TABLE IF NOT EXISTS corrections (
    id TEXT PRIMARY KEY,
    anomaly_id TEXT NOT NULL REFERENCES anomalies(id),
    corrected_by TEXT NOT NULL,
    correction_type TEXT NOT NULL,
    before_value TEXT NOT NULL,
    after_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    corrected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS signatures (
    id TEXT PRIMARY KEY,
    restoration_id TEXT NOT NULL REFERENCES restorations(id),
    signer_name TEXT NOT NULL,
    signer_role TEXT NOT NULL CHECK(signer_role IN ('restorer','reviewer')),
    signature_data TEXT NOT NULL,
    signed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_restorations_artwork ON restorations(artwork_id);
  CREATE INDEX IF NOT EXISTS idx_steps_restoration ON restoration_steps(restoration_id);
  CREATE INDEX IF NOT EXISTS idx_materials_step ON material_batches(step_id);
  CREATE INDEX IF NOT EXISTS idx_photos_step ON photos(step_id);
  CREATE INDEX IF NOT EXISTS idx_anomalies_restoration ON anomalies(restoration_id);
  CREATE INDEX IF NOT EXISTS idx_corrections_anomaly ON corrections(anomaly_id);
  CREATE INDEX IF NOT EXISTS idx_signatures_restoration ON signatures(restoration_id);
`)

const count = db.prepare('SELECT COUNT(*) as cnt FROM artworks').get() as { cnt: number }
if (count.cnt === 0) {
  const seedArtworks = db.transaction(() => {
    const aw1 = uuidv4()
    const aw2 = uuidv4()
    const aw3 = uuidv4()

    const insertArtwork = db.prepare(`
      INSERT INTO artworks (id, name, era, material, dimensions, accession_number, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertArtwork.run(aw1, '清明上河图', '北宋', '绢本设色', '24.8cm × 528.7cm', 'BK20240001', 'in_progress', '2024-01-15 08:00:00', '2024-06-01 10:00:00')
    insertArtwork.run(aw2, '千里江山图', '北宋', '绢本青绿设色', '51.5cm × 1191.5cm', 'BK20240002', 'in_progress', '2024-02-10 09:00:00', '2024-07-15 14:00:00')
    insertArtwork.run(aw3, '富春山居图', '元代', '纸本水墨', '33cm × 636.9cm', 'BK20240003', 'pending', '2024-03-20 10:00:00', '2024-03-20 10:00:00')

    const r1 = uuidv4()
    const r2 = uuidv4()

    const insertRestoration = db.prepare(`
      INSERT INTO restorations (id, artwork_id, restorer_name, status, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertRestoration.run(r1, aw1, '张修复师', 'in_progress', '2024-03-01', null, '2024-03-01 08:00:00', '2024-06-01 10:00:00')
    insertRestoration.run(r2, aw2, '李修复师', 'under_review', '2024-04-15', '2024-07-10', '2024-04-15 09:00:00', '2024-07-15 14:00:00')

    const s1 = uuidv4()
    const s2 = uuidv4()
    const s3 = uuidv4()
    const s4 = uuidv4()
    const s5 = uuidv4()

    const insertStep = db.prepare(`
      INSERT INTO restoration_steps (id, restoration_id, step_order, type, description, notes, performed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertStep.run(s1, r1, 1, 'cleaning', '表面除尘清洁', '使用软毛刷轻扫表面灰尘', '2024-03-05 09:00:00', '2024-03-05 09:00:00')
    insertStep.run(s2, r1, 2, 'color_correction', '褪色区域补色', '采用矿物颜料进行局部补色', '2024-04-10 10:00:00', '2024-04-10 10:00:00')
    insertStep.run(s3, r1, 3, 'reinforcement', '绢本加固处理', '对断裂处进行背面加固', '2024-05-20 14:00:00', '2024-05-20 14:00:00')
    insertStep.run(s4, r2, 1, 'cleaning', '青绿颜料层清洁', '小心去除表面污渍', '2024-04-20 09:00:00', '2024-04-20 09:00:00')
    insertStep.run(s5, r2, 2, 'color_correction', '青绿色彩还原', '使用传统青绿矿物颜料', '2024-06-15 11:00:00', '2024-06-15 11:00:00')

    const m1 = uuidv4()
    const m2 = uuidv4()
    const m3 = uuidv4()
    const m4 = uuidv4()

    const insertMaterial = db.prepare(`
      INSERT INTO material_batches (id, step_id, batch_number, name, supplier, expiry_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertMaterial.run(m1, s1, 'CL20240101', '软毛刷清洁剂', '文保材料有限公司', '2025-06-01', 'normal', '2024-03-01 08:00:00')
    insertMaterial.run(m2, s2, 'CC20240202', '矿物颜料套装', '传统颜料坊', '2024-01-15', 'expired', '2024-04-01 08:00:00')
    insertMaterial.run(m3, s3, 'RG20240303', '蚕丝加固膜', '丝织保护科技', '2026-12-31', 'normal', '2024-05-01 08:00:00')
    insertMaterial.run(m4, s5, 'bad_number', '青绿矿物颜料', '古法颜料研究所', '2025-08-15', 'batch_error', '2024-06-01 08:00:00')

    const p1 = uuidv4()
    const p2 = uuidv4()
    const p3 = uuidv4()
    const p4 = uuidv4()
    const p5 = uuidv4()

    const insertPhoto = db.prepare(`
      INSERT INTO photos (id, step_id, url, version, phase, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insertPhoto.run(p1, s1, '/uploads/photo_before_1.jpg', 1, 'before', '2024-03-05 09:30:00')
    insertPhoto.run(p2, s1, '/uploads/photo_after_1.jpg', 1, 'after', '2024-03-05 11:00:00')
    insertPhoto.run(p3, s2, '/uploads/photo_before_2.jpg', 1, 'before', '2024-04-10 10:30:00')
    insertPhoto.run(p4, s4, '/uploads/photo_before_3.jpg', 1, 'before', '2024-04-20 09:30:00')
    insertPhoto.run(p5, s4, '/uploads/photo_after_3.jpg', 1, 'after', '2024-04-20 11:00:00')

    const a1 = uuidv4()
    const a2 = uuidv4()
    const a3 = uuidv4()

    const insertAnomaly = db.prepare(`
      INSERT INTO anomalies (id, restoration_id, step_id, material_id, type, severity, description, detected_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertAnomaly.run(a1, r1, s3, null, 'missing_photo', 'warning', '步骤"绢本加固处理"缺少照片记录', '2024-06-01 10:00:00', 'open')
    insertAnomaly.run(a2, r1, null, m2, 'material_expired', 'error', '材料"矿物颜料套装"已过期（有效期至2024-01-15）', '2024-06-01 10:00:00', 'open')
    insertAnomaly.run(a3, r2, null, m4, 'batch_number_error', 'error', '材料"青绿矿物颜料"批号格式不合规：bad_number', '2024-07-15 14:00:00', 'open')
  })

  seedArtworks()
}

export default db
