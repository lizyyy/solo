import fs from 'fs';
import path from 'path';
import db from './database';

const initSQL = `
CREATE TABLE IF NOT EXISTS reconciliation_records (
    id TEXT PRIMARY KEY,
    trade_date TEXT NOT NULL,
    expected_arrival_date TEXT NOT NULL,
    actual_arrival_date TEXT NOT NULL,
    amount REAL NOT NULL,
    fund_code TEXT NOT NULL,
    futures_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    has_manual_modification INTEGER NOT NULL DEFAULT 0,
    modification_type TEXT,
    modified_by TEXT,
    modified_at TEXT,
    modification_reason TEXT,
    why_kept TEXT,
    missing_materials TEXT,
    next_action TEXT,
    last_updated_by TEXT,
    last_updated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tail_adjustments (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by TEXT NOT NULL,
    adjusted_at TEXT NOT NULL,
    affects_reconciliation INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (record_id) REFERENCES reconciliation_records(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    operator TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    affected_results TEXT,
    FOREIGN KEY (record_id) REFERENCES reconciliation_records(id)
);

CREATE TABLE IF NOT EXISTS review_records (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    status TEXT NOT NULL,
    comment TEXT,
    reviewed_at TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES reconciliation_records(id)
);

CREATE TABLE IF NOT EXISTS holidays (
    date TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_status ON reconciliation_records(status);
CREATE INDEX IF NOT EXISTS idx_records_modification ON reconciliation_records(has_manual_modification);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_record ON tail_adjustments(record_id);
`;

const demoDataSQL = `
INSERT OR IGNORE INTO holidays (date, name, type) VALUES
('2024-05-01', '劳动节', 'public_holiday'),
('2024-05-02', '劳动节', 'public_holiday'),
('2024-05-03', '劳动节', 'public_holiday'),
('2024-06-10', '端午节', 'public_holiday'),
('2024-09-17', '中秋节', 'public_holiday'),
('2024-10-01', '国庆节', 'public_holiday'),
('2024-10-02', '国庆节', 'public_holiday'),
('2024-10-03', '国庆节', 'public_holiday'),
('2024-10-04', '国庆节', 'public_holiday'),
('2024-10-07', '国庆节', 'public_holiday');

INSERT OR IGNORE INTO reconciliation_records VALUES
('demo-001', '2024-04-30', '2024-05-02', '2024-05-06', 1500000.00, 'FUND-001', 'IF2405', 'reviewing', 1, 't1_to_t2', '张三', '2024-05-05 14:30:00', '节假日顺延+手工调整', '因五一节假日顺延至5月5日，但实际到账为5月6日，存在1天手工延迟', '银行交割凭证、支付平台流水单', '请基金经理复核T+1→T+2修改原因，确认后联系支付平台阿南', '支付平台阿南', '2024-05-05 15:00:00', '2024-05-05 10:00:00', '2024-05-05 15:00:00'),
('demo-002', '2024-06-08', '2024-06-11', '2024-06-11', 850000.00, 'FUND-002', 'IC2406', 'pending', 0, NULL, NULL, NULL, NULL, '端午节后第一个工作日到账，正常', '', '无需处理', '系统', '2024-06-11 09:00:00', '2024-06-11 09:00:00', '2024-06-11 09:00:00'),
('demo-003', '2024-09-16', '2024-09-18', '2024-09-19', 2200000.00, 'FUND-001', 'IF2409', 'pending', 1, 't1_to_t2', '李四', '2024-09-18 16:45:00', '中秋节假日影响', '中秋节假日后银行清算延迟', '交割确认书', '请补录尾差调整后更新对账说明', '支付平台阿南', '2024-09-18 17:00:00', '2024-09-18 10:00:00', '2024-09-18 17:00:00');

INSERT OR IGNORE INTO tail_adjustments VALUES
('adj-001', 'demo-003', 125.50, '银行手续费尾差调整', '支付平台阿南', '2024-09-19 11:30:00', 1);

INSERT OR IGNORE INTO audit_logs VALUES
('audit-001', 'demo-001', 'import', NULL, NULL, NULL, '导入交割数据', '系统', 'system', '2024-05-05 10:00:00', '预期到账日、金额、基金代码'),
('audit-002', 'demo-001', 'modify', 'actual_arrival_date', '2024-05-05', '2024-05-06', '手工调整到账日', '张三', 'product_manager', '2024-05-05 14:30:00', '对账状态变为reviewing，触发基金经理复核'),
('audit-003', 'demo-001', 'modify', 'why_kept', NULL, '因五一节假日顺延至5月5日，但实际到账为5月6日，存在1天手工延迟', '更新对账说明', '支付平台阿南', 'product_manager', '2024-05-05 15:00:00', '对账说明同步更新'),
('audit-004', 'demo-003', 'adjust', NULL, NULL, NULL, '补录尾差调整', '支付平台阿南', 'product_manager', '2024-09-19 11:30:00', '对账说明自动更新，增加尾差调整说明');
`;

function initDatabase() {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db.exec(initSQL);
  console.log('数据库表结构初始化完成');

  db.exec(demoDataSQL);
  console.log('演示数据初始化完成');

  console.log('数据库初始化成功！');
}

initDatabase();
