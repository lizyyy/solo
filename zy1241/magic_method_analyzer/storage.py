"""SQLite 存储层"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Union

from .models import (
    AnalysisSession,
    Issue,
    IssueSeverity,
    IssueType,
    MagicMethodCall,
    MagicMethodType,
)


class SQLiteStorage:
    """SQLite 数据库存储"""
    
    SCHEMA_VERSION = 1
    
    def __init__(self, db_path: Union[str, Path] = "magic_analysis.db"):
        self.db_path = Path(db_path)
        self._init_db()
    
    def _init_db(self) -> None:
        """初始化数据库表结构"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 分析会话表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS analysis_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT UNIQUE NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    source_files TEXT,
                    method_calls_count INTEGER DEFAULT 0,
                    issues_count INTEGER DEFAULT 0,
                    metadata TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 方法调用记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS method_calls (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    method_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    caller TEXT,
                    target TEXT,
                    args TEXT,
                    kwargs TEXT,
                    result TEXT,
                    exception TEXT,
                    stack_trace TEXT,
                    metadata TEXT,
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(session_id)
                )
            ''')
            
            # 问题记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    issue_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    location TEXT,
                    suggestion TEXT,
                    related_call_ids TEXT,
                    metadata TEXT,
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(session_id)
                )
            ''')
            
            # 索引
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_session ON method_calls(session_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_calls_target ON method_calls(target)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_session ON issues(session_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity)')
            
            # 版本信息
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY
                )
            ''')
            cursor.execute('INSERT OR IGNORE INTO schema_version (version) VALUES (?)', (self.SCHEMA_VERSION,))
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self) -> Iterator[sqlite3.Connection]:
        """获取数据库连接"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def save_session(self, session: AnalysisSession) -> None:
        """保存分析会话"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 检查会话是否已存在
            cursor.execute(
                'SELECT id FROM analysis_sessions WHERE session_id = ?',
                (session.session_id,)
            )
            existing = cursor.fetchone()
            
            source_files_json = json.dumps(session.source_files, ensure_ascii=False)
            metadata_json = json.dumps(session.metadata, ensure_ascii=False)
            
            if existing:
                # 更新
                cursor.execute('''
                    UPDATE analysis_sessions
                    SET end_time = ?, source_files = ?, method_calls_count = ?, 
                        issues_count = ?, metadata = ?
                    WHERE session_id = ?
                ''', (
                    session.end_time.isoformat() if session.end_time else None,
                    source_files_json,
                    len(session.method_calls),
                    len(session.issues),
                    metadata_json,
                    session.session_id,
                ))
            else:
                # 插入
                cursor.execute('''
                    INSERT INTO analysis_sessions 
                    (session_id, start_time, end_time, source_files, 
                     method_calls_count, issues_count, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    session.session_id,
                    session.start_time.isoformat(),
                    session.end_time.isoformat() if session.end_time else None,
                    source_files_json,
                    len(session.method_calls),
                    len(session.issues),
                    metadata_json,
                ))
            
            # 保存方法调用
            self._save_method_calls(cursor, session.session_id, session.method_calls)
            
            # 保存问题
            self._save_issues(cursor, session.session_id, session.issues)
            
            conn.commit()
    
    def _save_method_calls(
        self, cursor: sqlite3.Cursor, session_id: str, calls: List[MagicMethodCall]
    ) -> None:
        """批量保存方法调用记录"""
        # 先删除该会话的旧记录
        cursor.execute('DELETE FROM method_calls WHERE session_id = ?', (session_id,))
        
        for call in calls:
            cursor.execute('''
                INSERT INTO method_calls
                (session_id, method_type, timestamp, caller, target, 
                 args, kwargs, result, exception, stack_trace, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                call.method_type.value,
                call.timestamp.isoformat(),
                call.caller,
                call.target,
                str(call.args),
                json.dumps(call.kwargs, ensure_ascii=False),
                str(call.result) if call.result is not None else None,
                str(call.exception) if call.exception else None,
                json.dumps(call.stack_trace, ensure_ascii=False),
                json.dumps(call.metadata, ensure_ascii=False),
            ))
    
    def _save_issues(
        self, cursor: sqlite3.Cursor, session_id: str, issues: List[Issue]
    ) -> None:
        """批量保存问题记录"""
        cursor.execute('DELETE FROM issues WHERE session_id = ?', (session_id,))
        
        for issue in issues:
            cursor.execute('''
                INSERT INTO issues
                (session_id, issue_type, severity, title, description, 
                 location, suggestion, related_call_ids, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                issue.issue_type.value,
                issue.severity.value,
                issue.title,
                issue.description,
                issue.location,
                issue.suggestion,
                json.dumps([c.to_dict() for c in issue.related_calls], ensure_ascii=False),
                json.dumps(issue.metadata, ensure_ascii=False),
            ))
    
    def get_session(self, session_id: str) -> Optional[AnalysisSession]:
        """获取指定会话"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM analysis_sessions WHERE session_id = ?
            ''', (session_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            return self._row_to_session(dict(row), cursor)
    
    def get_all_sessions(self, limit: int = 100) -> List[AnalysisSession]:
        """获取所有会话摘要"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM analysis_sessions 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (limit,))
            
            sessions = []
            for row in cursor.fetchall():
                session = self._row_to_session(dict(row), cursor, load_details=False)
                sessions.append(session)
            
            return sessions
    
    def _row_to_session(
        self, row: Dict, cursor: sqlite3.Cursor, load_details: bool = True
    ) -> AnalysisSession:
        """将数据库行转换为 AnalysisSession 对象"""
        metadata = json.loads(row["metadata"]) if row["metadata"] else {}
        metadata["method_calls_count"] = row.get("method_calls_count", 0)
        metadata["issues_count"] = row.get("issues_count", 0)
        
        session = AnalysisSession(
            session_id=row["session_id"],
            start_time=datetime.fromisoformat(row["start_time"]),
            end_time=datetime.fromisoformat(row["end_time"]) if row["end_time"] else None,
            source_files=json.loads(row["source_files"]) if row["source_files"] else [],
            metadata=metadata,
        )
        
        if load_details:
            # 加载方法调用
            cursor.execute('''
                SELECT * FROM method_calls WHERE session_id = ? ORDER BY timestamp
            ''', (session.session_id,))
            for call_row in cursor.fetchall():
                call = self._row_to_method_call(dict(call_row))
                session.method_calls.append(call)
            
            # 加载问题
            cursor.execute('''
                SELECT * FROM issues WHERE session_id = ?
            ''', (session.session_id,))
            for issue_row in cursor.fetchall():
                issue = self._row_to_issue(dict(issue_row))
                session.issues.append(issue)
        
        return session
    
    def _row_to_method_call(self, row: Dict) -> MagicMethodCall:
        """将数据库行转换为 MagicMethodCall 对象"""
        method_type = MagicMethodType(row["method_type"])
        
        return MagicMethodCall(
            method_type=method_type,
            timestamp=datetime.fromisoformat(row["timestamp"]),
            caller=row["caller"] or "unknown",
            target=row["target"] or "unknown",
            args=tuple(json.loads(row["args"])) if row["args"] else (),
            kwargs=json.loads(row["kwargs"]) if row["kwargs"] else {},
            result=row["result"],
            exception=Exception(row["exception"]) if row["exception"] else None,
            stack_trace=json.loads(row["stack_trace"]) if row["stack_trace"] else [],
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
        )
    
    def _row_to_issue(self, row: Dict) -> Issue:
        """将数据库行转换为 Issue 对象"""
        return Issue(
            issue_type=IssueType(row["issue_type"]),
            severity=IssueSeverity(row["severity"]),
            title=row["title"],
            description=row["description"] or "",
            location=row["location"] or "",
            suggestion=row["suggestion"] or "",
            related_calls=[],
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
        )
    
    def delete_session(self, session_id: str) -> bool:
        """删除指定会话"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM issues WHERE session_id = ?', (session_id,))
            cursor.execute('DELETE FROM method_calls WHERE session_id = ?', (session_id,))
            cursor.execute('DELETE FROM analysis_sessions WHERE session_id = ?', (session_id,))
            
            conn.commit()
            return cursor.rowcount > 0
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取数据库统计信息"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) as count FROM analysis_sessions')
            sessions_count = cursor.fetchone()["count"]
            
            cursor.execute('SELECT COUNT(*) as count FROM method_calls')
            calls_count = cursor.fetchone()["count"]
            
            cursor.execute('SELECT COUNT(*) as count FROM issues')
            issues_count = cursor.fetchone()["count"]
            
            cursor.execute('''
                SELECT severity, COUNT(*) as count 
                FROM issues GROUP BY severity
            ''')
            issues_by_severity = {row["severity"]: row["count"] for row in cursor.fetchall()}
            
            return {
                "sessions_count": sessions_count,
                "method_calls_count": calls_count,
                "issues_count": issues_count,
                "issues_by_severity": issues_by_severity,
            }
