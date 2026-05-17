import { runQuery } from './connection';

export async function createTables(): Promise<void> {
  const defectsTable = `
    CREATE TABLE IF NOT EXISTS defects (
      id TEXT PRIMARY KEY,
      procurement_order_no TEXT NOT NULL,
      equipment_no TEXT NOT NULL,
      defect_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      inspector TEXT NOT NULL,
      registered_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )
  `;

  const defectPhotosTable = `
    CREATE TABLE IF NOT EXISTS defect_photos (
      id TEXT PRIMARY KEY,
      defect_id TEXT NOT NULL,
      url TEXT NOT NULL,
      filename TEXT NOT NULL,
      uploaded_at DATETIME NOT NULL,
      uploaded_by TEXT NOT NULL,
      FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE CASCADE
    )
  `;

  const rectificationTable = `
    CREATE TABLE IF NOT EXISTS rectification_requirements (
      id TEXT PRIMARY KEY,
      defect_id TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      deadline DATETIME NOT NULL,
      responsible_person TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE CASCADE
    )
  `;

  const reinspectionsTable = `
    CREATE TABLE IF NOT EXISTS reinspection_records (
      id TEXT PRIMARY KEY,
      defect_id TEXT NOT NULL,
      inspector TEXT NOT NULL,
      inspection_date DATETIME NOT NULL,
      result TEXT NOT NULL,
      remarks TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE CASCADE
    )
  `;

  const acceptanceReportsTable = `
    CREATE TABLE IF NOT EXISTS acceptance_reports (
      id TEXT PRIMARY KEY,
      procurement_order_no TEXT NOT NULL,
      equipment_nos TEXT NOT NULL,
      generated_at DATETIME NOT NULL,
      generated_by TEXT NOT NULL,
      total_defects INTEGER NOT NULL,
      passed_defects INTEGER NOT NULL,
      pending_defects INTEGER NOT NULL,
      status TEXT NOT NULL,
      content TEXT
    )
  `;

  const exceptionLogsTable = `
    CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      raw_input TEXT,
      error_message TEXT NOT NULL,
      error_stack TEXT,
      handling_basis TEXT NOT NULL,
      created_at DATETIME NOT NULL
    )
  `;

  const idempotencyKeysTable = `
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      endpoint TEXT NOT NULL,
      response_data TEXT,
      created_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL
    )
  `;

  const manualCorrectionsTable = `
    CREATE TABLE IF NOT EXISTS manual_corrections (
      id TEXT PRIMARY KEY,
      defect_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (defect_id) REFERENCES defects(id) ON DELETE CASCADE
    )
  `;

  await runQuery(defectsTable);
  await runQuery(defectPhotosTable);
  await runQuery(rectificationTable);
  await runQuery(reinspectionsTable);
  await runQuery(acceptanceReportsTable);
  await runQuery(exceptionLogsTable);
  await runQuery(idempotencyKeysTable);
  await runQuery(manualCorrectionsTable);

  console.log('数据库表创建完成');
}

export async function dropTables(): Promise<void> {
  await runQuery('DROP TABLE IF EXISTS manual_corrections');
  await runQuery('DROP TABLE IF EXISTS idempotency_keys');
  await runQuery('DROP TABLE IF EXISTS exception_logs');
  await runQuery('DROP TABLE IF EXISTS acceptance_reports');
  await runQuery('DROP TABLE IF EXISTS reinspection_records');
  await runQuery('DROP TABLE IF EXISTS rectification_requirements');
  await runQuery('DROP TABLE IF EXISTS defect_photos');
  await runQuery('DROP TABLE IF EXISTS defects');
  console.log('数据库表删除完成');
}
