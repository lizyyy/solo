"""历史记录和版本追踪模块"""

import sqlite3
import json
import hashlib
import os
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from dataclasses import asdict

from .types import HistoryEntry, CorrectionRecord, ProcessedData


class HistoryTracker:
    """历史记录追踪器"""

    def __init__(self, db_path: str = "~/.error_propagation/history.db"):
        self.db_path = os.path.expanduser(db_path)
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_database()

    def _init_database(self):
        """初始化数据库"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_name TEXT NOT NULL,
                    processed_at REAL NOT NULL,
                    processed_by TEXT NOT NULL,
                    original_data_hash TEXT NOT NULL,
                    corrections TEXT,
                    issues_found INTEGER DEFAULT 0,
                    issues_resolved INTEGER DEFAULT 0,
                    summary TEXT,
                    report_path TEXT,
                    raw_data TEXT
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS corrections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    history_id INTEGER NOT NULL,
                    field TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    reason TEXT,
                    corrected_by TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    FOREIGN KEY (history_id) REFERENCES history (id)
                )
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_history_filename ON history(file_name)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_history_hash ON history(original_data_hash)
            ''')

            conn.commit()

    def _compute_data_hash(self, data: Any) -> str:
        """计算数据的哈希值"""
        if isinstance(data, str):
            data_str = data
        else:
            data_str = json.dumps(data, sort_keys=True, default=str, ensure_ascii=False)
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

    def save_entry(
        self,
        file_name: str,
        original_data: Any,
        corrections: List[CorrectionRecord],
        issues_found: int,
        issues_resolved: int,
        summary: str,
        processed_by: str = "teacher",
        report_path: Optional[str] = None
    ) -> int:
        """保存历史记录"""
        data_hash = self._compute_data_hash(original_data)
        processed_at = time.time()
        corrections_json = json.dumps([asdict(c) for c in corrections], ensure_ascii=False)

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO history (
                    file_name, processed_at, processed_by, original_data_hash,
                    corrections, issues_found, issues_resolved, summary, report_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                file_name, processed_at, processed_by, data_hash,
                corrections_json, issues_found, issues_resolved, summary, report_path
            ))

            history_id = cursor.lastrowid

            for corr in corrections:
                cursor.execute('''
                    INSERT INTO corrections (
                        history_id, field, old_value, new_value,
                        reason, corrected_by, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    history_id, corr.field, str(corr.old_value), str(corr.new_value),
                    corr.reason, corr.corrected_by, corr.timestamp
                ))

            conn.commit()

            return history_id

    def get_entry(self, entry_id: int) -> Optional[HistoryEntry]:
        """获取单条历史记录"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM history WHERE id = ?', (entry_id,))
            row = cursor.fetchone()

            if row:
                return self._row_to_entry(dict(row))

            return None

    def list_entries(
        self,
        file_name: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[HistoryEntry]:
        """列出历史记录"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            if file_name:
                cursor.execute(
                    'SELECT * FROM history WHERE file_name = ? ORDER BY processed_at DESC LIMIT ? OFFSET ?',
                    (file_name, limit, offset)
                )
            else:
                cursor.execute(
                    'SELECT * FROM history ORDER BY processed_at DESC LIMIT ? OFFSET ?',
                    (limit, offset)
                )

            rows = cursor.fetchall()
            return [self._row_to_entry(dict(row)) for row in rows]

    def get_file_history(self, file_name: str) -> List[HistoryEntry]:
        """获取某个文件的所有历史版本"""
        return self.list_entries(file_name=file_name, limit=1000)

    def find_duplicates(self, original_data: Any) -> List[HistoryEntry]:
        """查找相同数据的历史记录"""
        data_hash = self._compute_data_hash(original_data)

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                'SELECT * FROM history WHERE original_data_hash = ? ORDER BY processed_at DESC',
                (data_hash,)
            )

            rows = cursor.fetchall()
            return [self._row_to_entry(dict(row)) for row in rows]

    def get_corrections(self, history_id: int) -> List[CorrectionRecord]:
        """获取某次处理的所有修正记录"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                'SELECT * FROM corrections WHERE history_id = ? ORDER BY timestamp',
                (history_id,)
            )

            rows = cursor.fetchall()
            return [
                CorrectionRecord(
                    field=row['field'],
                    old_value=row['old_value'],
                    new_value=row['new_value'],
                    reason=row['reason'],
                    corrected_by=row['corrected_by'],
                    timestamp=row['timestamp']
                )
                for row in rows
            ]

    def compare_entries(self, entry_id1: int, entry_id2: int) -> Dict[str, Any]:
        """比较两条历史记录"""
        entry1 = self.get_entry(entry_id1)
        entry2 = self.get_entry(entry_id2)

        if not entry1 or not entry2:
            return {"error": "Entry not found"}

        differences = {
            "metadata": {
                "entry1": {
                    "id": entry1.id,
                    "file_name": entry1.file_name,
                    "processed_at": datetime.fromtimestamp(entry1.processed_at).strftime('%Y-%m-%d %H:%M:%S'),
                    "processed_by": entry1.processed_by,
                },
                "entry2": {
                    "id": entry2.id,
                    "file_name": entry2.file_name,
                    "processed_at": datetime.fromtimestamp(entry2.processed_at).strftime('%Y-%m-%d %H:%M:%S'),
                    "processed_by": entry2.processed_by,
                }
            },
            "summary_diff": {
                "entry1_summary": entry1.summary,
                "entry2_summary": entry2.summary,
            },
            "statistics_diff": {
                "issues_found": {
                    "entry1": entry1.issues_found,
                    "entry2": entry2.issues_resolved,
                    "change": entry2.issues_found - entry1.issues_found
                },
                "issues_resolved": {
                    "entry1": entry1.issues_resolved,
                    "entry2": entry2.issues_resolved,
                    "change": entry2.issues_resolved - entry1.issues_resolved
                },
                "corrections_count": {
                    "entry1": len(entry1.corrections),
                    "entry2": len(entry2.corrections),
                    "change": len(entry2.corrections) - len(entry1.corrections)
                }
            },
            "corrections_diff": {
                "new_in_entry2": [],
                "modified": []
            }
        }

        corr1_fields = {c.field: c for c in entry1.corrections}
        corr2_fields = {c.field: c for c in entry2.corrections}

        for field in corr2_fields:
            if field not in corr1_fields:
                differences["corrections_diff"]["new_in_entry2"].append(asdict(corr2_fields[field]))
            elif corr1_fields[field].new_value != corr2_fields[field].new_value:
                differences["corrections_diff"]["modified"].append({
                    "field": field,
                    "entry1_value": corr1_fields[field].new_value,
                    "entry2_value": corr2_fields[field].new_value,
                    "entry1_by": corr1_fields[field].corrected_by,
                    "entry2_by": corr2_fields[field].corrected_by,
                })

        return differences

    def _row_to_entry(self, row: Dict[str, Any]) -> HistoryEntry:
        """将数据库行转换为HistoryEntry"""
        corrections_json = row.get('corrections', '[]')
        try:
            corrections_data = json.loads(corrections_json) if corrections_json else []
        except json.JSONDecodeError:
            corrections_data = []

        corrections = [
            CorrectionRecord(**c) for c in corrections_data
        ]

        return HistoryEntry(
            id=row['id'],
            file_name=row['file_name'],
            processed_at=row['processed_at'],
            processed_by=row['processed_by'],
            original_data_hash=row['original_data_hash'],
            corrections=corrections,
            issues_found=row['issues_found'],
            issues_resolved=row['issues_resolved'],
            summary=row['summary'] or '',
            report_path=row['report_path']
        )

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('SELECT COUNT(*) FROM history')
            total_entries = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(DISTINCT file_name) FROM history')
            total_files = cursor.fetchone()[0]

            cursor.execute('SELECT SUM(issues_found) FROM history')
            total_issues = cursor.fetchone()[0] or 0

            cursor.execute('SELECT SUM(issues_resolved) FROM history')
            total_resolved = cursor.fetchone()[0] or 0

            cursor.execute('SELECT COUNT(*) FROM corrections')
            total_corrections = cursor.fetchone()[0]

            cursor.execute('SELECT DISTINCT corrected_by FROM corrections')
            users = [row[0] for row in cursor.fetchall()]

            return {
                "total_entries": total_entries,
                "total_files": total_files,
                "total_issues_found": total_issues,
                "total_issues_resolved": total_resolved,
                "total_corrections": total_corrections,
                "active_users": users,
                "resolution_rate": (total_resolved / total_issues * 100) if total_issues > 0 else 0
            }

    def delete_entry(self, entry_id: int) -> bool:
        """删除历史记录"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('DELETE FROM corrections WHERE history_id = ?', (entry_id,))
            cursor.execute('DELETE FROM history WHERE id = ?', (entry_id,))
            conn.commit()

            return cursor.rowcount > 0
