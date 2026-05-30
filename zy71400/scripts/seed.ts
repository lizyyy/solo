import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, '..', 'data.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id), direction TEXT NOT NULL, counterparty TEXT NOT NULL, amount REAL NOT NULL, term INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS collaterals (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id), trade_id TEXT NOT NULL REFERENCES trades(id), bond_code TEXT NOT NULL, bond_name TEXT NOT NULL, face_value REAL NOT NULL, quantity REAL NOT NULL, maturity_date TEXT NOT NULL, replacement_bond_code TEXT, replacement_status TEXT NOT NULL DEFAULT '无替换', source TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS discount_rates (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id), bond_code TEXT NOT NULL, rate REAL NOT NULL, effective_date TEXT NOT NULL, expiry_date TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS process_results (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id), collateral_id TEXT NOT NULL REFERENCES collaterals(id), trade_id TEXT NOT NULL REFERENCES trades(id), bond_code TEXT NOT NULL, discount_rate REAL NOT NULL, discount_amount REAL NOT NULL, conclusion TEXT NOT NULL DEFAULT '通过', warnings TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS review_records (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id), result_id TEXT NOT NULL REFERENCES process_results(id), status TEXT NOT NULL DEFAULT '待复核', reviewer TEXT NOT NULL DEFAULT '', reviewed_at TEXT, remark TEXT);
`)

function seed() {
  const batchId = uuidv4()
  db.prepare('INSERT INTO batches (id, name, date, status) VALUES (?, ?, ?, ?)').run(
    batchId, '样例批次-20260530', '2026-05-30', 'draft'
  )

  const trade1 = uuidv4()
  const trade2 = uuidv4()
  const trade3 = uuidv4()

  db.prepare('INSERT INTO trades (id, batch_id, direction, counterparty, amount, term, start_date, end_date, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    trade1, batchId, '正回购', '中国银行', 5000, 7, '2026-05-30', '2026-06-06', '交易中心成交单', 1
  )
  db.prepare('INSERT INTO trades (id, batch_id, direction, counterparty, amount, term, start_date, end_date, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    trade2, batchId, '正回购', '工商银行', 3000, 14, '2026-05-30', '2026-06-13', '交易中心成交单', 1
  )
  db.prepare('INSERT INTO trades (id, batch_id, direction, counterparty, amount, term, start_date, end_date, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    trade3, batchId, '逆回购', '建设银行', 8000, 1, '2026-05-30', '2026-05-31', 'Q群消息', 1
  )

  const c1 = uuidv4()
  const c2 = uuidv4()
  const c3 = uuidv4()
  const c4 = uuidv4()
  const c5 = uuidv4()

  db.prepare('INSERT INTO collaterals (id, batch_id, trade_id, bond_code, bond_name, face_value, quantity, maturity_date, replacement_status, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    c1, batchId, trade1, '230205.IB', '23国开05', 100, 3000, '2033-03-10', '无替换', '中债登', 1
  )
  db.prepare('INSERT INTO collaterals (id, batch_id, trade_id, bond_code, bond_name, face_value, quantity, maturity_date, replacement_status, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    c2, batchId, trade1, '220215.IB', '22国开15', 100, 2000, '2026-06-01', '待替换', '中债登', 1
  )
  db.prepare('INSERT INTO collaterals (id, batch_id, trade_id, bond_code, bond_name, face_value, quantity, maturity_date, replacement_bond_code, replacement_status, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    c3, batchId, trade2, '230205.IB', '23国开05', 100, 1500, '2033-03-10', '230215.IB', '已替换', '中债登', 1
  )
  db.prepare('INSERT INTO collaterals (id, batch_id, trade_id, bond_code, bond_name, face_value, quantity, maturity_date, replacement_status, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    c4, batchId, trade2, '220010.IB', '22附息国债10', 100, 1500, '2052-06-15', '无替换', '中债登', 1
  )
  db.prepare('INSERT INTO collaterals (id, batch_id, trade_id, bond_code, bond_name, face_value, quantity, maturity_date, replacement_status, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    c5, batchId, trade3, '230015.IB', '23附息国债15', 100, 5000, '2043-09-17', '无替换', 'Q群消息', 1
  )

  const r1 = uuidv4()
  const r2 = uuidv4()
  const r3 = uuidv4()

  db.prepare('INSERT INTO discount_rates (id, batch_id, bond_code, rate, effective_date, expiry_date, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    r1, batchId, '230205.IB', 95.00, '2026-01-01', '2026-12-31', '中债估值', 1
  )
  db.prepare('INSERT INTO discount_rates (id, batch_id, bond_code, rate, effective_date, expiry_date, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    r2, batchId, '220215.IB', 88.50, '2026-01-01', '2026-04-30', '中债估值', 1
  )
  db.prepare('INSERT INTO discount_rates (id, batch_id, bond_code, rate, effective_date, expiry_date, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    r3, batchId, '220010.IB', 92.00, '2026-01-01', '2026-12-31', '中债估值', 1
  )

  console.log(`样例数据已创建，批次ID: ${batchId}`)
  console.log(`  交易: 3笔 (trade1=${trade1.slice(0,8)}, trade2=${trade2.slice(0,8)}, trade3=${trade3.slice(0,8)})`)
  console.log(`  质押券: 5条`)
  console.log(`    - 23国开05 x 3000 (trade1, 与trade3的23国开05形成同券重复占用)`)
  console.log(`    - 22国开15 x 2000 (trade1, 到期日早于交易到期日+待替换 → 异常)`)
  console.log(`    - 23国开05 x 1500 (trade2, 已替换, 但与trade1的23国开05重复占用 → 异常)`)
  console.log(`    - 22附息国债10 x 1500 (trade2, 正常)`)
  console.log(`    - 23附息国债15 x 5000 (trade3, 无折算率 → 异常)`)
  console.log(`  折算率: 3条`)
  console.log(`    - 230205.IB: 95.00% (有效)`)
  console.log(`    - 220215.IB: 88.50% (已过期2026-04-30 → 折算率过期异常)`)
  console.log(`    - 220010.IB: 92.00% (有效)`)
  console.log(``)
  console.log(`预期处理结果:`)
  console.log(`  - c1: 异常 (同券重复占用: 230205.IB)`)
  console.log(`  - c2: 异常 (折算率过期 + 到期券未替换)`)
  console.log(`  - c3: 异常 (同券重复占用: 230205.IB)`)
  console.log(`  - c4: 通过`)
  console.log(`  - c5: 异常 (未找到折算率)`)

  db.close()
}

seed()
