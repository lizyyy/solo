import sqlite3
from datetime import datetime
from typing import List, Dict, Optional, Any
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'copyright_check.db')


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS model_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_name TEXT NOT NULL,
        model_hash TEXT NOT NULL,
        threshold REAL NOT NULL,
        threshold_note TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT,
        config_json TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id TEXT UNIQUE NOT NULL,
        image_url TEXT,
        prompt TEXT,
        source TEXT,
        created_at TEXT NOT NULL,
        batch_id TEXT,
        tags TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS annotation_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id TEXT NOT NULL,
        is_copyright INTEGER,
        copyright_type TEXT,
        annotator TEXT,
        annotated_at TEXT,
        note TEXT,
        caliber_version TEXT,
        UNIQUE(sample_id, caliber_version)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS evaluation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id TEXT NOT NULL,
        model_version_id INTEGER NOT NULL,
        batch_id TEXT NOT NULL,
        batch_run_id INTEGER,
        predict_score REAL NOT NULL,
        predict_result INTEGER NOT NULL,
        evidence_json TEXT,
        reasons TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (model_version_id) REFERENCES model_versions(id),
        FOREIGN KEY (batch_run_id) REFERENCES batch_runs(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS manual_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id TEXT NOT NULL,
        evaluation_log_id INTEGER NOT NULL,
        final_result INTEGER NOT NULL,
        reviewer TEXT NOT NULL,
        reviewed_at TEXT NOT NULL,
        review_note TEXT,
        override_protected INTEGER DEFAULT 1,
        FOREIGN KEY (evaluation_log_id) REFERENCES evaluation_logs(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS supplementary_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        note_content TEXT NOT NULL,
        note_type TEXT,
        operator TEXT,
        created_at TEXT NOT NULL,
        diff_description TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS batch_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        model_version_id INTEGER NOT NULL,
        run_at TEXT NOT NULL,
        operator TEXT,
        metrics_json TEXT,
        sample_count INTEGER,
        FOREIGN KEY (model_version_id) REFERENCES model_versions(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS label_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id TEXT NOT NULL,
        evaluation_log_id INTEGER,
        conflict_type TEXT NOT NULL,
        description TEXT NOT NULL,
        model_result INTEGER,
        annotation_result INTEGER,
        detected_at TEXT NOT NULL,
        resolved INTEGER DEFAULT 0
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS export_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        export_at TEXT NOT NULL,
        export_type TEXT,
        export_content_json TEXT,
        operator TEXT
    )''')

    conn.commit()
    conn.close()


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    if row is None:
        return None
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, str) and (v.startswith('{') or v.startswith('[')):
            try:
                d[k] = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                pass
    return d


def rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    return [row_to_dict(r) for r in rows]
