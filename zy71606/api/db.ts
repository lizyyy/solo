import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.resolve(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'futures.db')

let dbInstance: Database.Database | null = null

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  dbInstance = new Database(DB_PATH)
  dbInstance.pragma('journal_mode = WAL')
  dbInstance.pragma('foreign_keys = ON')

  initTables(dbInstance)
  seedData(dbInstance)

  return dbInstance
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account TEXT NOT NULL UNIQUE,
      equity REAL NOT NULL DEFAULT 0,
      margin_used REAL NOT NULL DEFAULT 0,
      risk_rate REAL NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'safe',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      exchange TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      contract_id TEXT NOT NULL REFERENCES contracts(id),
      direction TEXT NOT NULL CHECK(direction IN ('long','short')),
      volume REAL NOT NULL,
      open_price REAL NOT NULL,
      margin REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS market_snapshots (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL REFERENCES contracts(id),
      last_price REAL NOT NULL,
      change_pct REAL NOT NULL DEFAULT 0,
      snapshot_time TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      type TEXT NOT NULL CHECK(type IN ('margin_call','warning','force_liquidation')),
      status TEXT NOT NULL CHECK(status IN ('draft','sent','confirmed','withdrawn','partially_deducted','settled')),
      margin_shortfall REAL NOT NULL DEFAULT 0,
      content TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      withdrawn_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_status_logs (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL REFERENCES notifications(id),
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      amount REAL NOT NULL,
      deposit_time TEXT NOT NULL,
      match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK(match_status IN ('unmatched','partially_matched','matched')),
      source_file TEXT,
      source_line INTEGER
    );

    CREATE TABLE IF NOT EXISTS deposit_matches (
      id TEXT PRIMARY KEY,
      deposit_id TEXT NOT NULL REFERENCES deposits(id),
      notification_id TEXT NOT NULL REFERENCES notifications(id),
      matched_amount REAL NOT NULL,
      matched_at TEXT NOT NULL DEFAULT (datetime('now')),
      match_type TEXT NOT NULL DEFAULT 'auto' CHECK(match_type IN ('auto','manual'))
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','validating','confirmed','cancelled')),
      total_rows INTEGER NOT NULL DEFAULT 0,
      success_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS import_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES import_batches(id),
      row_number INTEGER NOT NULL,
      data_type TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','error','skipped')),
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      filter_params TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      generated_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_snapshots (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES reports(id),
      content_json TEXT NOT NULL,
      snapshot_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_positions_client ON positions(client_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications(client_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
    CREATE INDEX IF NOT EXISTS idx_deposits_client ON deposits(client_id);
    CREATE INDEX IF NOT EXISTS idx_deposits_match_status ON deposits(match_status);
    CREATE INDEX IF NOT EXISTS idx_deposit_matches_notification ON deposit_matches(notification_id);
    CREATE INDEX IF NOT EXISTS idx_market_snapshots_contract_time ON market_snapshots(contract_id, snapshot_time);
    CREATE INDEX IF NOT EXISTS idx_import_records_batch ON import_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_notification ON notification_status_logs(notification_id);
    CREATE INDEX IF NOT EXISTS idx_report_snapshots_report ON report_snapshots(report_id);
  `)
}

function seedData(db: Database.Database): void {
  const clientCount = db.prepare('SELECT COUNT(*) as cnt FROM clients').get() as { cnt: number }
  if (clientCount.cnt > 0) return

  const now = new Date().toISOString()

  const insertClient = db.prepare(`
    INSERT INTO clients (id, name, account, equity, margin_used, risk_rate, risk_level, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertContract = db.prepare(`
    INSERT INTO contracts (id, code, name, exchange)
    VALUES (?, ?, ?, ?)
  `)
  const insertPosition = db.prepare(`
    INSERT INTO positions (id, client_id, contract_id, direction, volume, open_price, margin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertSnapshot = db.prepare(`
    INSERT INTO market_snapshots (id, contract_id, last_price, change_pct, snapshot_time, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, client_id, type, status, margin_shortfall, content, idempotency_key, created_at, sent_at, withdrawn_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertDeposit = db.prepare(`
    INSERT INTO deposits (id, client_id, amount, deposit_time, match_status, source_file, source_line)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertStatusLog = db.prepare(`
    INSERT INTO notification_status_logs (id, notification_id, from_status, to_status, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    const contracts = [
      { id: uuidv4(), code: 'CU2507', name: '沪铜2507', exchange: 'SHFE' },
      { id: uuidv4(), code: 'AL2507', name: '沪铝2507', exchange: 'SHFE' },
      { id: uuidv4(), code: 'RB2510', name: '螺纹钢2510', exchange: 'SHFE' },
      { id: uuidv4(), code: 'IF2506', name: '沪深300股指2506', exchange: 'CFFEX' },
      { id: uuidv4(), code: 'AU2508', name: '沪金2508', exchange: 'SHFE' },
      { id: uuidv4(), code: 'AG2507', name: '沪银2507', exchange: 'SHFE' },
    ]
    for (const c of contracts) {
      insertContract.run(c.id, c.code, c.name, c.exchange)
    }

    const clients = [
      { id: uuidv4(), name: '张三', account: 'A001', equity: 500000, margin_used: 200000, risk_rate: 40, risk_level: 'safe' },
      { id: uuidv4(), name: '李四', account: 'A002', equity: 300000, margin_used: 150000, risk_rate: 50, risk_level: 'safe' },
      { id: uuidv4(), name: '王五', account: 'A003', equity: 200000, margin_used: 220000, risk_rate: 110, risk_level: 'warning' },
      { id: uuidv4(), name: '赵六', account: 'A004', equity: 150000, margin_used: 195000, risk_rate: 130, risk_level: 'margin_call' },
      { id: uuidv4(), name: '钱七', account: 'A005', equity: 100000, margin_used: 145000, risk_rate: 145, risk_level: 'margin_call' },
      { id: uuidv4(), name: '孙八', account: 'A006', equity: 80000, margin_used: 128000, risk_rate: 160, risk_level: 'force_liquidation' },
      { id: uuidv4(), name: '周九', account: 'A007', equity: 600000, margin_used: 180000, risk_rate: 30, risk_level: 'safe' },
      { id: uuidv4(), name: '吴十', account: 'A008', equity: 120000, margin_used: 156000, risk_rate: 130, risk_level: 'warning' },
    ]
    for (const c of clients) {
      insertClient.run(c.id, c.name, c.account, c.equity, c.margin_used, c.risk_rate, c.risk_level, now)
    }

    const positions = [
      { id: uuidv4(), client_id: clients[0].id, contract_id: contracts[0].id, direction: 'long', volume: 5, open_price: 72000, margin: 108000 },
      { id: uuidv4(), client_id: clients[0].id, contract_id: contracts[1].id, direction: 'short', volume: 10, open_price: 20500, margin: 92000 },
      { id: uuidv4(), client_id: clients[1].id, contract_id: contracts[2].id, direction: 'long', volume: 20, open_price: 3600, margin: 72000 },
      { id: uuidv4(), client_id: clients[1].id, contract_id: contracts[3].id, direction: 'short', volume: 2, open_price: 3900, margin: 78000 },
      { id: uuidv4(), client_id: clients[2].id, contract_id: contracts[0].id, direction: 'long', volume: 3, open_price: 72500, margin: 108750 },
      { id: uuidv4(), client_id: clients[2].id, contract_id: contracts[4].id, direction: 'long', volume: 2, open_price: 560, margin: 111250 },
      { id: uuidv4(), client_id: clients[3].id, contract_id: contracts[5].id, direction: 'short', volume: 15, open_price: 8200, margin: 123000 },
      { id: uuidv4(), client_id: clients[3].id, contract_id: contracts[2].id, direction: 'long', volume: 10, open_price: 3650, margin: 72000 },
      { id: uuidv4(), client_id: clients[4].id, contract_id: contracts[3].id, direction: 'long', volume: 3, open_price: 3850, margin: 115500 },
      { id: uuidv4(), client_id: clients[4].id, contract_id: contracts[4].id, direction: 'short', volume: 1, open_price: 565, margin: 29500 },
      { id: uuidv4(), client_id: clients[5].id, contract_id: contracts[0].id, direction: 'long', volume: 4, open_price: 73000, margin: 116800 },
      { id: uuidv4(), client_id: clients[5].id, contract_id: contracts[5].id, direction: 'short', volume: 5, open_price: 8300, margin: 11200 },
      { id: uuidv4(), client_id: clients[6].id, contract_id: contracts[1].id, direction: 'long', volume: 8, open_price: 20400, margin: 73440 },
      { id: uuidv4(), client_id: clients[6].id, contract_id: contracts[4].id, direction: 'long', volume: 3, open_price: 555, margin: 106560 },
    ]
    for (const p of positions) {
      insertPosition.run(p.id, p.client_id, p.contract_id, p.direction, p.volume, p.open_price, p.margin)
    }

    for (const c of contracts) {
      const basePrice = [73500, 20800, 3550, 3920, 570, 8150][contracts.indexOf(c)]
      const change = [-0.8, 1.2, -0.5, 0.3, 1.5, -1.0][contracts.indexOf(c)]
      insertSnapshot.run(uuidv4(), c.id, basePrice, change, now, 'seed')
    }

    const today = new Date().toISOString().split('T')[0]
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()

    const n1Id = uuidv4()
    insertNotification.run(
      n1Id, clients[3].id, 'margin_call', 'sent', 45000,
      '尊敬的赵六客户，您的账户风险率已达130%，请及时追加保证金。',
      `${clients[3].id}_${today}_margin_call`, threeDaysAgo, threeDaysAgo, null
    )
    insertStatusLog.run(uuidv4(), n1Id, 'draft', 'sent', '系统自动发送', threeDaysAgo)

    const n2Id = uuidv4()
    insertNotification.run(
      n2Id, clients[4].id, 'margin_call', 'sent', 45000,
      '尊敬的钱七客户，您的账户风险率已达145%，请立即追加保证金。',
      `${clients[4].id}_${today}_margin_call`, threeDaysAgo, threeDaysAgo, null
    )
    insertStatusLog.run(uuidv4(), n2Id, 'draft', 'sent', '系统自动发送', threeDaysAgo)

    const n3Id = uuidv4()
    insertNotification.run(
      n3Id, clients[5].id, 'force_liquidation', 'sent', 48000,
      '尊敬的孙八客户，您的账户风险率已超过150%，即将执行强平。',
      `${clients[5].id}_${today}_force_liquidation`, threeDaysAgo, threeDaysAgo, null
    )
    insertStatusLog.run(uuidv4(), n3Id, 'draft', 'sent', '系统自动发送', threeDaysAgo)

    const n4Id = uuidv4()
    insertNotification.run(
      n4Id, clients[2].id, 'warning', 'sent', 20000,
      '尊敬的王五客户，您的账户风险率已达110%，请关注账户风险。',
      `${clients[2].id}_${today}_warning`, threeDaysAgo, threeDaysAgo, null
    )
    insertStatusLog.run(uuidv4(), n4Id, 'draft', 'sent', '系统自动发送', threeDaysAgo)

    insertDeposit.run(uuidv4(), clients[3].id, 30000, new Date(Date.now() - 2 * 86400000).toISOString(), 'unmatched', null, null)
    insertDeposit.run(uuidv4(), clients[4].id, 20000, new Date(Date.now() - 1 * 86400000).toISOString(), 'unmatched', null, null)
    insertDeposit.run(uuidv4(), clients[5].id, 50000, new Date(Date.now() - 1 * 86400000).toISOString(), 'unmatched', null, null)
  })

  transaction()
}
