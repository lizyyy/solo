import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockAdjustments, mockCustodyConfirmations, mockProcessNodes } from '../../shared/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'carbon_trading.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS tail_adjustments (
      id TEXT PRIMARY KEY,
      trade_date TEXT NOT NULL,
      adjustment_no TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      remark TEXT NOT NULL,
      has_zero_amount_but_reversed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      custody_confirm_id TEXT,
      import_time TEXT NOT NULL,
      import_operator TEXT NOT NULL,
      review_time TEXT,
      review_operator TEXT,
      review_comment TEXT,
      FOREIGN KEY (custody_confirm_id) REFERENCES custody_confirmations(id)
    );

    CREATE TABLE IF NOT EXISTS custody_confirmations (
      id TEXT PRIMARY KEY,
      adjustment_id TEXT NOT NULL,
      voucher_no TEXT NOT NULL UNIQUE,
      custody_date TEXT NOT NULL,
      amount REAL NOT NULL,
      custodian TEXT NOT NULL,
      handler TEXT NOT NULL,
      signature_url TEXT,
      has_scanned_copy INTEGER NOT NULL DEFAULT 0,
      supplementary_fields TEXT NOT NULL,
      create_time TEXT NOT NULL,
      update_time TEXT NOT NULL,
      FOREIGN KEY (adjustment_id) REFERENCES tail_adjustments(id)
    );

    CREATE TABLE IF NOT EXISTS process_nodes (
      id TEXT PRIMARY KEY,
      adjustment_id TEXT NOT NULL,
      step TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (adjustment_id) REFERENCES tail_adjustments(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tail_adjustments_status ON tail_adjustments(status);
    CREATE INDEX IF NOT EXISTS idx_tail_adjustments_trade_date ON tail_adjustments(trade_date);
    CREATE INDEX IF NOT EXISTS idx_custody_confirmations_adjustment_id ON custody_confirmations(adjustment_id);
    CREATE INDEX IF NOT EXISTS idx_process_nodes_adjustment_id ON process_nodes(adjustment_id);
  `);

  const countStmt = database.prepare('SELECT COUNT(*) as count FROM tail_adjustments');
  const result = countStmt.get() as { count: number };
  
  if (result.count === 0) {
    const insertAdjustment = database.prepare(`
      INSERT INTO tail_adjustments (
        id, trade_date, adjustment_no, amount, remark, 
        has_zero_amount_but_reversed, status, custody_confirm_id,
        import_time, import_operator, review_time, review_operator, review_comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCustody = database.prepare(`
      INSERT INTO custody_confirmations (
        id, adjustment_id, voucher_no, custody_date, amount,
        custodian, handler, signature_url, has_scanned_copy,
        supplementary_fields, create_time, update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertProcess = database.prepare(`
      INSERT INTO process_nodes (
        id, adjustment_id, step, operator, operator_role,
        action, comment, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = database.transaction(() => {
      for (const adj of mockAdjustments) {
        insertAdjustment.run(
          adj.id,
          adj.tradeDate,
          adj.adjustmentNo,
          adj.amount,
          adj.remark,
          adj.hasZeroAmountButReversed ? 1 : 0,
          adj.status,
          adj.custodyConfirmId || null,
          adj.importTime,
          adj.importOperator,
          adj.reviewTime || null,
          adj.reviewOperator || null,
          adj.reviewComment || null
        );
      }

      for (const custody of mockCustodyConfirmations) {
        insertCustody.run(
          custody.id,
          custody.adjustmentId,
          custody.voucherNo,
          custody.custodyDate,
          custody.amount,
          custody.custodian,
          custody.handler,
          custody.signatureUrl || null,
          custody.hasScannedCopy ? 1 : 0,
          JSON.stringify(custody.supplementaryFields),
          custody.createTime,
          custody.updateTime
        );
      }

      for (const node of mockProcessNodes) {
        insertProcess.run(
          node.id,
          node.adjustmentId,
          node.step,
          node.operator,
          node.operatorRole,
          node.action,
          node.comment || null,
          node.timestamp
        );
      }
    });

    transaction();
  }
}
