const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const DB_DIR = path.resolve(__dirname, "..", "..", "data");
const DB_PATH = process.env.SEQ_DB_PATH || path.join(DB_DIR, "review.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db = null;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('历史答案','后补备注','口头备注')),
      version TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      quote TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL,
      contributes_json TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS materials_content_hash_idx ON materials(content_hash);`);
  db.run(`
    CREATE TABLE IF NOT EXISTS review_runs (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      primary_version TEXT NOT NULL DEFAULT 'old',
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_entries (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      prev_value TEXT NOT NULL,
      next_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS audit_case_idx ON audit_entries(case_id);`);
  db.run(`
    CREATE TABLE IF NOT EXISTS judgments (
      case_id TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (case_id, fact_key)
    );
  `);
  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
}

function now() {
  return Date.now();
}

function queryAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params) {
  if (params) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  save();
}

function rowToMaterial(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    source: row.source,
    content: row.content,
    contentHash: row.content_hash,
    quote: row.quote,
    contributes: row.contributes_json ? JSON.parse(row.contributes_json) : undefined,
    createdAt: row.created_at,
  };
}

function insertMaterial(m) {
  run(
    `INSERT INTO materials (id, type, version, source, content, quote, content_hash, contributes_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.id, m.type, m.version || "", m.source || "", m.content, m.quote || "", m.contentHash, m.contributes ? JSON.stringify(m.contributes) : null, m.createdAt || now()],
  );
  return getMaterial(m.id);
}

function findMaterialByHash(hash) {
  const row = queryOne("SELECT * FROM materials WHERE content_hash = ?", [hash]);
  return rowToMaterial(row);
}

function getMaterial(id) {
  const row = queryOne("SELECT * FROM materials WHERE id = ?", [id]);
  return rowToMaterial(row);
}

function listMaterials() {
  const rows = queryAll("SELECT * FROM materials ORDER BY created_at ASC");
  return rows.map(rowToMaterial);
}

function insertReviewRun(run) {
  runSql(
    `INSERT INTO review_runs (id, case_id, primary_version, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [run.id, run.caseId, run.primary || "old", JSON.stringify(run.payload), run.createdAt || now()],
  );
}

function latestReview(caseId) {
  const row = queryOne(
    "SELECT * FROM review_runs WHERE case_id = ? ORDER BY created_at DESC LIMIT 1",
    [caseId],
  );
  if (!row) return null;
  const payload = JSON.parse(row.payload_json);
  return { id: row.id, caseId: row.case_id, primary: row.primary_version, ...payload, createdAt: row.created_at };
}

function listReviews(caseId) {
  const rows = queryAll(
    "SELECT * FROM review_runs WHERE case_id = ? ORDER BY created_at DESC",
    [caseId],
  );
  return rows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    primary: row.primary_version,
    ...JSON.parse(row.payload_json),
    createdAt: row.created_at,
  }));
}

function listAudit(caseId) {
  const rows = queryAll(
    "SELECT * FROM audit_entries WHERE case_id = ? ORDER BY created_at DESC",
    [caseId],
  );
  return rows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    factKey: row.fact_key,
    prevValue: row.prev_value,
    nextValue: row.next_value,
    reason: row.reason,
    actor: row.actor,
    ts: row.created_at,
  }));
}

function addAudit(entry) {
  run(
    `INSERT INTO audit_entries (id, case_id, fact_key, prev_value, next_value, reason, actor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.caseId, entry.factKey, entry.prevValue, entry.nextValue, entry.reason, entry.actor, entry.ts || now()],
  );
}

function getJudgment(caseId, factKey) {
  const row = queryOne(
    "SELECT * FROM judgments WHERE case_id = ? AND fact_key = ?",
    [caseId, factKey],
  );
  if (!row) return null;
  return { caseId: row.case_id, factKey: row.fact_key, value: row.value, ts: row.created_at };
}

function listJudgments(caseId) {
  return queryAll("SELECT * FROM judgments WHERE case_id = ?", [caseId]).map((row) => ({
    caseId: row.case_id,
    factKey: row.fact_key,
    value: row.value,
    ts: row.created_at,
  }));
}

function upsertJudgment(caseId, factKey, value) {
  const existing = getJudgment(caseId, factKey);
  if (existing) {
    run(
      "UPDATE judgments SET value = ?, created_at = ? WHERE case_id = ? AND fact_key = ?",
      [value, now(), caseId, factKey],
    );
  } else {
    run(
      "INSERT INTO judgments (case_id, fact_key, value, created_at) VALUES (?, ?, ?, ?)",
      [caseId, factKey, value, now()],
    );
  }
}

function runSql(sql, params) {
  if (params) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  save();
}

module.exports = {
  DB_PATH,
  initDB,
  now,
  insertMaterial,
  findMaterialByHash,
  getMaterial,
  listMaterials,
  insertReviewRun,
  latestReview,
  listReviews,
  listAudit,
  addAudit,
  getJudgment,
  listJudgments,
  upsertJudgment,
};
