import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'app.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS param_versions (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    imported_by TEXT NOT NULL DEFAULT 'system',
    item_count INTEGER NOT NULL DEFAULT 0,
    change_summary TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS param_items (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES param_versions(id),
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    is_denominator_zero INTEGER NOT NULL DEFAULT 0,
    raw_denominator_value TEXT NOT NULL DEFAULT '',
    review_status TEXT NOT NULL DEFAULT 'normal' CHECK (review_status IN ('normal', 'pending_review', 'reviewed'))
);
CREATE INDEX IF NOT EXISTS idx_param_items_version ON param_items(version_id);
CREATE INDEX IF NOT EXISTS idx_param_items_name ON param_items(name);
CREATE TABLE IF NOT EXISTS counterexamples (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT NOT NULL,
    note_raw TEXT NOT NULL,
    expected_value TEXT NOT NULL,
    actual_value TEXT NOT NULL,
    source_param_id TEXT REFERENCES param_items(id),
    has_conflict INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conflicts (
    id TEXT PRIMARY KEY,
    param_item_id TEXT NOT NULL REFERENCES param_items(id),
    counterexample_id TEXT NOT NULL REFERENCES counterexamples(id),
    param_value TEXT NOT NULL,
    counterexample_value TEXT NOT NULL,
    counterexample_note TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
CREATE TABLE IF NOT EXISTS adjudications (
    id TEXT PRIMARY KEY,
    conflict_id TEXT NOT NULL REFERENCES conflicts(id),
    decision TEXT NOT NULL CHECK (decision IN ('confirmed', 'rejected')),
    reason TEXT NOT NULL DEFAULT '',
    adjudicator TEXT NOT NULL DEFAULT '',
    adjudicated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS demo_results (
    id TEXT PRIMARY KEY,
    param_item_id TEXT NOT NULL REFERENCES param_items(id),
    param_name TEXT NOT NULL,
    value TEXT NOT NULL,
    param_version TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    is_denominator_zero INTEGER NOT NULL DEFAULT 0,
    review_status TEXT NOT NULL DEFAULT 'normal' CHECK (review_status IN ('normal', 'pending_review', 'reviewed')),
    display_label TEXT NOT NULL DEFAULT '',
    calculated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_demo_results_param ON demo_results(param_item_id);
CREATE TABLE IF NOT EXISTS denominator_zero_reviews (
    id TEXT PRIMARY KEY,
    param_item_id TEXT NOT NULL REFERENCES param_items(id),
    decision TEXT NOT NULL CHECK (decision IN ('confirm_anomaly', 'confirm_corrected')),
    reviewer TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dz_reviews_param ON denominator_zero_reviews(param_item_id);
CREATE TABLE IF NOT EXISTS workflow_state (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    current_step TEXT NOT NULL DEFAULT 'import' CHECK (current_step IN ('import', 'counterexample_review', 'demo_update')),
    import_completed INTEGER NOT NULL DEFAULT 0,
    counterexample_review_completed INTEGER NOT NULL DEFAULT 0,
    demo_update_completed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS self_checks (
    id TEXT PRIMARY KEY,
    check_type TEXT NOT NULL CHECK (check_type IN ('duplicate_import', 'denominator_zero_empty', 'recalc_after_supplement', 'export_consistency')),
    status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
    message TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '[]',
    run_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_self_checks_type ON self_checks(check_type);
`)

db.exec(`
INSERT OR IGNORE INTO workflow_state (id, current_step, import_completed, counterexample_review_completed, demo_update_completed) VALUES ('singleton', 'import', 0, 0, 0);
`)

const existingVersions = db.prepare('SELECT COUNT(*) as cnt FROM param_versions').get() as { cnt: number }

if (existingVersions.cnt === 0) {
  const insertVersion = db.prepare(`
    INSERT INTO param_versions (id, version, imported_by, item_count, change_summary) VALUES (?, ?, ?, ?, ?)
  `)
  const insertItem = db.prepare(`
    INSERT INTO param_items (id, version_id, name, value, rationale, is_denominator_zero, raw_denominator_value, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertCounterexample = db.prepare(`
    INSERT INTO counterexamples (id, name, note, note_raw, expected_value, actual_value, source_param_id, has_conflict) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertConflict = db.prepare(`
    INSERT INTO conflicts (id, param_item_id, counterexample_id, param_value, counterexample_value, counterexample_note, status) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const versionId = 'v-sample-001'

  insertVersion.run(versionId, 1, 'system', 3, '初始示例数据')

  const dzItemId = 'pi-sample-dz'
  const normalItemId = 'pi-sample-normal'
  const conflictItemId = 'pi-sample-conflict'

  insertItem.run(dzItemId, versionId, 'alignment_threshold', '', '分母为0时无法计算对齐阈值', 1, '0', 'pending_review')
  insertItem.run(normalItemId, versionId, 'max_edit_distance', '3', '最大编辑距离上限', 0, '', 'normal')
  insertItem.run(conflictItemId, versionId, 'substitution_cost', '2', '替换操作代价', 0, '', 'normal')

  const ceId = 'ce-sample-001'
  insertCounterexample.run(ceId, 'substitution_cost', '替换代价应为1而非2，基于序列ACGT→ACGA的观察', '替换代价应为1而非2，基于序列ACGT→ACGA的观察', '1', '2', conflictItemId, 1)

  insertConflict.run('cf-sample-001', conflictItemId, ceId, '2', '1', '替换代价应为1而非2，基于序列ACGT→ACGA的观察', 'pending')
}

export default db
