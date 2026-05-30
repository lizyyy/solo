import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dataDir = join(__dirname, '..', 'data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const dbPath = join(dataDir, 'vcard.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    employeeNo TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    usedAmount REAL NOT NULL DEFAULT 0,
    allowedMccs TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    cardNo TEXT NOT NULL,
    amount REAL NOT NULL,
    merchantName TEXT NOT NULL,
    mcc TEXT NOT NULL,
    transactionTime TEXT NOT NULL,
    employeeId TEXT NOT NULL,
    budgetId TEXT NOT NULL,
    reimbursementNo TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (employeeId) REFERENCES employees(id),
    FOREIGN KEY (budgetId) REFERENCES budgets(id)
  );

  CREATE TABLE IF NOT EXISTS risk_flags (
    id TEXT PRIMARY KEY,
    transactionId TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    detail TEXT NOT NULL,
    humanReason TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (transactionId) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS review_results (
    id TEXT PRIMARY KEY,
    transactionId TEXT NOT NULL UNIQUE,
    reviewer TEXT NOT NULL,
    decision TEXT NOT NULL,
    comment TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (transactionId) REFERENCES transactions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_employee ON transactions(employeeId);
  CREATE INDEX IF NOT EXISTS idx_transactions_budget ON transactions(budgetId);
  CREATE INDEX IF NOT EXISTS idx_risk_flags_transaction ON risk_flags(transactionId);
  CREATE INDEX IF NOT EXISTS idx_risk_flags_type ON risk_flags(type);
`)

const employeeCount = db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number }
if (employeeCount.count === 0) {
  const insertEmployee = db.prepare(
    'INSERT INTO employees (id, employeeNo, name, department) VALUES (?, ?, ?, ?)'
  )

  const insertBudget = db.prepare(
    'INSERT INTO budgets (id, name, totalAmount, usedAmount, allowedMccs) VALUES (?, ?, ?, ?, ?)'
  )

  const insertTransaction = db.prepare(
    `INSERT INTO transactions (id, cardNo, amount, merchantName, mcc, transactionTime, employeeId, budgetId, reimbursementNo, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const seedAll = db.transaction(() => {
    insertEmployee.run('emp-001', 'E001', '张三', '技术部')
    insertEmployee.run('emp-002', 'E002', '李四', '市场部')
    insertEmployee.run('emp-003', 'E003', '王五', '财务部')

    insertBudget.run(
      'bgt-001', '差旅费', 50000, 48500,
      JSON.stringify(['3000','3001','3002','3003','3500','3501','4000','4001','4002','4003','4004','4005','4006','4007','4008','4009','4010','4011'])
    )
    insertBudget.run(
      'bgt-002', '办公用品', 30000, 12000,
      JSON.stringify(['5940','5941','5942','5943','5944','5945','5946','5947','5948','5949','5950','5960','5961','5962','5963','5964','5965','5966','5967','5968','5969'])
    )
    insertBudget.run(
      'bgt-003', '业务招待', 20000, 8500,
      JSON.stringify(['5811','5812','5813','5814','5831','5832','5833','5834','5835','5836','5837','5838','5839','5840','5841','5842'])
    )

    const now = new Date()
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
    const daysAgo = (n: number) => {
      const d = new Date(now)
      d.setDate(d.getDate() - n)
      return fmt(d)
    }

    insertTransaction.run(
      'txn-001', '6225****8801', 3200, '东方航空', '3000',
      daysAgo(1), 'emp-001', 'bgt-001', 'RB202505001', 'pending'
    )
    insertTransaction.run(
      'txn-002', '6225****8802', 800, '高铁出行', '4001',
      daysAgo(1), 'emp-002', 'bgt-001', 'RB202505002', 'pending'
    )
    insertTransaction.run(
      'txn-003', '6225****8803', 350, '新华书店', '5942',
      daysAgo(2), 'emp-001', 'bgt-002', 'RB202505003', 'pending'
    )
    insertTransaction.run(
      'txn-004', '6225****8804', 1500, '百姓大药房', '5912',
      daysAgo(2), 'emp-002', 'bgt-001', 'RB202505004', 'pending'
    )
    insertTransaction.run(
      'txn-005', '6225****8805', 2000, '锦江酒店', '3501',
      daysAgo(3), 'emp-003', 'bgt-001', 'RB202505005', 'pending'
    )
    insertTransaction.run(
      'txn-006', '6225****8806', 2000, '锦江酒店', '3501',
      daysAgo(3), 'emp-003', 'bgt-001', 'RB202505006', 'pending'
    )
    insertTransaction.run(
      'txn-007', '6225****8807', 1200, '全聚德烤鸭', '5812',
      daysAgo(4), 'emp-001', 'bgt-003', 'RB202505007', 'pending'
    )
    insertTransaction.run(
      'txn-008', '6225****8808', 500, '7-11便利店', '5999',
      daysAgo(5), 'emp-002', 'bgt-002', 'RB202505008', 'pending'
    )
  })

  seedAll()
}

export default db
