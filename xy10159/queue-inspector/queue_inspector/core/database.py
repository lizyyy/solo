import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from contextlib import contextmanager

from .models import (
    CompensationMessage, MessageStatus, ErrorCategory, RetryRecord,
    CleanupSuggestion, InspectionReport
)


DEFAULT_DB_PATH = os.path.expanduser("~/.queue_inspector/queue.db")


def _datetime_to_str(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _str_to_datetime(s: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(s) if s else None


def _dict_to_json(d: Dict[str, Any]) -> str:
    return json.dumps(d, default=str, ensure_ascii=False)


def _json_to_dict(s: Optional[str]) -> Dict[str, Any]:
    if not s:
        return {}
    return json.loads(s)


class QueueDatabase:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self._ensure_directory()
        self._init_db()
    
    def _ensure_directory(self) -> None:
        dir_path = os.path.dirname(self.db_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
    
    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def _init_db(self) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    topic TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    retry_count INTEGER DEFAULT 0,
                    max_retries INTEGER DEFAULT 3,
                    status TEXT NOT NULL,
                    first_failed_at TEXT,
                    last_failed_at TEXT,
                    next_retry_at TEXT,
                    last_error_message TEXT,
                    last_error_stack TEXT,
                    error_category TEXT,
                    idempotent_key TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    processed_at TEXT
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS retry_records (
                    id TEXT PRIMARY KEY,
                    message_id TEXT NOT NULL,
                    attempt_number INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    error_stack TEXT,
                    started_at TEXT NOT NULL,
                    finished_at TEXT,
                    duration_ms INTEGER,
                    FOREIGN KEY (message_id) REFERENCES messages(id)
                )
            """)
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_topic ON messages(topic)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_idempotent_key ON messages(idempotent_key)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_retry_records_message_id ON retry_records(message_id)")
    
    def insert_message(self, message: CompensationMessage) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO messages (
                    id, topic, payload, retry_count, max_retries, status,
                    first_failed_at, last_failed_at, next_retry_at,
                    last_error_message, last_error_stack, error_category,
                    idempotent_key, created_at, updated_at, processed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                message.id,
                message.topic,
                _dict_to_json(message.payload),
                message.retry_count,
                message.max_retries,
                message.status.value,
                _datetime_to_str(message.first_failed_at),
                _datetime_to_str(message.last_failed_at),
                _datetime_to_str(message.next_retry_at),
                message.last_error_message,
                message.last_error_stack,
                message.error_category.value if message.error_category else None,
                message.idempotent_key,
                _datetime_to_str(message.created_at),
                _datetime_to_str(message.updated_at),
                _datetime_to_str(message.processed_at),
            ))
    
    def insert_retry_record(self, record: RetryRecord) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO retry_records (
                    id, message_id, attempt_number, status,
                    error_message, error_stack, started_at, finished_at, duration_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.id,
                record.message_id,
                record.attempt_number,
                record.status,
                record.error_message,
                record.error_stack,
                _datetime_to_str(record.started_at),
                _datetime_to_str(record.finished_at),
                record.duration_ms,
            ))
    
    def get_message(self, message_id: str) -> Optional[CompensationMessage]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM messages WHERE id = ?", (message_id,))
            row = cursor.fetchone()
            return self._row_to_message(row) if row else None
    
    def _row_to_message(self, row: sqlite3.Row) -> CompensationMessage:
        return CompensationMessage(
            id=row["id"],
            topic=row["topic"],
            payload=_json_to_dict(row["payload"]),
            retry_count=row["retry_count"],
            max_retries=row["max_retries"],
            status=MessageStatus(row["status"]),
            first_failed_at=_str_to_datetime(row["first_failed_at"]),
            last_failed_at=_str_to_datetime(row["last_failed_at"]),
            next_retry_at=_str_to_datetime(row["next_retry_at"]),
            last_error_message=row["last_error_message"],
            last_error_stack=row["last_error_stack"],
            error_category=ErrorCategory(row["error_category"]) if row["error_category"] else None,
            idempotent_key=row["idempotent_key"],
            created_at=_str_to_datetime(row["created_at"]),
            updated_at=_str_to_datetime(row["updated_at"]),
            processed_at=_str_to_datetime(row["processed_at"]),
        )
    
    def list_messages(self, 
                      status: Optional[MessageStatus] = None,
                      topic: Optional[str] = None,
                      error_category: Optional[ErrorCategory] = None,
                      min_retry_count: Optional[int] = None,
                      max_retry_count: Optional[int] = None,
                      idempotent_key: Optional[str] = None,
                      created_after: Optional[datetime] = None,
                      created_before: Optional[datetime] = None,
                      limit: Optional[int] = None,
                      offset: int = 0,
                      order_by: str = "created_at",
                      order_dir: str = "DESC") -> List[CompensationMessage]:
        
        conditions: List[str] = []
        params: List[Any] = []
        
        if status:
            conditions.append("status = ?")
            params.append(status.value)
        if topic:
            conditions.append("topic LIKE ?")
            params.append(f"%{topic}%")
        if error_category:
            conditions.append("error_category = ?")
            params.append(error_category.value)
        if min_retry_count is not None:
            conditions.append("retry_count >= ?")
            params.append(min_retry_count)
        if max_retry_count is not None:
            conditions.append("retry_count <= ?")
            params.append(max_retry_count)
        if idempotent_key:
            conditions.append("idempotent_key = ?")
            params.append(idempotent_key)
        if created_after:
            conditions.append("created_at >= ?")
            params.append(created_after.isoformat())
        if created_before:
            conditions.append("created_at <= ?")
            params.append(created_before.isoformat())
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        query = f"""
            SELECT * FROM messages 
            WHERE {where_clause}
            ORDER BY {order_by} {order_dir}
        """
        
        if limit:
            query += f" LIMIT {limit} OFFSET {offset}"
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_message(row) for row in rows]
    
    def get_retry_history(self, message_id: str) -> List[RetryRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM retry_records 
                WHERE message_id = ? 
                ORDER BY attempt_number ASC
            """, (message_id,))
            rows = cursor.fetchall()
            return [
                RetryRecord(
                    id=row["id"],
                    message_id=row["message_id"],
                    attempt_number=row["attempt_number"],
                    status=row["status"],
                    error_message=row["error_message"],
                    error_stack=row["error_stack"],
                    started_at=_str_to_datetime(row["started_at"]),
                    finished_at=_str_to_datetime(row["finished_at"]),
                    duration_ms=row["duration_ms"],
                )
                for row in rows
            ]
    
    def update_message_status(self, message_id: str, status: MessageStatus) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE messages SET status = ?, updated_at = ? WHERE id = ?
            """, (status.value, datetime.now().isoformat(), message_id))
    
    def update_message(self, message: CompensationMessage) -> None:
        message.updated_at = datetime.now()
        self.insert_message(message)
    
    def delete_message(self, message_id: str) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    
    def get_duplicate_idempotent_keys(self) -> List[Tuple[str, int]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT idempotent_key, COUNT(*) as cnt 
                FROM messages 
                WHERE idempotent_key IS NOT NULL AND idempotent_key != ''
                GROUP BY idempotent_key 
                HAVING COUNT(*) > 1
                ORDER BY cnt DESC
            """)
            return [(row["idempotent_key"], row["cnt"]) for row in cursor.fetchall()]
    
    def count_messages(self, status: Optional[MessageStatus] = None, 
                      topic: Optional[str] = None) -> int:
        conditions: List[str] = []
        params: List[Any] = []
        
        if status:
            conditions.append("status = ?")
            params.append(status.value)
        if topic:
            conditions.append("topic = ?")
            params.append(topic)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) as cnt FROM messages WHERE {where_clause}", params)
            return cursor.fetchone()["cnt"]
