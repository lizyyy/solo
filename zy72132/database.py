import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any

DB_PATH = Path(__file__).parent / "rhythm_error_book.db"


def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_path TEXT,
        track_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_detail TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        exception_reason TEXT,
        contract_deadline TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER DEFAULT 1
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS record_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT,
        changed_at TEXT NOT NULL,
        change_reason TEXT,
        FOREIGN KEY (record_id) REFERENCES records (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS import_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_name TEXT NOT NULL,
        total_files INTEGER NOT NULL,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    ''')

    conn.commit()
    conn.close()


class Record:
    def __init__(self,
                 file_name: str,
                 track_name: str,
                 source_type: str,
                 status: str,
                 file_path: str = None,
                 source_detail: str = None,
                 notes: str = None,
                 exception_reason: str = None,
                 contract_deadline: str = None,
                 record_id: int = None,
                 created_at: str = None,
                 updated_at: str = None,
                 version: int = 1):
        self.id = record_id
        self.file_name = file_name
        self.file_path = file_path
        self.track_name = track_name
        self.source_type = source_type
        self.source_detail = source_detail
        self.status = status
        self.notes = notes
        self.exception_reason = exception_reason
        self.contract_deadline = contract_deadline
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()
        self.version = version

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'track_name': self.track_name,
            'source_type': self.source_type,
            'source_detail': self.source_detail,
            'status': self.status,
            'notes': self.notes,
            'exception_reason': self.exception_reason,
            'contract_deadline': self.contract_deadline,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'version': self.version
        }

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> 'Record':
        return cls(
            record_id=row['id'],
            file_name=row['file_name'],
            file_path=row['file_path'],
            track_name=row['track_name'],
            source_type=row['source_type'],
            source_detail=row['source_detail'],
            status=row['status'],
            notes=row['notes'],
            exception_reason=row['exception_reason'],
            contract_deadline=row['contract_deadline'],
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            version=row['version']
        )


class RecordRepository:
    @staticmethod
    def create(record: Record, changed_by: str = "system") -> Record:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute('''
        INSERT INTO records (
            file_name, file_path, track_name, source_type, source_detail,
            status, notes, exception_reason, contract_deadline,
            created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.file_name, record.file_path, record.track_name,
            record.source_type, record.source_detail,
            record.status, record.notes, record.exception_reason,
            record.contract_deadline,
            record.created_at, record.updated_at, record.version
        ))

        record.id = cursor.lastrowid

        conn.commit()
        conn.close()
        return record

    @staticmethod
    def get_by_id(record_id: int) -> Optional[Record]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM records WHERE id = ?', (record_id,))
        row = cursor.fetchone()
        conn.close()
        return Record.from_row(row) if row else None

    @staticmethod
    def get_all() -> List[Record]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM records ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [Record.from_row(row) for row in rows]

    @staticmethod
    def update(record_id: int, updates: Dict[str, Any], changed_by: str, change_reason: str) -> Optional[Record]:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM records WHERE id = ?', (record_id,))
        old_row = cursor.fetchone()
        if not old_row:
            conn.close()
            return None

        set_clauses = []
        values = []
        for field, value in updates.items():
            set_clauses.append(f"{field} = ?")
            values.append(value)
            old_value = old_row[field]
            new_value = str(value) if value else None
            old_value_str = str(old_value) if old_value else None

            if old_value_str != new_value:
                cursor.execute('''
                INSERT INTO record_history (
                    record_id, field_name, old_value, new_value,
                    changed_by, changed_at, change_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    record_id, field, old_value_str, new_value,
                    changed_by, datetime.now().isoformat(), change_reason
                ))

        values.append(datetime.now().isoformat())
        values.append(old_row['version'] + 1)
        values.append(record_id)

        cursor.execute(f'''
        UPDATE records
        SET {', '.join(set_clauses)}, updated_at = ?, version = ?
        WHERE id = ?
        ''', values)

        conn.commit()

        cursor.execute('SELECT * FROM records WHERE id = ?', (record_id,))
        updated_row = cursor.fetchone()
        conn.close()

        return Record.from_row(updated_row)

    @staticmethod
    def get_history(record_id: int) -> List[Dict[str, Any]]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT * FROM record_history
        WHERE record_id = ?
        ORDER BY changed_at DESC
        ''', (record_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


class ImportBatchRepository:
    @staticmethod
    def create(batch_name: str, total_files: int) -> int:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO import_batches (batch_name, total_files, created_at)
        VALUES (?, ?, ?)
        ''', (batch_name, total_files, datetime.now().isoformat()))
        batch_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return batch_id

    @staticmethod
    def update_counts(batch_id: int, success_count: int, failed_count: int):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        UPDATE import_batches
        SET success_count = ?, failed_count = ?
        WHERE id = ?
        ''', (success_count, failed_count, batch_id))
        conn.commit()
        conn.close()
