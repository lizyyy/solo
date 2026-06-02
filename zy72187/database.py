import sqlite3
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path


DB_PATH = Path(__file__).parent / "rule_distillation.db"


def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sample_id TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            source_type TEXT,
            source_file TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS model_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS model_outputs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sample_id TEXT NOT NULL,
            model_version TEXT NOT NULL,
            output_text TEXT NOT NULL,
            confidence REAL,
            prediction_label TEXT,
            raw_log TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sample_id) REFERENCES samples(sample_id),
            FOREIGN KEY (model_version) REFERENCES model_versions(version),
            UNIQUE(sample_id, model_version)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS thresholds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_name TEXT NOT NULL,
            threshold_value REAL NOT NULL,
            comparison_type TEXT NOT NULL,
            description TEXT,
            model_version TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT DEFAULT 'system'
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rule_distillations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            distillation_id TEXT UNIQUE NOT NULL,
            sample_id TEXT NOT NULL,
            model_version TEXT NOT NULL,
            rule_content TEXT NOT NULL,
            rule_type TEXT,
            confidence REAL,
            evidence_source TEXT,
            evidence_snippets TEXT,
            has_missing_reference INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sample_id) REFERENCES samples(sample_id),
            FOREIGN KEY (model_version) REFERENCES model_versions(version)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            distillation_id TEXT NOT NULL,
            reviewer TEXT NOT NULL,
            review_result TEXT NOT NULL,
            review_comment TEXT,
            corrected_rule TEXT,
            reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (distillation_id) REFERENCES rule_distillations(distillation_id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            distillation_id TEXT NOT NULL,
            note_content TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (distillation_id) REFERENCES rule_distillations(distillation_id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id TEXT UNIQUE NOT NULL,
            report_name TEXT NOT NULL,
            model_version TEXT NOT NULL,
            report_content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT DEFAULT 'system'
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comparison_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comparison_id TEXT UNIQUE NOT NULL,
            base_model_version TEXT NOT NULL,
            target_model_version TEXT NOT NULL,
            comparison_result TEXT NOT NULL,
            metric_changes TEXT,
            sample_changes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()


def insert_sample(sample_id: str, content: str, source_type: str = None, 
                  source_file: str = None, metadata: Dict = None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO samples 
            (sample_id, content, source_type, source_file, metadata)
            VALUES (?, ?, ?, ?, ?)
        ''', (sample_id, content, source_type, source_file, 
              json.dumps(metadata) if metadata else None))
        conn.commit()
    finally:
        conn.close()


def insert_model_version(version: str, description: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR IGNORE INTO model_versions (version, description)
            VALUES (?, ?)
        ''', (version, description))
        conn.commit()
    finally:
        conn.close()


def insert_model_output(sample_id: str, model_version: str, output_text: str,
                        confidence: float = None, prediction_label: str = None,
                        raw_log: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO model_outputs 
            (sample_id, model_version, output_text, confidence, prediction_label, raw_log)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (sample_id, model_version, output_text, confidence, prediction_label, raw_log))
        conn.commit()
    finally:
        conn.close()


def insert_threshold(rule_name: str, threshold_value: float, comparison_type: str,
                     description: str = None, model_version: str = None, created_by: str = 'system'):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO thresholds 
            (rule_name, threshold_value, comparison_type, description, model_version, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (rule_name, threshold_value, comparison_type, description, model_version, created_by))
        conn.commit()
    finally:
        conn.close()


def insert_rule_distillation(distillation_id: str, sample_id: str, model_version: str,
                             rule_content: str, rule_type: str = None, confidence: float = None,
                             evidence_source: str = None, evidence_snippets: List[str] = None,
                             has_missing_reference: bool = False):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO rule_distillations 
            (distillation_id, sample_id, model_version, rule_content, rule_type, 
             confidence, evidence_source, evidence_snippets, has_missing_reference)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (distillation_id, sample_id, model_version, rule_content, rule_type,
              confidence, evidence_source, 
              json.dumps(evidence_snippets) if evidence_snippets else None,
              1 if has_missing_reference else 0))
        conn.commit()
    finally:
        conn.close()


def insert_review(distillation_id: str, reviewer: str, review_result: str,
                  review_comment: str = None, corrected_rule: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO reviews 
            (distillation_id, reviewer, review_result, review_comment, corrected_rule)
            VALUES (?, ?, ?, ?, ?)
        ''', (distillation_id, reviewer, review_result, review_comment, corrected_rule))
        conn.commit()
    finally:
        conn.close()


def insert_note(distillation_id: str, note_content: str, created_by: str):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO notes (distillation_id, note_content, created_by)
            VALUES (?, ?, ?)
        ''', (distillation_id, note_content, created_by))
        conn.commit()
    finally:
        conn.close()


def insert_report(report_id: str, report_name: str, model_version: str,
                  report_content: str, created_by: str = 'system'):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO reports 
            (report_id, report_name, model_version, report_content, created_by)
            VALUES (?, ?, ?, ?, ?)
        ''', (report_id, report_name, model_version, report_content, created_by))
        conn.commit()
    finally:
        conn.close()


def get_sample(sample_id: str) -> Optional[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT * FROM samples WHERE sample_id = ?', (sample_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_rule_distillation(distillation_id: str) -> Optional[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT * FROM rule_distillations WHERE distillation_id = ?', (distillation_id,))
        row = cursor.fetchone()
        if row:
            result = dict(row)
            if result.get('evidence_snippets'):
                result['evidence_snippets'] = json.loads(result['evidence_snippets'])
            return result
        return None
    finally:
        conn.close()


def get_distillation_notes(distillation_id: str) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT * FROM notes WHERE distillation_id = ? ORDER BY created_at DESC
        ''', (distillation_id,))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_distillation_reviews(distillation_id: str) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT * FROM reviews WHERE distillation_id = ? ORDER BY reviewed_at DESC
        ''', (distillation_id,))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def list_rule_distillations(model_version: str = None) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if model_version:
            cursor.execute('''
                SELECT * FROM rule_distillations WHERE model_version = ?
                ORDER BY created_at DESC
            ''', (model_version,))
        else:
            cursor.execute('SELECT * FROM rule_distillations ORDER BY created_at DESC')
        results = []
        for row in cursor.fetchall():
            result = dict(row)
            if result.get('evidence_snippets'):
                result['evidence_snippets'] = json.loads(result['evidence_snippets'])
            results.append(result)
        return results
    finally:
        conn.close()


def list_reports() -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT * FROM reports ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_report(report_id: str) -> Optional[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT * FROM reports WHERE report_id = ?', (report_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_thresholds(model_version: str = None) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if model_version:
            cursor.execute('''
                SELECT * FROM thresholds WHERE model_version = ? ORDER BY created_at DESC
            ''', (model_version,))
        else:
            cursor.execute('SELECT * FROM thresholds ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_model_versions() -> List[str]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT version FROM model_versions ORDER BY created_at DESC')
        return [row['version'] for row in cursor.fetchall()]
    finally:
        conn.close()


def insert_comparison(comparison_id: str, base_version: str, target_version: str,
                      comparison_result: Dict, metric_changes: Dict = None,
                      sample_changes: Dict = None):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO comparison_history 
            (comparison_id, base_model_version, target_model_version, 
             comparison_result, metric_changes, sample_changes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (comparison_id, base_version, target_version,
              json.dumps(comparison_result),
              json.dumps(metric_changes) if metric_changes else None,
              json.dumps(sample_changes) if sample_changes else None))
        conn.commit()
    finally:
        conn.close()
