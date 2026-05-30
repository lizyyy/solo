import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbDir = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.resolve(dbDir, 'prompts.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export async function initDb(): Promise<void> {
  const database = getDb()

  database.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'deprecated', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 0 AND rating <= 10),
      change_reason TEXT NOT NULL DEFAULT '',
      confirmed_by TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(prompt_id, version)
    );

    CREATE TABLE IF NOT EXISTS prompt_tags (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_tech_stacks (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
      tech_stack TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_failure_reasons (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
      reason TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('duplicate', 'rating_inconsistency', 'deprecated_usage')),
      severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'fixing', 'confirmed', 'closed')),
      description TEXT NOT NULL,
      fix_plan TEXT,
      fixed_by TEXT,
      confirmed_by TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issue_prompt_relations (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS issue_logs (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('created', 'fix_submitted', 'fix_confirmed', 'fix_rejected', 'closed')),
      actor TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_reports (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      result_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_report_results (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES search_reports(id) ON DELETE CASCADE,
      prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
      similarity REAL NOT NULL,
      snippet TEXT NOT NULL DEFAULT ''
    );
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);
    CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
    CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_tags_tag ON prompt_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_prompt_tech_stacks_stack ON prompt_tech_stacks(tech_stack);
    CREATE INDEX IF NOT EXISTS idx_prompt_failure_reasons_reason ON prompt_failure_reasons(reason);
    CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type);
    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issue_logs_issue_id ON issue_logs(issue_id);
    CREATE INDEX IF NOT EXISTS idx_issue_prompt_relations_issue ON issue_prompt_relations(issue_id);
    CREATE INDEX IF NOT EXISTS idx_issue_prompt_relations_prompt ON issue_prompt_relations(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_search_report_results_report ON search_report_results(report_id);
  `)

  const ftsExists = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prompts_fts'").get()
  if (!ftsExists) {
    database.exec(`
      CREATE VIRTUAL TABLE prompts_fts USING fts5(title, content, content=prompts, content_rowid=rowid);

      CREATE TRIGGER prompts_ai AFTER INSERT ON prompts BEGIN
        INSERT INTO prompts_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END;

      CREATE TRIGGER prompts_au AFTER UPDATE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
        INSERT INTO prompts_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END;

      CREATE TRIGGER prompts_ad AFTER DELETE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
      END;
    `)
  }

  const count = database.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number }
  if (count.count === 0) {
    const { seedDb } = await import('./seed.js')
    seedDb()
  }
}

export default getDb
