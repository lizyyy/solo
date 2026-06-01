"""数据库操作模块"""
import sqlite3
import json
import uuid
from datetime import datetime
from contextlib import contextmanager
from typing import Optional, Dict, Any, List

from .config import (
    DB_PATH, AUDIT_LOG_TABLE, PARAMS_TABLE, PARAM_VERSIONS_TABLE,
    DATA_SOURCES_TABLE, RAW_RECORDS_TABLE, CALCULATIONS_TABLE,
    CALC_STEPS_TABLE, ANOMALIES_TABLE, CONFLICTS_TABLE,
    SUPPLEMENTS_TABLE, CHARTS_TABLE
)


class Database:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_db()
        return cls._instance

    def _init_db(self):
        self.conn = sqlite3.connect(str(DB_PATH))
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        cursor = self.conn.cursor()

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {AUDIT_LOG_TABLE} (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            action TEXT NOT NULL,
            operator TEXT DEFAULT 'system',
            details TEXT,
            batch_id TEXT
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {PARAMS_TABLE} (
            id TEXT PRIMARY KEY,
            param_key TEXT NOT NULL UNIQUE,
            param_value TEXT NOT NULL,
            is_overridden INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {PARAM_VERSIONS_TABLE} (
            id TEXT PRIMARY KEY,
            param_key TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT NOT NULL,
            reason TEXT,
            operator TEXT DEFAULT 'system',
            created_at TEXT NOT NULL,
            version INTEGER NOT NULL
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {DATA_SOURCES_TABLE} (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            source_name TEXT NOT NULL,
            file_path TEXT,
            record_count INTEGER,
            field_mapping TEXT,
            batch_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {RAW_RECORDS_TABLE} (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            original_data TEXT NOT NULL,
            normalized_data TEXT NOT NULL,
            section TEXT,
            member_name TEXT,
            rehearsal_date TEXT,
            is_supplemented INTEGER DEFAULT 0,
            supplement_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (source_id) REFERENCES {DATA_SOURCES_TABLE}(id)
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {CALCULATIONS_TABLE} (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            record_id TEXT,
            calc_type TEXT NOT NULL,
            result_value REAL,
            result_text TEXT,
            param_version TEXT,
            calc_details TEXT,
            created_at TEXT NOT NULL
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {CALC_STEPS_TABLE} (
            id TEXT PRIMARY KEY,
            calc_id TEXT NOT NULL,
            step_order INTEGER NOT NULL,
            step_name TEXT NOT NULL,
            input_values TEXT,
            formula TEXT,
            output_value REAL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (calc_id) REFERENCES {CALCULATIONS_TABLE}(id)
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {ANOMALIES_TABLE} (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            record_id TEXT,
            anomaly_type TEXT NOT NULL,
            anomaly_description TEXT NOT NULL,
            severity TEXT NOT NULL,
            anomaly_values TEXT,
            is_resolved INTEGER DEFAULT 0,
            resolution_note TEXT,
            created_at TEXT NOT NULL
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {CONFLICTS_TABLE} (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            source_a TEXT NOT NULL,
            source_b TEXT NOT NULL,
            value_a TEXT,
            value_b TEXT,
            evidence_a TEXT,
            evidence_b TEXT,
            suggested_action TEXT,
            is_resolved INTEGER DEFAULT 0,
            resolution TEXT,
            created_at TEXT NOT NULL
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {SUPPLEMENTS_TABLE} (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            target_record_id TEXT,
            supplement_type TEXT NOT NULL,
            field_name TEXT,
            old_value TEXT,
            new_value TEXT,
            remark TEXT,
            operator TEXT,
            created_at TEXT NOT NULL
        )""")

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {CHARTS_TABLE} (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            chart_type TEXT NOT NULL,
            chart_title TEXT NOT NULL,
            file_path TEXT NOT NULL,
            data_query TEXT,
            drilldown_config TEXT,
            created_at TEXT NOT NULL
        )""")

        self.conn.commit()

    @contextmanager
    def transaction(self):
        try:
            yield
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e

    def log_audit(self, action: str, details: Optional[Dict] = None,
                  batch_id: Optional[str] = None, operator: str = "system"):
        cursor = self.conn.cursor()
        cursor.execute(
            f"INSERT INTO {AUDIT_LOG_TABLE} VALUES (?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.now().isoformat(),
                action,
                operator,
                json.dumps(details, ensure_ascii=False) if details else None,
                batch_id
            )
        )
        self.conn.commit()

    def new_batch_id(self) -> str:
        return f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    def close(self):
        self.conn.close()


def get_db() -> Database:
    return Database()
