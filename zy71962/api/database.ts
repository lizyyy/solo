import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'reconciliation.db')

let db: Database.Database | null = null

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_specs (
      id TEXT PRIMARY KEY,
      feature_name TEXT NOT NULL,
      training_spec TEXT,
      online_spec TEXT,
      is_consistent INTEGER,
      inconsistent_reason TEXT,
      judgment_basis TEXT,
      source TEXT NOT NULL DEFAULT 'import',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_feature_specs_name ON feature_specs(feature_name);
    CREATE INDEX IF NOT EXISTS idx_feature_specs_consistent ON feature_specs(is_consistent);
    CREATE INDEX IF NOT EXISTS idx_feature_specs_source ON feature_specs(source);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      operator TEXT NOT NULL,
      target_feature_id TEXT,
      target_feature_name TEXT,
      before_value TEXT,
      after_value TEXT,
      reason TEXT,
      filter_snapshot TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (target_feature_id) REFERENCES feature_specs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(operation_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS leak_alerts (
      id TEXT PRIMARY KEY,
      feature_name TEXT NOT NULL,
      source TEXT NOT NULL,
      description TEXT NOT NULL,
      next_step TEXT NOT NULL,
      responsible_person TEXT NOT NULL,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_leak_alerts_resolved ON leak_alerts(is_resolved);
    CREATE INDEX IF NOT EXISTS idx_leak_alerts_source ON leak_alerts(source);
  `)
}

function seedData(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM feature_specs').get() as { cnt: number }
  if (count.cnt > 0) return

  const now = new Date().toISOString()

  const features = [
    {
      id: uuidv4(), featureName: 'user_age', trainingSpec: 'int32', onlineSpec: 'int32',
      isConsistent: 1, inconsistentReason: null, judgmentBasis: '训练口径与线上口径完全匹配',
      source: 'import', version: 1, createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), featureName: 'user_income', trainingSpec: 'float64', onlineSpec: 'int64',
      isConsistent: 0, inconsistentReason: '训练口径使用float类型，线上口径使用int类型，存在类型不一致',
      judgmentBasis: '训练口径使用float类型，线上口径使用int类型，存在类型不一致',
      source: 'import', version: 1, createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), featureName: 'click_count_7d', trainingSpec: 'int32', onlineSpec: 'int32',
      isConsistent: 1, inconsistentReason: null, judgmentBasis: '训练口径与线上口径完全匹配',
      source: 'import', version: 1, createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), featureName: 'target_conversion', trainingSpec: 'float64', onlineSpec: 'string',
      isConsistent: 0, inconsistentReason: '训练口径使用float类型，线上口径使用string类型，存在类型不一致',
      judgmentBasis: '训练口径使用float类型，线上口径使用string类型，存在类型不一致',
      source: 'import', version: 1, createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), featureName: 'label_is_fraud', trainingSpec: 'int32', onlineSpec: 'bool',
      isConsistent: 0, inconsistentReason: '训练口径使用int类型，线上口径使用bool类型，存在类型不一致',
      judgmentBasis: '训练口径使用int类型，线上口径使用bool类型，存在类型不一致',
      source: 'import', version: 1, createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), featureName: 'device_type', trainingSpec: 'string', onlineSpec: 'string',
      isConsistent: 1, inconsistentReason: null, judgmentBasis: '训练口径与线上口径完全匹配',
      source: 'import', version: 1, createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), featureName: 'y_score', trainingSpec: 'float64', onlineSpec: null,
      isConsistent: null, inconsistentReason: null, judgmentBasis: null,
      source: 'import', version: 1, createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), featureName: 'register_days', trainingSpec: 'int32', onlineSpec: 'float64',
      isConsistent: 0, inconsistentReason: '训练口径使用int类型，线上口径使用float类型，存在类型不一致',
      judgmentBasis: '训练口径使用int类型，线上口径使用float类型，存在类型不一致',
      source: 'correction', version: 2, createdAt: now, updatedAt: now,
    },
  ]

  const insertFeature = db.prepare(`
    INSERT INTO feature_specs (id, feature_name, training_spec, online_spec, is_consistent, inconsistent_reason, judgment_basis, source, version, created_at, updated_at)
    VALUES (@id, @featureName, @trainingSpec, @onlineSpec, @isConsistent, @inconsistentReason, @judgmentBasis, @source, @version, @createdAt, @updatedAt)
  `)

  const insertAuditLog = db.prepare(`
    INSERT INTO audit_logs (id, operation_type, operator, target_feature_id, target_feature_name, before_value, after_value, reason, filter_snapshot, created_at)
    VALUES (@id, @operationType, @operator, @targetFeatureId, @targetFeatureName, @beforeValue, @afterValue, @reason, @filterSnapshot, @createdAt)
  `)

  const insertLeakAlert = db.prepare(`
    INSERT INTO leak_alerts (id, feature_name, source, description, next_step, responsible_person, is_resolved, detected_at, resolved_at)
    VALUES (@id, @featureName, @source, @description, @nextStep, @responsiblePerson, @isResolved, @detectedAt, @resolvedAt)
  `)

  const transaction = db.transaction(() => {
    for (const f of features) {
      insertFeature.run(f)
    }

    insertAuditLog.run({
      id: uuidv4(), operationType: 'import', operator: 'system',
      targetFeatureId: null, targetFeatureName: null,
      beforeValue: null, afterValue: null,
      reason: '批量导入8个特征口径', filterSnapshot: null, createdAt: now,
    })

    const leakAlerts = [
      {
        id: uuidv4(), featureName: 'target_conversion', source: 'evaluation_table',
        description: '特征名称包含"target"，疑似训练标签泄漏到特征中',
        nextStep: '移除该特征或确认其为合法目标变量', responsiblePerson: '算法团队-张三',
        isResolved: 0, detectedAt: now, resolvedAt: null,
      },
      {
        id: uuidv4(), featureName: 'label_is_fraud', source: 'online_feedback',
        description: '特征名称包含"label"，疑似标签信息泄漏',
        nextStep: '与业务方确认该特征是否应在线上使用', responsiblePerson: '数据团队-李四',
        isResolved: 0, detectedAt: now, resolvedAt: null,
      },
    ]

    for (const la of leakAlerts) {
      insertLeakAlert.run(la)
    }

    insertAuditLog.run({
      id: uuidv4(), operationType: 'leak_detected', operator: 'system',
      targetFeatureId: null, targetFeatureName: 'target_conversion',
      beforeValue: null, afterValue: null,
      reason: '特征名称包含"target"，疑似训练标签泄漏', filterSnapshot: null, createdAt: now,
    })

    insertAuditLog.run({
      id: uuidv4(), operationType: 'leak_detected', operator: 'system',
      targetFeatureId: null, targetFeatureName: 'label_is_fraud',
      beforeValue: null, afterValue: null,
      reason: '特征名称包含"label"，疑似标签信息泄漏', filterSnapshot: null, createdAt: now,
    })
  })

  transaction()
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir()
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    createTables(db)
    seedData(db)
  }
  return db
}
