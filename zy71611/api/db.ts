import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'carbon.db');

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS emission_records (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  facility TEXT NOT NULL,
  emission_amount REAL NOT NULL,
  unit TEXT NOT NULL,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS allowance_accounts (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  account_no TEXT NOT NULL,
  allowance_amount REAL NOT NULL,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS trade_records (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  trade_date TEXT NOT NULL,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS hedging_contracts (
  id TEXT PRIMARY KEY,
  contract_no TEXT NOT NULL UNIQUE,
  period TEXT NOT NULL,
  locked_price REAL NOT NULL,
  quantity REAL NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS budget_entries (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  budget_amount REAL NOT NULL,
  category TEXT,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fund_reports (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  amount REAL NOT NULL,
  fund_type TEXT,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS gap_calculations (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  total_emission REAL NOT NULL,
  total_allowance REAL NOT NULL,
  gap REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'tCO2',
  calculated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS hedging_matches (
  id TEXT PRIMARY KEY,
  gap_id TEXT NOT NULL,
  hedging_id TEXT NOT NULL,
  matched_amount REAL NOT NULL,
  matched_price REAL NOT NULL,
  matched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS trace_records (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  trace_type TEXT NOT NULL,
  trace_label TEXT NOT NULL,
  trace_value REAL,
  source_type TEXT,
  source_id TEXT,
  source_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS anomalies (
  id TEXT PRIMARY KEY,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  explanation TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  related_source TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS data_conflicts (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  existing_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  resolution TEXT DEFAULT 'pending',
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_emission_period ON emission_records(period);
CREATE INDEX IF NOT EXISTS idx_allowance_period ON allowance_accounts(period);
CREATE INDEX IF NOT EXISTS idx_trade_period ON trade_records(period);
CREATE INDEX IF NOT EXISTS idx_hedging_period ON hedging_contracts(period);
CREATE INDEX IF NOT EXISTS idx_budget_period ON budget_entries(period);
CREATE INDEX IF NOT EXISTS idx_fund_period ON fund_reports(period);
CREATE INDEX IF NOT EXISTS idx_gap_period ON gap_calculations(period);
CREATE INDEX IF NOT EXISTS idx_trace_target ON trace_records(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(anomaly_type, resolved);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolution ON data_conflicts(resolution);
`;

export function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    db.exec(INDEXES);
  }
  return db;
}

export function initDb(): void {
  const d = getDb();
  const count = (d.prepare('SELECT COUNT(*) as c FROM emission_records').get() as any).c;
  if (count === 0) {
    seedData(d);
  }
}

function seedData(d: Database.Database): void {
  const now = new Date().toISOString();
  const period = '2025-Q2';

  const insertEmission = d.prepare(
    `INSERT INTO emission_records (id, period, facility, emission_amount, unit, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAllowance = d.prepare(
    `INSERT INTO allowance_accounts (id, period, account_no, allowance_amount, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertTrade = d.prepare(
    `INSERT INTO trade_records (id, period, price, quantity, trade_date, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertHedging = d.prepare(
    `INSERT INTO hedging_contracts (id, contract_no, period, locked_price, quantity, valid_from, valid_to, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertBudget = d.prepare(
    `INSERT INTO budget_entries (id, period, budget_amount, category, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertFund = d.prepare(
    `INSERT INTO fund_reports (id, period, amount, fund_type, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertAnomaly = d.prepare(
    `INSERT INTO anomalies (id, anomaly_type, severity, message, explanation, suggestion, related_source, resolved, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  );

  const tx = d.transaction(() => {
    insertEmission.run(uuidv4(), period, '热电厂1号机组', 125000, 'tCO2', '排放监测系统_2025Q2.xlsx', now);
    insertEmission.run(uuidv4(), period, '热电厂2号机组', 98000, 'tCO2', '排放监测系统_2025Q2.xlsx', now);
    insertEmission.run(uuidv4(), period, '化工厂A车间', 45000, 'tCO2e', '化工厂排放报告Q2.docx', now);
    insertEmission.run(uuidv4(), period, '钢铁厂B分厂', 32, 'ktCO2', '钢铁厂季度核算表.xlsx', now);
    insertEmission.run(uuidv4(), period, '水泥厂C线', 67000, 'tCO2', '水泥厂监测数据Q2.csv', now);

    insertAllowance.run(uuidv4(), period, 'CN-ALLOW-001', 200000, '配额账户明细_2025Q2.xlsx', now);
    insertAllowance.run(uuidv4(), period, 'CN-ALLOW-002', 80000, '配额账户明细_2025Q2.xlsx', now);
    insertAllowance.run(uuidv4(), period, 'CCER-001', 15000, 'CCER抵销台账.xlsx', now);

    insertTrade.run(uuidv4(), period, 68.5, 5000, '2025-04-15', '碳交易所成交记录.xlsx', now);
    insertTrade.run(uuidv4(), period, 69.2, 8000, '2025-05-03', '碳交易所成交记录.xlsx', now);
    insertTrade.run(uuidv4(), period, 70.1, 3000, '2025-05-20', '碳交易所成交记录.xlsx', now);
    insertTrade.run(uuidv4(), period, 68.8, 6000, '2025-06-10', '碳交易所成交记录.xlsx', now);

    insertHedging.run(uuidv4(), 'HED-2025-001', period, 65.0, 30000, '2025-04-01', '2025-06-30', '锁价合同台账.xlsx', now);
    insertHedging.run(uuidv4(), 'HED-2025-002', period, 66.5, 20000, '2025-04-01', '2025-06-30', '锁价合同台账.xlsx', now);
    insertHedging.run(uuidv4(), 'HED-2025-003', period, 67.0, 25000, '2025-05-01', '2025-07-31', '补充协议_锁价.xlsx', now);

    insertBudget.run(uuidv4(), period, 2500, '碳配额采购', '年度预算分配表.xlsx', now);
    insertBudget.run(uuidv4(), period, 800, 'CCER抵销', '年度预算分配表.xlsx', now);

    insertFund.run(uuidv4(), period, 1950000, '已锁价合约预付', '资金月报_6月.xlsx', now);
    insertFund.run(uuidv4(), period, 550000, '市场采购预付', '资金月报_6月.xlsx', now);

    insertAnomaly.run(
      uuidv4(), 'unit_error', 'warning',
      '钢铁厂B分厂排放单位为 ktCO2，非标准单位',
      '排放数据中使用了千吨(ktCO2)作为单位，系统将其乘以1000转换为tCO2。此为近似换算，实际可能存在微小差异。',
      '请核实原始数据单位，确认是否为千吨(tCO2×1000)或吨(tCO2)。',
      '钢铁厂季度核算表.xlsx', now
    );
    insertAnomaly.run(
      uuidv4(), 'unit_error', 'info',
      '化工厂A车间排放单位为 tCO2e，包含非CO2温室气体',
      'tCO2e(二氧化碳当量)包含了甲烷、氧化亚氮等温室气体的折算量，与纯CO2排放量存在差异。',
      '确认该数据是否已按全球变暖潜势(GWP)正确折算，建议在报告中注明当量含义。',
      '化工厂排放报告Q2.docx', now
    );
  });

  tx();
}
