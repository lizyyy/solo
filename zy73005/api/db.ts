import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'vaccine.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS dog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    breed TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_contact TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dog_alias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dog_id INTEGER NOT NULL,
    alias_name TEXT NOT NULL,
    is_conflict INTEGER DEFAULT 0,
    FOREIGN KEY (dog_id) REFERENCES dog(id)
  );

  CREATE TABLE IF NOT EXISTS vaccine_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dog_id INTEGER NOT NULL,
    vaccine_name TEXT NOT NULL,
    batch_no TEXT NOT NULL,
    inoculation_date TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    institution TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    source TEXT DEFAULT 'original',
    current_conclusion TEXT DEFAULT '',
    FOREIGN KEY (dog_id) REFERENCES dog(id)
  );

  CREATE TABLE IF NOT EXISTS weight_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dog_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    weight REAL,
    is_estimated INTEGER DEFAULT 0,
    FOREIGN KEY (dog_id) REFERENCES dog(id)
  );

  CREATE TABLE IF NOT EXISTS record_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (record_id) REFERENCES vaccine_record(id)
  );

  CREATE TABLE IF NOT EXISTS record_remark (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'supplementary',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (record_id) REFERENCES vaccine_record(id)
  );
`)

export function seedDemoData() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM dog').get() as { cnt: number }
  if (count.cnt > 0) return

  const insertDog = db.prepare(
    'INSERT INTO dog (id, name, breed, owner_name, owner_contact) VALUES (?, ?, ?, ?, ?)'
  )
  const insertAlias = db.prepare(
    'INSERT INTO dog_alias (id, dog_id, alias_name, is_conflict) VALUES (?, ?, ?, ?)'
  )
  const insertRecord = db.prepare(
    'INSERT INTO vaccine_record (id, dog_id, vaccine_name, batch_no, inoculation_date, valid_until, institution, status, source, current_conclusion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertWeight = db.prepare(
    'INSERT INTO weight_log (id, dog_id, date, weight, is_estimated) VALUES (?, ?, ?, ?, ?)'
  )
  const insertHistory = db.prepare(
    'INSERT INTO record_history (id, record_id, type, field, old_value, new_value, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const insertRemark = db.prepare(
    'INSERT INTO record_remark (id, record_id, content, type) VALUES (?, ?, ?, ?)'
  )

  const transaction = db.transaction(() => {
    insertDog.run(1, '大福', '金毛寻回犬', '李明', '13800138001')
    insertRecord.run(1, 1, '狂犬疫苗', 'RB2024001', '2024-03-15', '2025-03-15', '阳光宠物医院', 'reviewed', 'original', '合格')
    insertWeight.run(1, 1, '2024-01', 28.5, 0)
    insertWeight.run(2, 1, '2024-03', 29.2, 0)
    insertWeight.run(3, 1, '2024-06', 30.1, 0)
    insertWeight.run(4, 1, '2024-09', 30.8, 0)
    insertWeight.run(5, 1, '2024-12', 31.0, 0)
    insertHistory.run(1, 1, 'original', 'status', null, 'pending', null)
    insertHistory.run(2, 1, 'original', 'status', 'pending', 'reviewed', null)

    insertDog.run(2, '豆豆', '柴犬', '王芳', '13900139002')
    insertAlias.run(1, 2, '小黑', 0)
    insertAlias.run(2, 2, '旺财', 1)
    insertRecord.run(2, 2, '犬瘟热疫苗', 'CD2024003', '2024-05-20', '2025-05-20', '宠康诊所', 'pending', 'supplementary', '待复核')
    insertWeight.run(6, 2, '2024-01', 8.2, 0)
    insertWeight.run(7, 2, '2024-02', null, 0)
    insertWeight.run(8, 2, '2024-04', 8.8, 0)
    insertWeight.run(9, 2, '2024-05', null, 0)
    insertWeight.run(10, 2, '2024-07', 9.5, 1)
    insertWeight.run(11, 2, '2024-09', 10.1, 0)
    insertWeight.run(12, 2, '2024-11', null, 0)
    insertHistory.run(3, 2, 'original', 'status', null, 'pending', null)
    insertHistory.run(4, 2, 'supplementary', 'source', 'original', 'supplementary', '主人补充接种信息')
    insertHistory.run(5, 2, 'supplementary', 'institution', '宠康诊所', '宠康诊所(城东分院)', '主人更正接种地点')
    insertRemark.run(1, 2, '原始接种记录来自诊所系统', 'original')
    insertRemark.run(2, 2, '主人电话补充：实际接种地点为城东分院，非主院', 'supplementary')
    insertRemark.run(3, 2, '犬只别名"旺财"与系统内另一只犬同名，需注意区分', 'supplementary')

    insertDog.run(3, '旺财', '柯基犬', '张伟', '13700137003')
    insertRecord.run(3, 3, '六联疫苗', 'HEX2024007', '2024-04-10', '2025-04-10', '爱宠动物医院', 'reviewed', 'original', '合格')
    insertWeight.run(13, 3, '2024-02', 12.0, 0)
    insertWeight.run(14, 3, '2024-05', 12.5, 0)
    insertWeight.run(15, 3, '2024-08', 13.0, 0)
  })

  transaction()
}

seedDemoData()

export default db
