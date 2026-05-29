import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../../data')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'monitor.db')
export const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rehearsals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      venue TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      musician_name TEXT NOT NULL,
      section TEXT NOT NULL,
      channel INTEGER NOT NULL,
      description TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      rehearsal_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      current_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (rehearsal_id) REFERENCES rehearsals(id)
    );

    CREATE INDEX IF NOT EXISTS idx_problems_channel ON problems(channel);
    CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
    CREATE INDEX IF NOT EXISTS idx_problems_rehearsal ON problems(rehearsal_id);

    CREATE TABLE IF NOT EXISTS problem_versions (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      parent_version INTEGER,
      musician_name TEXT NOT NULL,
      channel INTEGER NOT NULL,
      description TEXT NOT NULL,
      tuning_action TEXT,
      tuning_params TEXT,
      operator_name TEXT NOT NULL,
      change_reason TEXT,
      anomaly_info TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (problem_id) REFERENCES problems(id),
      UNIQUE(problem_id, version)
    );

    CREATE INDEX IF NOT EXISTS idx_versions_problem ON problem_versions(problem_id);
    CREATE INDEX IF NOT EXISTS idx_versions_version ON problem_versions(version);

    CREATE TABLE IF NOT EXISTS confirmations (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      musician_signed INTEGER NOT NULL DEFAULT 0,
      musician_signed_at TEXT,
      musician_signature TEXT,
      engineer_signed INTEGER NOT NULL DEFAULT 0,
      engineer_signed_at TEXT,
      engineer_signature TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (problem_id) REFERENCES problems(id),
      UNIQUE(problem_id, version)
    );

    CREATE TABLE IF NOT EXISTS anomaly_records (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      impact TEXT NOT NULL,
      next_action TEXT NOT NULL,
      related_problem_ids TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (problem_id) REFERENCES problems(id),
      FOREIGN KEY (version_id) REFERENCES problem_versions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomaly_records(type);
    CREATE INDEX IF NOT EXISTS idx_anomalies_problem ON anomaly_records(problem_id);

    INSERT OR IGNORE INTO rehearsals (id, name, date, venue, created_at) 
    VALUES ('default', '2024巡演彩排 - 第一场', datetime('now'), '本地演播厅', datetime('now'));
  `)
}

export function rowToProblem(row: any): Problem {
  return {
    id: row.id,
    musicianName: row.musician_name,
    section: row.section,
    channel: row.channel,
    description: row.description,
    discoveredAt: row.discovered_at,
    rehearsalId: row.rehearsal_id,
    status: row.status as Problem['status'],
    currentVersion: row.current_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function rowToVersion(row: any): ProblemVersion {
  return {
    id: row.id,
    problemId: row.problem_id,
    version: row.version,
    parentVersion: row.parent_version,
    musicianName: row.musician_name,
    channel: row.channel,
    description: row.description,
    tuningAction: row.tuning_action,
    tuningParams: row.tuning_params ? JSON.parse(row.tuning_params) : null,
    operatorName: row.operator_name,
    changeReason: row.change_reason,
    anomalyDetected: row.anomaly_info ? JSON.parse(row.anomaly_info) : null,
    createdAt: row.created_at,
  }
}

export function rowToConfirmation(row: any): Confirmation {
  return {
    id: row.id,
    problemId: row.problem_id,
    version: row.version,
    musicianSigned: !!row.musician_signed,
    musicianSignedAt: row.musician_signed_at,
    musicianSignature: row.musician_signature,
    engineerSigned: !!row.engineer_signed,
    engineerSignedAt: row.engineer_signed_at,
    engineerSignature: row.engineer_signature,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export function rowToAnomaly(row: any): AnomalyRecord {
  return {
    id: row.id,
    problemId: row.problem_id,
    versionId: row.version_id,
    type: row.type as AnomalyRecord['type'],
    reason: row.reason,
    impact: row.impact,
    nextAction: row.next_action,
    relatedProblemIds: row.related_problem_ids ? JSON.parse(row.related_problem_ids) : undefined,
    createdAt: row.created_at,
  }
}
