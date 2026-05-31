import sqlite3
import hashlib
import json
from datetime import datetime
from pathlib import Path
from config import DB_PATH, STATUS_CODES


class Database:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS batches (
                batch_id TEXT PRIMARY KEY,
                batch_name TEXT,
                source_type TEXT,
                file_hash TEXT,
                status TEXT,
                total_records INTEGER,
                masked_count INTEGER,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                remark TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS records (
                record_id TEXT PRIMARY KEY,
                batch_id TEXT,
                biz_id TEXT,
                record_hash TEXT,
                source_type TEXT,
                original_content TEXT,
                masked_content TEXT,
                sensitive_types TEXT,
                status TEXT,
                version INTEGER DEFAULT 1,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS version_changes (
                change_id TEXT PRIMARY KEY,
                record_id TEXT,
                batch_id TEXT,
                old_version INTEGER,
                new_version INTEGER,
                change_type TEXT,
                old_value TEXT,
                new_value TEXT,
                changed_at TIMESTAMP,
                FOREIGN KEY (record_id) REFERENCES records(record_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS processing_logs (
                log_id TEXT PRIMARY KEY,
                batch_id TEXT,
                record_id TEXT,
                log_level TEXT,
                message TEXT,
                created_at TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    def _generate_id(self, prefix=""):
        return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{hashlib.md5(str(datetime.now()).encode()).hexdigest()[:8]}"

    def _calculate_hash(self, content):
        if isinstance(content, dict):
            content = json.dumps(content, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(str(content).encode()).hexdigest()

    def create_batch(self, batch_name, source_type, file_content, total_records=0):
        batch_id = self._generate_id("B")
        file_hash = self._calculate_hash(file_content)
        
        existing = self.get_batch_by_hash(file_hash)
        if existing:
            return existing["batch_id"], True

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO batches (batch_id, batch_name, source_type, file_hash, status, 
                               total_records, masked_count, created_at, updated_at, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (batch_id, batch_name, source_type, file_hash, "pending", total_records, 0, now, now, ""))
        
        conn.commit()
        conn.close()
        return batch_id, False

    def get_batch_by_hash(self, file_hash):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM batches WHERE file_hash = ?', (file_hash,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def get_batch(self, batch_id):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM batches WHERE batch_id = ?', (batch_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def update_batch_status(self, batch_id, status, masked_count=None, remark=""):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        updates = ["status = ?", "updated_at = ?"]
        params = [status, now]
        
        if masked_count is not None:
            updates.append("masked_count = ?")
            params.append(masked_count)
        if remark:
            updates.append("remark = ?")
            params.append(remark)
        
        params.append(batch_id)
        
        cursor.execute(f'''
            UPDATE batches SET {', '.join(updates)} WHERE batch_id = ?
        ''', params)
        
        conn.commit()
        conn.close()

    def add_record(self, batch_id, source_type, original_content, masked_content, sensitive_types, biz_id=""):
        record_hash = self._calculate_hash(original_content)
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        existing = None
        if biz_id:
            cursor.execute('''
                SELECT * FROM records WHERE biz_id = ? AND source_type = ? ORDER BY version DESC LIMIT 1
            ''', (biz_id, source_type))
            existing = cursor.fetchone()
        
        if existing:
            existing = dict(existing)
            changes = self._compare_records(existing, original_content, masked_content)
            if changes:
                new_version = existing["version"] + 1
                self._record_changes(existing["record_id"], batch_id, existing["version"], 
                                    new_version, changes)
                
                cursor.execute('''
                    UPDATE records 
                    SET batch_id = ?, original_content = ?, masked_content = ?, sensitive_types = ?, 
                        version = ?, status = ?, updated_at = ?
                    WHERE record_id = ?
                ''', (batch_id, original_content, masked_content, json.dumps(sensitive_types),
                      new_version, "warning", datetime.now().isoformat(), existing["record_id"]))
                conn.commit()
                conn.close()
                return existing["record_id"], True
            conn.close()
            return existing["record_id"], False
        
        record_id = self._generate_id("R")
        now = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO records (record_id, batch_id, biz_id, record_hash, source_type, original_content,
                               masked_content, sensitive_types, status, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (record_id, batch_id, biz_id, record_hash, source_type, original_content,
              masked_content, json.dumps(sensitive_types), "success", 1, now, now))
        
        conn.commit()
        conn.close()
        return record_id, False

    def _compare_records(self, existing, new_original, new_masked):
        changes = []
        if existing["original_content"] != new_original:
            changes.append({
                "field": "original_content",
                "old": existing["original_content"],
                "new": new_original
            })
        if existing["masked_content"] != new_masked:
            changes.append({
                "field": "masked_content",
                "old": existing["masked_content"],
                "new": new_masked
            })
        return changes

    def _record_changes(self, record_id, batch_id, old_version, new_version, changes):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        for change in changes:
            change_id = self._generate_id("C")
            cursor.execute('''
                INSERT INTO version_changes (change_id, record_id, batch_id, old_version, 
                                           new_version, change_type, old_value, new_value, changed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (change_id, record_id, batch_id, old_version, new_version,
                  change["field"], change["old"], change["new"], now))
        
        conn.commit()
        conn.close()

    def get_record_changes(self, record_id):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM version_changes WHERE record_id = ? ORDER BY changed_at DESC
        ''', (record_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def add_log(self, batch_id, record_id, log_level, message):
        log_id = self._generate_id("L")
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO processing_logs (log_id, batch_id, record_id, log_level, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (log_id, batch_id, record_id, log_level, message, datetime.now().isoformat()))
        conn.commit()
        conn.close()

    def get_batch_records(self, batch_id):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM records WHERE batch_id = ?', (batch_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_all_batches(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM batches ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_warning_records(self, batch_id=None):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if batch_id:
            cursor.execute('SELECT * FROM records WHERE batch_id = ? AND status = ?', 
                         (batch_id, "warning"))
        else:
            cursor.execute('SELECT * FROM records WHERE status = ?', ("warning",))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
