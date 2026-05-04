import { db } from './index';
import { logger } from '../utils/logger';

const SCHEMA_VERSION = 1;

export async function initializeSchema(): Promise<void> {
  logger.info('Initializing database schema...');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const currentVersion = await db.get<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );

  if (currentVersion && currentVersion.version >= SCHEMA_VERSION) {
    logger.info('Database schema is already up to date', { version: currentVersion.version });
    return;
  }

  await db.transaction(async () => {
    await db.exec(`
      CREATE TABLE employees (
        id TEXT PRIMARY KEY,
        employee_number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        bank_name TEXT NOT NULL,
        bank_account_number TEXT NOT NULL,
        bank_account_name TEXT NOT NULL,
        department TEXT NOT NULL,
        position TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (status IN ('active', 'inactive', 'suspended'))
      );

      CREATE INDEX idx_employees_employee_number ON employees(employee_number);
      CREATE INDEX idx_employees_status ON employees(status);
      CREATE INDEX idx_employees_department ON employees(department);

      CREATE TABLE payrolls (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        base_salary REAL NOT NULL DEFAULT 0,
        bonus REAL NOT NULL DEFAULT 0,
        allowance REAL NOT NULL DEFAULT 0,
        deduction REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        social_insurance REAL NOT NULL DEFAULT 0,
        housing_fund REAL NOT NULL DEFAULT 0,
        net_salary REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        UNIQUE (employee_id, year, month),
        CHECK (status IN ('pending', 'confirmed')),
        CHECK (month BETWEEN 1 AND 12)
      );

      CREATE INDEX idx_payrolls_employee_id ON payrolls(employee_id);
      CREATE INDEX idx_payrolls_year_month ON payrolls(year, month);
      CREATE INDEX idx_payrolls_status ON payrolls(status);

      CREATE TABLE batches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_records INTEGER NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        processed_records INTEGER NOT NULL DEFAULT 0,
        success_records INTEGER NOT NULL DEFAULT 0,
        failed_records INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        concurrency INTEGER NOT NULL DEFAULT 10,
        rate_limit INTEGER NOT NULL DEFAULT 100,
        chunk_size INTEGER NOT NULL DEFAULT 100,
        started_at DATETIME,
        completed_at DATETIME,
        failed_at DATETIME,
        paused_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
        CHECK (month BETWEEN 1 AND 12)
      );

      CREATE INDEX idx_batches_status ON batches(status);
      CREATE INDEX idx_batches_year_month ON batches(year, month);
      CREATE INDEX idx_batches_created_at ON batches(created_at);

      CREATE TABLE disbursements (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        payroll_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        amount REAL NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        error_message TEXT,
        error_code TEXT,
        external_transaction_id TEXT,
        processed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (payroll_id) REFERENCES payrolls(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled'))
      );

      CREATE INDEX idx_disbursements_batch_id ON disbursements(batch_id);
      CREATE INDEX idx_disbursements_payroll_id ON disbursements(payroll_id);
      CREATE INDEX idx_disbursements_employee_id ON disbursements(employee_id);
      CREATE INDEX idx_disbursements_status ON disbursements(status);
      CREATE INDEX idx_disbursements_idempotency_key ON disbursements(idempotency_key);
      CREATE INDEX idx_disbursements_created_at ON disbursements(created_at);
    `);

    await db.run(
      'INSERT INTO schema_version (version) VALUES (?)',
      [SCHEMA_VERSION]
    );
  });

  logger.info('Database schema initialized successfully', { version: SCHEMA_VERSION });
}

export async function dropAllTables(): Promise<void> {
  logger.warn('Dropping all tables...');
  
  await db.exec(`
    PRAGMA foreign_keys = OFF;
    
    DROP TABLE IF EXISTS disbursements;
    DROP TABLE IF EXISTS batches;
    DROP TABLE IF EXISTS payrolls;
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS schema_version;
    
    PRAGMA foreign_keys = ON;
  `);

  logger.warn('All tables dropped successfully');
}
