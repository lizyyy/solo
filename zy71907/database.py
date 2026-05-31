import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum


class RecordStatus(Enum):
    PENDING = "待处理"
    CONFIRMED = "已确认"
    WITHDRAWN = "已撤回"
    EXPORTED = "已导出"


class SourceType(Enum):
    VOICE_LEADER = "声部长"
    METRONOME = "节拍器"
    MANUAL = "手动录入"


@dataclass
class Record:
    id: Optional[int]
    student_name: str
    song_title: str
    voice_part: str
    status: RecordStatus
    source: SourceType
    source_note: str
    pending_reason: str
    created_at: str
    updated_at: str
    created_by: str
    updated_by: str


@dataclass
class HistoryLog:
    id: Optional[int]
    record_id: int
    action: str
    field_name: str
    old_value: str
    new_value: str
    changed_by: str
    changed_at: str
    note: str


class Database:
    def __init__(self, db_path: str = "music_review.db"):
        self.db_path = db_path
        self.init_db()

    def get_conn(self):
        return sqlite3.connect(self.db_path)

    def init_db(self):
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_name TEXT NOT NULL,
                song_title TEXT NOT NULL,
                voice_part TEXT NOT NULL,
                status TEXT NOT NULL,
                source TEXT NOT NULL,
                source_note TEXT,
                pending_reason TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                updated_by TEXT NOT NULL
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS history_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                field_name TEXT,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT NOT NULL,
                changed_at TEXT NOT NULL,
                note TEXT,
                FOREIGN KEY (record_id) REFERENCES records (id)
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_records_student ON records(student_name)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_records_status ON records(status)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_history_record ON history_logs(record_id)
        ''')

        conn.commit()
        conn.close()

    def add_record(self, record: Record) -> int:
        conn = self.get_conn()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        cursor.execute('''
            INSERT INTO records (
                student_name, song_title, voice_part, status, source,
                source_note, pending_reason, created_at, updated_at,
                created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.student_name, record.song_title, record.voice_part,
            record.status.value, record.source.value, record.source_note,
            record.pending_reason, now, now, record.created_by, record.updated_by
        ))

        record_id = cursor.lastrowid
        conn.commit()
        conn.close()

        self.add_history(
            record_id=record_id,
            action="创建",
            field_name=None,
            old_value=None,
            new_value=None,
            changed_by=record.created_by,
            note="新建记录"
        )

        return record_id

    def update_record(self, record_id: int, updates: Dict[str, Any], changed_by: str, note: str = ""):
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM records WHERE id = ?', (record_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise ValueError(f"记录 {record_id} 不存在")

        columns = [desc[0] for desc in cursor.description]
        old_record = dict(zip(columns, row))

        for field, new_value in updates.items():
            if field in old_record and old_record[field] != new_value:
                self.add_history(
                    record_id=record_id,
                    action="修改",
                    field_name=field,
                    old_value=str(old_record[field]),
                    new_value=str(new_value),
                    changed_by=changed_by,
                    note=note
                )

        updates['updated_at'] = datetime.now().isoformat()
        updates['updated_by'] = changed_by

        set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [record_id]

        cursor.execute(f'UPDATE records SET {set_clause} WHERE id = ?', values)
        conn.commit()
        conn.close()

    def add_history(self, record_id: int, action: str, field_name: Optional[str],
                    old_value: Optional[str], new_value: Optional[str],
                    changed_by: str, note: str = ""):
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO history_logs (
                record_id, action, field_name, old_value, new_value,
                changed_by, changed_at, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id, action, field_name, old_value, new_value,
            changed_by, datetime.now().isoformat(), note
        ))

        conn.commit()
        conn.close()

    def get_record(self, record_id: int) -> Optional[Record]:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM records WHERE id = ?', (record_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return self._row_to_record(row)

    def find_duplicates(self, student_name: str, song_title: str) -> List[Record]:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM records
            WHERE student_name = ? AND song_title = ? AND status != '已撤回'
            ORDER BY created_at DESC
        ''', (student_name, song_title))

        rows = cursor.fetchall()
        conn.close()

        return [self._row_to_record(row) for row in rows]

    def list_records(self, status: Optional[str] = None,
                     student_name: Optional[str] = None,
                     source: Optional[str] = None) -> List[Record]:
        conn = self.get_conn()
        cursor = conn.cursor()

        query = 'SELECT * FROM records WHERE 1=1'
        params = []

        if status:
            query += ' AND status = ?'
            params.append(status)
        if student_name:
            query += ' AND student_name LIKE ?'
            params.append(f'%{student_name}%')
        if source:
            query += ' AND source = ?'
            params.append(source)

        query += ' ORDER BY created_at DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        return [self._row_to_record(row) for row in rows]

    def get_history(self, record_id: int) -> List[HistoryLog]:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM history_logs
            WHERE record_id = ?
            ORDER BY changed_at DESC
        ''', (record_id,))

        rows = cursor.fetchall()
        conn.close()

        return [self._row_to_history(row) for row in rows]

    def get_duplicate_stats(self) -> List[Dict[str, Any]]:
        conn = self.get_conn()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT student_name, song_title, COUNT(*) as count,
                   GROUP_CONCAT(id) as record_ids,
                   GROUP_CONCAT(source) as sources
            FROM records
            WHERE status != '已撤回'
            GROUP BY student_name, song_title
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        ''')

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                'student_name': row[0],
                'song_title': row[1],
                'count': row[2],
                'record_ids': row[3].split(','),
                'sources': row[4].split(',')
            }
            for row in rows
        ]

    def _row_to_record(self, row) -> Record:
        return Record(
            id=row[0],
            student_name=row[1],
            song_title=row[2],
            voice_part=row[3],
            status=RecordStatus(row[4]),
            source=SourceType(row[5]),
            source_note=row[6],
            pending_reason=row[7],
            created_at=row[8],
            updated_at=row[9],
            created_by=row[10],
            updated_by=row[11]
        )

    def _row_to_history(self, row) -> HistoryLog:
        return HistoryLog(
            id=row[0],
            record_id=row[1],
            action=row[2],
            field_name=row[3],
            old_value=row[4],
            new_value=row[5],
            changed_by=row[6],
            changed_at=row[7],
            note=row[8]
        )
