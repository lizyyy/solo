import db from '../config/database.js';

const initDatabase = () => {
  const createTables = [
    `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      platform TEXT NOT NULL,
      expected_annual_rate REAL NOT NULL,
      management_fee_rate REAL DEFAULT 0,
      redemption_fee_rate REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (product_type IN ('bank_wealth', 'money_market', 'broker_cash'))
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      account_number TEXT,
      bank_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS holders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holder_name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      holder_id INTEGER NOT NULL,
      principal REAL NOT NULL,
      share_ratio REAL NOT NULL,
      subscription_date DATE NOT NULL,
      value_date DATE NOT NULL,
      maturity_date DATE,
      actual_days INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (holder_id) REFERENCES holders(id),
      CHECK (status IN ('active', 'matured', 'redeemed', 'terminated'))
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS payout_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      rule_type TEXT NOT NULL DEFAULT 'actual/365',
      management_fee_calculation TEXT DEFAULT 'daily_accrual',
      redemption_fee_calculation TEXT DEFAULT 'fixed',
      payout_frequency TEXT DEFAULT 'maturity',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      CHECK (rule_type IN ('actual/360', 'actual/365', '30/360')),
      CHECK (management_fee_calculation IN ('daily_accrual', 'maturity_deduction', 'upfront')),
      CHECK (redemption_fee_calculation IN ('fixed', 'tiered')),
      CHECK (payout_frequency IN ('daily', 'monthly', 'quarterly', 'maturity'))
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS expected_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      payout_date DATE NOT NULL,
      expected_principal REAL NOT NULL DEFAULT 0,
      expected_interest REAL NOT NULL DEFAULT 0,
      expected_management_fee REAL NOT NULL DEFAULT 0,
      expected_redemption_fee REAL NOT NULL DEFAULT 0,
      expected_total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      period_start DATE,
      period_end DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
      CHECK (status IN ('pending', 'matched', 'partially_matched', 'unmatched', 'overpaid', 'underpaid'))
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      transaction_date DATE NOT NULL,
      transaction_amount REAL NOT NULL,
      transaction_type TEXT NOT NULL,
      description TEXT,
      reference_number TEXT,
      matched INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      CHECK (transaction_type IN ('income', 'expense', 'transfer', 'principal_return', 'interest', 'fee')),
      CHECK (matched IN (0, 1))
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS reconciliations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expected_payout_id INTEGER NOT NULL,
      transaction_id INTEGER,
      match_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_amount REAL NOT NULL,
      actual_amount REAL,
      difference REAL,
      difference_type TEXT,
      manual_adjustment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expected_payout_id) REFERENCES expected_payouts(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      CHECK (difference_type IN ('unmatched', 'underpaid', 'overpaid', 'early_redemption', 'fee_deduction', 'matched', 'manual'))
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reconciliation_id INTEGER NOT NULL,
      holder_id INTEGER NOT NULL,
      share_ratio REAL NOT NULL,
      allocated_principal REAL NOT NULL DEFAULT 0,
      allocated_interest REAL NOT NULL DEFAULT 0,
      allocated_management_fee REAL NOT NULL DEFAULT 0,
      allocated_redemption_fee REAL NOT NULL DEFAULT 0,
      allocated_difference REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id),
      FOREIGN KEY (holder_id) REFERENCES holders(id)
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 0,
      error_message TEXT,
      records_count INTEGER DEFAULT 0,
      CHECK (file_type IN ('products', 'transactions', 'payout_rules'))
    )
    `
  ];

  const createIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code)',
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_product ON subscriptions(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_holder ON subscriptions(holder_id)',
    'CREATE INDEX IF NOT EXISTS idx_expected_payouts_subscription ON expected_payouts(subscription_id)',
    'CREATE INDEX IF NOT EXISTS idx_expected_payouts_status ON expected_payouts(status)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_matched ON transactions(matched)',
    'CREATE INDEX IF NOT EXISTS idx_reconciliations_payout ON reconciliations(expected_payout_id)'
  ];

  db.transaction(() => {
    for (const sql of createTables) {
      db.exec(sql);
    }
    for (const sql of createIndexes) {
      try {
        db.exec(sql);
      } catch (e) {
        console.log('Index may already exist:', e.message);
      }
    }
  })();

  console.log('数据库初始化完成');
};

export default initDatabase;
