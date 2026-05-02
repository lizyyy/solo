import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any


@dataclass
class HistoryRecord:
    id: Optional[int]
    task_name: str
    task_type: str
    source_file: str
    created_at: datetime
    summary: Dict[str, Any]
    raw_data: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_name": self.task_name,
            "task_type": self.task_type,
            "source_file": self.source_file,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "summary": self.summary,
        }


class HistoryDatabase:
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_name TEXT NOT NULL,
                task_type TEXT NOT NULL,
                source_file TEXT NOT NULL,
                created_at TEXT NOT NULL,
                summary TEXT NOT NULL,
                raw_data TEXT
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_history_task_type 
            ON history(task_type)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_history_created_at 
            ON history(created_at)
        """)
        
        conn.commit()
        conn.close()
    
    def add_record(
        self,
        task_name: str,
        task_type: str,
        source_file: str,
        summary: Dict[str, Any],
        raw_data: Optional[str] = None,
    ) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        created_at = datetime.now().isoformat()
        summary_json = json.dumps(summary, ensure_ascii=False)
        
        cursor.execute("""
            INSERT INTO history (task_name, task_type, source_file, created_at, summary, raw_data)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (task_name, task_type, source_file, created_at, summary_json, raw_data))
        
        record_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return record_id
    
    def get_records(
        self,
        task_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[HistoryRecord]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if task_type:
            cursor.execute("""
                SELECT id, task_name, task_type, source_file, created_at, summary, raw_data
                FROM history
                WHERE task_type = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, (task_type, limit, offset))
        else:
            cursor.execute("""
                SELECT id, task_name, task_type, source_file, created_at, summary, raw_data
                FROM history
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))
        
        records = []
        for row in cursor.fetchall():
            try:
                summary = json.loads(row["summary"]) if row["summary"] else {}
            except json.JSONDecodeError:
                summary = {}
            
            created_at = None
            if row["created_at"]:
                try:
                    created_at = datetime.fromisoformat(row["created_at"])
                except ValueError:
                    pass
            
            record = HistoryRecord(
                id=row["id"],
                task_name=row["task_name"],
                task_type=row["task_type"],
                source_file=row["source_file"],
                created_at=created_at,
                summary=summary,
                raw_data=row["raw_data"],
            )
            records.append(record)
        
        conn.close()
        return records
    
    def get_record(self, record_id: int) -> Optional[HistoryRecord]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, task_name, task_type, source_file, created_at, summary, raw_data
            FROM history
            WHERE id = ?
        """, (record_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        try:
            summary = json.loads(row["summary"]) if row["summary"] else {}
        except json.JSONDecodeError:
            summary = {}
        
        created_at = None
        if row["created_at"]:
            try:
                created_at = datetime.fromisoformat(row["created_at"])
            except ValueError:
                pass
        
        return HistoryRecord(
            id=row["id"],
            task_name=row["task_name"],
            task_type=row["task_type"],
            source_file=row["source_file"],
            created_at=created_at,
            summary=summary,
            raw_data=row["raw_data"],
        )
    
    def count_records(self, task_type: Optional[str] = None) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if task_type:
            cursor.execute(
                "SELECT COUNT(*) FROM history WHERE task_type = ?",
                (task_type,)
            )
        else:
            cursor.execute("SELECT COUNT(*) FROM history")
        
        count = cursor.fetchone()[0]
        conn.close()
        return count
