import sqlite3
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = "bridge_bearing.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS threshold_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_name TEXT NOT NULL,
        params_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        remark TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS spare_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT NOT NULL,
        material_code TEXT,
        material_name TEXT NOT NULL,
        spec_model TEXT,
        measured_value REAL,
        unit TEXT,
        supplier TEXT,
        import_batch_id TEXT NOT NULL,
        raw_remark TEXT,
        manual_remark TEXT,
        is_complete INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        row_hash TEXT,
        UNIQUE(row_hash, import_batch_id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS warning_run (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_no TEXT NOT NULL UNIQUE,
        config_id INTEGER NOT NULL,
        import_batch_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        step_logs_json TEXT,
        params_snapshot_json TEXT NOT NULL,
        FOREIGN KEY(config_id) REFERENCES threshold_config(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS warning_record (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        spare_part_id INTEGER NOT NULL,
        level TEXT NOT NULL,
        anomaly_type TEXT NOT NULL,
        detected_value REAL,
        threshold_value REAL NOT NULL,
        deviation REAL,
        step_detected TEXT NOT NULL,
        step_detail_json TEXT,
        status TEXT NOT NULL DEFAULT '待处理',
        handle_remark TEXT,
        conclusion TEXT,
        handled_at TEXT,
        handled_by TEXT,
        FOREIGN KEY(run_id) REFERENCES warning_run(id),
        FOREIGN KEY(spare_part_id) REFERENCES spare_parts(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS anomaly_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warning_record_id INTEGER NOT NULL UNIQUE,
        queue_status TEXT NOT NULL DEFAULT '待分派',
        priority TEXT NOT NULL,
        assignee TEXT,
        file_conclusion TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY(warning_record_id) REFERENCES warning_record(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS import_batch (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL UNIQUE,
        file_name TEXT,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        incomplete_count INTEGER DEFAULT 0,
        imported_at TEXT NOT NULL,
        imported_by TEXT,
        details_json TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS handle_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warning_record_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT NOT NULL,
        operated_at TEXT NOT NULL,
        remark TEXT,
        FOREIGN KEY(warning_record_id) REFERENCES warning_record(id)
    )
    """)

    default_params = {
        "deviation_upper_pct": 20.0,
        "deviation_lower_pct": 20.0,
        "use_robust_stat": 1,
        "iqr_multiplier": 1.5,
        "zscore_threshold": 2.5,
        "min_sample_size": 5,
        "single_value_abs_threshold": None,
        "group_by": "spec_model"
    }

    c.execute("SELECT COUNT(*) as cnt FROM threshold_config WHERE is_active=1")
    if c.fetchone()["cnt"] == 0:
        c.execute("""
        INSERT INTO threshold_config (config_name, params_json, created_at, created_by, is_active, remark)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "默认阈值配置（标准）",
            json.dumps(default_params, ensure_ascii=False),
            datetime.now().isoformat(),
            "system",
            1,
            "系统初始化默认配置，使用中位数+IQR避免异常被均值掩盖"
        ))

    c.execute("SELECT COUNT(*) as cnt FROM threshold_config WHERE config_name=?", ("临时调高阈值-样例包",))
    if c.fetchone()["cnt"] == 0:
        loose_params = dict(default_params)
        loose_params["deviation_upper_pct"] = 35.0
        loose_params["deviation_lower_pct"] = 35.0
        loose_params["zscore_threshold"] = 3.5
        c.execute("""
        INSERT INTO threshold_config (config_name, params_json, created_at, created_by, is_active, remark)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "临时调高阈值-样例包",
            json.dumps(loose_params, ensure_ascii=False),
            datetime.now().isoformat(),
            "system",
            0,
            "样例包使用：阈值临时调高，用于验证异常提示清晰度"
        ))

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("数据库初始化完成")
