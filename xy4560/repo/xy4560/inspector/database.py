"""SQLite 数据存储"""

import sqlite3
import json
import os
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
from contextlib import contextmanager
from datetime import datetime


@dataclass
class InspectionRun:
    """一次完整的检查运行记录"""
    
    id: Optional[int] = None
    project_dir: str = ""
    run_time: str = ""
    status: str = ""
    duration: float = 0.0
    
    total_commands: int = 0
    success_commands: int = 0
    failed_commands: int = 0
    blocked_commands: int = 0
    
    total_issues: int = 0
    false_positives_marked: int = 0
    
    notes: str = ""


@dataclass
class IssueRecord:
    """问题记录"""
    
    id: Optional[int] = None
    run_id: int = 0
    
    issue_type: str = ""
    category: str = ""
    
    command: str = ""
    expected: str = ""
    actual: str = ""
    
    description: str = ""
    suggestion: str = ""
    
    is_false_positive: bool = False
    false_positive_reason: str = ""
    marked_by: str = ""
    marked_time: str = ""
    
    severity: str = "medium"
    raw_data: str = ""


@dataclass
class CommandRecord:
    """命令执行记录"""
    
    id: Optional[int] = None
    run_id: int = 0
    
    command: str = ""
    command_type: str = ""
    
    safety_status: str = ""
    execution_result: str = ""
    
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    
    duration: float = 0.0
    
    new_ports: str = ""
    new_files: str = ""
    key_output: str = ""
    
    created_at: str = ""


class DatabaseManager:
    """数据库管理器"""
    
    SCHEMA = """
    CREATE TABLE IF NOT EXISTS inspection_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_dir TEXT NOT NULL,
        run_time TEXT NOT NULL,
        status TEXT NOT NULL,
        duration REAL DEFAULT 0.0,
        
        total_commands INTEGER DEFAULT 0,
        success_commands INTEGER DEFAULT 0,
        failed_commands INTEGER DEFAULT 0,
        blocked_commands INTEGER DEFAULT 0,
        
        total_issues INTEGER DEFAULT 0,
        false_positives_marked INTEGER DEFAULT 0,
        
        notes TEXT,
        
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        
        issue_type TEXT NOT NULL,
        category TEXT NOT NULL,
        
        command TEXT,
        expected TEXT,
        actual TEXT,
        
        description TEXT,
        suggestion TEXT,
        
        is_false_positive BOOLEAN DEFAULT 0,
        false_positive_reason TEXT,
        marked_by TEXT,
        marked_time TEXT,
        
        severity TEXT DEFAULT 'medium',
        raw_data TEXT,
        
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (run_id) REFERENCES inspection_runs (id)
    );
    
    CREATE TABLE IF NOT EXISTS command_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        
        command TEXT NOT NULL,
        command_type TEXT,
        
        safety_status TEXT,
        execution_result TEXT,
        
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        
        duration REAL DEFAULT 0.0,
        
        new_ports TEXT,
        new_files TEXT,
        key_output TEXT,
        
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (run_id) REFERENCES inspection_runs (id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_issues_run_id ON issues (run_id);
    CREATE INDEX IF NOT EXISTS idx_issues_false_positive ON issues (is_false_positive);
    CREATE INDEX IF NOT EXISTS idx_command_records_run_id ON command_records (run_id);
    CREATE INDEX IF NOT EXISTS idx_inspection_runs_time ON inspection_runs (run_time);
    """
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """初始化数据库"""
        with self._get_connection() as conn:
            conn.executescript(self.SCHEMA)
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def create_inspection_run(
        self, 
        project_dir: str,
        status: str = "running"
    ) -> int:
        """创建新的检查运行记录"""
        run_time = datetime.now().isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO inspection_runs 
                (project_dir, run_time, status)
                VALUES (?, ?, ?)
                """,
                (project_dir, run_time, status)
            )
            conn.commit()
            return cursor.lastrowid
    
    def update_inspection_run(
        self,
        run_id: int,
        status: str,
        duration: float = 0.0,
        total_commands: int = 0,
        success_commands: int = 0,
        failed_commands: int = 0,
        blocked_commands: int = 0,
        total_issues: int = 0,
        notes: str = ""
    ):
        """更新检查运行记录"""
        with self._get_connection() as conn:
            conn.execute(
                """
                UPDATE inspection_runs
                SET status = ?, duration = ?, 
                    total_commands = ?, success_commands = ?, 
                    failed_commands = ?, blocked_commands = ?,
                    total_issues = ?, notes = ?
                WHERE id = ?
                """,
                (status, duration, total_commands, success_commands,
                 failed_commands, blocked_commands, total_issues, notes, run_id)
            )
            conn.commit()
    
    def add_issue(
        self,
        run_id: int,
        issue_type: str,
        category: str,
        command: str = "",
        expected: str = "",
        actual: str = "",
        description: str = "",
        suggestion: str = "",
        severity: str = "medium",
        raw_data: Dict[str, Any] = None
    ) -> int:
        """添加问题记录"""
        raw_data_str = json.dumps(raw_data, ensure_ascii=False) if raw_data else ""
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO issues
                (run_id, issue_type, category, command, expected, actual, 
                 description, suggestion, severity, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (run_id, issue_type, category, command, expected, actual,
                 description, suggestion, severity, raw_data_str)
            )
            conn.commit()
            return cursor.lastrowid
    
    def add_command_record(
        self,
        run_id: int,
        command: str,
        command_type: str,
        safety_status: str,
        execution_result: str,
        exit_code: Optional[int] = None,
        stdout: str = "",
        stderr: str = "",
        duration: float = 0.0,
        new_ports: List[int] = None,
        new_files: List[str] = None,
        key_output: List[str] = None
    ) -> int:
        """添加命令执行记录"""
        new_ports_str = json.dumps(new_ports) if new_ports else ""
        new_files_str = json.dumps(new_files) if new_files else ""
        key_output_str = json.dumps(key_output) if key_output else ""
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO command_records
                (run_id, command, command_type, safety_status, execution_result,
                 exit_code, stdout, stderr, duration, new_ports, new_files, key_output)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (run_id, command, command_type, safety_status, execution_result,
                 exit_code, stdout, stderr, duration, new_ports_str, new_files_str, key_output_str)
            )
            conn.commit()
            return cursor.lastrowid
    
    def mark_false_positive(
        self,
        issue_id: int,
        reason: str,
        marked_by: str = "user"
    ) -> bool:
        """标记问题为误报"""
        marked_time = datetime.now().isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE issues
                SET is_false_positive = 1,
                    false_positive_reason = ?,
                    marked_by = ?,
                    marked_time = ?
                WHERE id = ?
                """,
                (reason, marked_by, marked_time, issue_id)
            )
            
            if cursor.rowcount > 0:
                conn.execute(
                    """
                    UPDATE inspection_runs
                    SET false_positives_marked = false_positives_marked + 1
                    WHERE id = (SELECT run_id FROM issues WHERE id = ?)
                    """,
                    (issue_id,)
                )
                conn.commit()
                return True
            
            return False
    
    def get_inspection_run(self, run_id: int) -> Optional[Dict[str, Any]]:
        """获取检查运行记录"""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM inspection_runs WHERE id = ?",
                (run_id,)
            ).fetchone()
            
            if row:
                return dict(row)
            return None
    
    def get_issues(self, run_id: int, include_false_positives: bool = False) -> List[Dict[str, Any]]:
        """获取问题列表"""
        query = "SELECT * FROM issues WHERE run_id = ?"
        params = [run_id]
        
        if not include_false_positives:
            query += " AND is_false_positive = 0"
        
        query += " ORDER BY id"
        
        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]
    
    def get_command_records(self, run_id: int) -> List[Dict[str, Any]]:
        """获取命令执行记录"""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM command_records WHERE run_id = ? ORDER BY id",
                (run_id,)
            ).fetchall()
            
            results = []
            for row in rows:
                record = dict(row)
                for key in ['new_ports', 'new_files', 'key_output']:
                    if record.get(key):
                        try:
                            record[key] = json.loads(record[key])
                        except json.JSONDecodeError:
                            pass
                results.append(record)
            
            return results
    
    def get_all_runs(self, project_dir: str = None, limit: int = 100) -> List[Dict[str, Any]]:
        """获取所有检查运行记录"""
        query = "SELECT * FROM inspection_runs"
        params = []
        
        if project_dir:
            query += " WHERE project_dir = ?"
            params.append(project_dir)
        
        query += " ORDER BY run_time DESC LIMIT ?"
        params.append(limit)
        
        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]
    
    def get_run_summary(self, run_id: int) -> Dict[str, Any]:
        """获取运行摘要"""
        run = self.get_inspection_run(run_id)
        if not run:
            return {}
        
        issues = self.get_issues(run_id, include_false_positives=False)
        commands = self.get_command_records(run_id)
        
        issues_by_category = {}
        for issue in issues:
            cat = issue['category']
            if cat not in issues_by_category:
                issues_by_category[cat] = []
            issues_by_category[cat].append(issue)
        
        issues_by_severity = {}
        for issue in issues:
            sev = issue['severity']
            if sev not in issues_by_severity:
                issues_by_severity[sev] = 0
            issues_by_severity[sev] += 1
        
        return {
            "run": run,
            "commands": {
                "total": len(commands),
                "by_result": self._group_commands_by_result(commands)
            },
            "issues": {
                "total": len(issues),
                "by_category": {k: len(v) for k, v in issues_by_category.items()},
                "by_severity": issues_by_severity,
                "list": issues
            }
        }
    
    def _group_commands_by_result(self, commands: List[Dict]) -> Dict[str, int]:
        """按执行结果分组命令"""
        result = {
            "success": 0,
            "failed": 0,
            "blocked": 0,
            "timeout": 0,
            "skipped": 0
        }
        
        for cmd in commands:
            status = cmd.get('execution_result', 'unknown')
            if status in result:
                result[status] += 1
            else:
                result[status] = result.get(status, 0) + 1
        
        return result
    
    def export_to_json(self, run_id: int) -> str:
        """导出为 JSON"""
        summary = self.get_run_summary(run_id)
        return json.dumps(summary, ensure_ascii=False, indent=2)
    
    def delete_run(self, run_id: int) -> bool:
        """删除运行记录及关联数据"""
        with self._get_connection() as conn:
            conn.execute("DELETE FROM command_records WHERE run_id = ?", (run_id,))
            conn.execute("DELETE FROM issues WHERE run_id = ?", (run_id,))
            cursor = conn.execute("DELETE FROM inspection_runs WHERE id = ?", (run_id,))
            conn.commit()
            return cursor.rowcount > 0
