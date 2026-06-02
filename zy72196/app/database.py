import sqlite3
import uuid
import json
from datetime import datetime, timezone
from contextlib import contextmanager

DB_PATH = "eval_stratifier.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS samples (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    domain TEXT,
    reference_result TEXT,
    model_output TEXT,
    model_confidence REAL,
    human_label TEXT,
    original_label TEXT,
    label_modified_by TEXT,
    label_modified_at TEXT,
    source TEXT,
    import_batch TEXT,
    import_time TEXT NOT NULL,
    is_duplicate INTEGER DEFAULT 0,
    duplicate_of TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS stratification_results (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    stratum TEXT NOT NULL,
    stratum_type TEXT NOT NULL,
    confidence REAL,
    evidence TEXT,
    auto_reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (sample_id) REFERENCES samples(id)
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    run_time TEXT NOT NULL,
    run_type TEXT NOT NULL,
    previous_run_id TEXT,
    sample_count INTEGER,
    metrics_json TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    sample_id TEXT,
    action TEXT NOT NULL,
    field_name TEXT,
    before_value TEXT,
    after_value TEXT,
    operator TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    evidence_ref TEXT
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    stratum TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    sample_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_import_batch ON samples(import_batch);
CREATE INDEX IF NOT EXISTS idx_strat_sample ON stratification_results(sample_id);
CREATE INDEX IF NOT EXISTS idx_strat_run ON stratification_results(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_sample ON audit_log(sample_id);
CREATE INDEX IF NOT EXISTS idx_metrics_run ON metric_snapshots(run_id);
"""


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())[:8]


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA_SQL)


def row_to_dict(row):
    if row is None:
        return None
    return dict(row)


def insert_sample(conn, sample_data: dict) -> str:
    sid = sample_data.get("id") or new_id()
    now = now_iso()
    conn.execute(
        """INSERT OR REPLACE INTO samples
        (id, content, domain, reference_result, model_output, model_confidence,
         human_label, original_label, label_modified_by, label_modified_at,
         source, import_batch, import_time, is_duplicate, duplicate_of, status, notes, raw_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            sid,
            sample_data.get("content", ""),
            sample_data.get("domain"),
            sample_data.get("reference_result"),
            sample_data.get("model_output"),
            sample_data.get("model_confidence"),
            sample_data.get("human_label"),
            sample_data.get("original_label"),
            sample_data.get("label_modified_by"),
            sample_data.get("label_modified_at"),
            sample_data.get("source"),
            sample_data.get("import_batch"),
            sample_data.get("import_time", now),
            sample_data.get("is_duplicate", 0),
            sample_data.get("duplicate_of"),
            sample_data.get("status", "pending"),
            sample_data.get("notes"),
            json.dumps(sample_data.get("raw_json"), ensure_ascii=False) if sample_data.get("raw_json") else None,
        ),
    )
    return sid


def insert_audit(conn, sample_id: str, action: str, operator: str,
                 field_name=None, before_value=None, after_value=None,
                 evidence_ref=None):
    conn.execute(
        """INSERT INTO audit_log (id, sample_id, action, field_name, before_value, after_value, operator, timestamp, evidence_ref)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (new_id(), sample_id, action, field_name,
         json.dumps(before_value, ensure_ascii=False) if before_value is not None else None,
         json.dumps(after_value, ensure_ascii=False) if after_value is not None else None,
         operator, now_iso(), evidence_ref),
    )


def insert_run(conn, run_type: str, previous_run_id=None, sample_count=0, metrics_json=None, notes=None) -> str:
    rid = new_id()
    conn.execute(
        """INSERT INTO runs (id, run_time, run_type, previous_run_id, sample_count, metrics_json, notes)
        VALUES (?,?,?,?,?,?,?)""",
        (rid, now_iso(), run_type, previous_run_id, sample_count,
         json.dumps(metrics_json, ensure_ascii=False) if metrics_json else None, notes),
    )
    return rid


def insert_stratification(conn, sample_id: str, run_id: str, stratum: str,
                          stratum_type: str, confidence=None, evidence=None,
                          auto_reason=None) -> str:
    sid = new_id()
    conn.execute(
        """INSERT INTO stratification_results (id, sample_id, run_id, stratum, stratum_type, confidence, evidence, auto_reason, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (sid, sample_id, run_id, stratum, stratum_type, confidence,
         json.dumps(evidence, ensure_ascii=False) if evidence else None,
         auto_reason, now_iso()),
    )
    return sid


def insert_metric_snapshot(conn, run_id: str, stratum: str, metric_name: str,
                           metric_value: float, sample_count: int) -> str:
    mid = new_id()
    conn.execute(
        """INSERT INTO metric_snapshots (id, run_id, stratum, metric_name, metric_value, sample_count, created_at)
        VALUES (?,?,?,?,?,?,?)""",
        (mid, run_id, stratum, metric_name, metric_value, sample_count, now_iso()),
    )
    return mid


def get_latest_run_id(conn) -> str:
    row = conn.execute("SELECT id FROM runs ORDER BY run_time DESC LIMIT 1").fetchone()
    return row["id"] if row else None


def get_all_runs(conn) -> list:
    rows = conn.execute("SELECT * FROM runs ORDER BY run_time DESC").fetchall()
    return [row_to_dict(r) for r in rows]


def get_samples_by_status(conn, status=None) -> list:
    if status:
        rows = conn.execute("SELECT * FROM samples WHERE status=? ORDER BY import_time", (status,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM samples ORDER BY import_time").fetchall()
    return [row_to_dict(r) for r in rows]


def get_sample_by_id(conn, sample_id: str) -> dict:
    row = conn.execute("SELECT * FROM samples WHERE id=?", (sample_id,)).fetchone()
    return row_to_dict(row)


def get_stratifications_by_run(conn, run_id: str) -> list:
    rows = conn.execute(
        """SELECT s.*, sa.content, sa.domain, sa.reference_result, sa.model_output,
                  sa.model_confidence, sa.human_label, sa.is_duplicate, sa.duplicate_of
           FROM stratification_results s
           JOIN samples sa ON s.sample_id = sa.id
           WHERE s.run_id=?
           ORDER BY s.stratum_type, s.stratum""",
        (run_id,),
    ).fetchall()
    return [row_to_dict(r) for r in rows]


def get_stratifications_by_sample(conn, sample_id: str) -> list:
    rows = conn.execute(
        "SELECT * FROM stratification_results WHERE sample_id=? ORDER BY created_at DESC",
        (sample_id,),
    ).fetchall()
    return [row_to_dict(r) for r in rows]


def get_audit_by_sample(conn, sample_id: str) -> list:
    rows = conn.execute(
        "SELECT * FROM audit_log WHERE sample_id=? ORDER BY timestamp",
        (sample_id,),
    ).fetchall()
    return [row_to_dict(r) for r in rows]


def get_metrics_by_run(conn, run_id: str) -> list:
    rows = conn.execute(
        "SELECT * FROM metric_snapshots WHERE run_id=? ORDER BY stratum, metric_name",
        (run_id,),
    ).fetchall()
    return [row_to_dict(r) for r in rows]


def update_sample_status(conn, sample_id: str, status: str):
    conn.execute("UPDATE samples SET status=? WHERE id=?", (status, sample_id))


def update_human_label(conn, sample_id: str, new_label: str, operator: str = "人工复核"):
    sample = get_sample_by_id(conn, sample_id)
    if not sample:
        return
    old_label = sample.get("human_label") or sample.get("model_output") or ""
    original = sample.get("original_label") or sample.get("human_label") or old_label
    conn.execute(
        "UPDATE samples SET human_label=?, original_label=?, label_modified_by=?, label_modified_at=?, status='reviewed' WHERE id=?",
        (new_label, original, operator, now_iso(), sample_id),
    )
    insert_audit(
        conn, sample_id, "人工修改标签", operator,
        field_name="human_label",
        before_value=old_label,
        after_value=new_label,
        evidence_ref=f"原标签={original}, 新标签={new_label}",
    )


def mark_duplicate(conn, dup_id: str, orig_id: str, operator: str = "去重检测"):
    conn.execute(
        "UPDATE samples SET is_duplicate=1, duplicate_of=?, status='duplicate' WHERE id=?",
        (orig_id, dup_id),
    )
    insert_audit(
        conn, dup_id, "标记重复", operator,
        field_name="is_duplicate",
        before_value=False,
        after_value=True,
        evidence_ref=f"重复样本指向={orig_id}",
    )


def count_samples_by_stratum(conn, run_id: str) -> dict:
    rows = conn.execute(
        "SELECT stratum_type, stratum, COUNT(*) as cnt FROM stratification_results WHERE run_id=? GROUP BY stratum_type, stratum",
        (run_id,),
    ).fetchall()
    result = {}
    for r in rows:
        st = r["stratum_type"]
        if st not in result:
            result[st] = {}
        result[st][r["stratum"]] = r["cnt"]
    return result
