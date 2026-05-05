"""SQLite 存储模块 - 保存人工复核备注和测试历史"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import TestResult, ValidationMatrix, ValidationStatus


class Storage:
    """SQLite 存储管理器"""

    def __init__(self, db_path: str = "ccv_results.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化数据库表"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS test_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    contract_name TEXT NOT NULL,
                    contract_version TEXT NOT NULL,
                    run_at TIMESTAMP NOT NULL,
                    total_tests INTEGER DEFAULT 0,
                    passed_tests INTEGER DEFAULT 0,
                    failed_tests INTEGER DEFAULT 0,
                    skipped_tests INTEGER DEFAULT 0,
                    error_tests INTEGER DEFAULT 0
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS test_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id INTEGER,
                    contract_name TEXT NOT NULL,
                    subcommand_name TEXT NOT NULL,
                    test_case_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    command TEXT NOT NULL,
                    actual_exit_code INTEGER,
                    actual_stdout TEXT,
                    actual_stderr TEXT,
                    expected_exit_code INTEGER,
                    duration_seconds REAL,
                    timestamp TIMESTAMP NOT NULL,
                    failures TEXT,
                    tags TEXT,
                    notes TEXT,
                    FOREIGN KEY (run_id) REFERENCES test_runs(id)
                )
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_test_results_run_id 
                ON test_results(run_id)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_test_results_contract 
                ON test_results(contract_name, subcommand_name, test_case_name)
            """)

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

    def save_matrix(self, matrix: ValidationMatrix) -> int:
        """保存验证矩阵到数据库

        Args:
            matrix: 验证矩阵

        Returns:
            本次运行的 run_id
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO test_runs 
                (contract_name, contract_version, run_at, total_tests, 
                 passed_tests, failed_tests, skipped_tests, error_tests)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                matrix.contract_name,
                matrix.contract_version,
                matrix.generated_at.isoformat(),
                matrix.total_tests,
                matrix.passed_tests,
                matrix.failed_tests,
                matrix.skipped_tests,
                matrix.error_tests,
            ))

            run_id = cursor.lastrowid

            for result in matrix.results:
                self._save_result(cursor, run_id, result)

            conn.commit()
            return run_id

    def _save_result(self, cursor: sqlite3.Cursor, run_id: int, result: TestResult):
        """保存单个测试结果"""
        cursor.execute("""
            INSERT INTO test_results 
            (run_id, contract_name, subcommand_name, test_case_name, 
             status, command, actual_exit_code, actual_stdout, 
             actual_stderr, expected_exit_code, duration_seconds, 
             timestamp, failures, tags, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id,
            result.contract_name,
            result.subcommand_name,
            result.test_case_name,
            result.status.value,
            result.command,
            result.actual_exit_code,
            result.actual_stdout,
            result.actual_stderr,
            result.expected_exit_code,
            result.duration_seconds,
            result.timestamp.isoformat(),
            json.dumps(result.failures, ensure_ascii=False),
            json.dumps(result.tags, ensure_ascii=False),
            result.notes,
        ))

    def update_notes(
        self,
        result_id: int,
        notes: str,
    ) -> bool:
        """更新测试结果的人工复核备注

        Args:
            result_id: 测试结果 ID
            notes: 备注内容

        Returns:
            是否成功更新
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE test_results 
                SET notes = ? 
                WHERE id = ?
            """, (notes, result_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_result(self, result_id: int) -> Optional[TestResult]:
        """获取单个测试结果

        Args:
            result_id: 测试结果 ID

        Returns:
            测试结果对象，如果不存在返回 None
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM test_results WHERE id = ?
            """, (result_id,))
            row = cursor.fetchone()
            return self._row_to_result(row) if row else None

    def get_results_by_run(self, run_id: int) -> List[TestResult]:
        """获取指定运行的所有测试结果

        Args:
            run_id: 运行 ID

        Returns:
            测试结果列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM test_results WHERE run_id = ? ORDER BY id
            """, (run_id,))
            rows = cursor.fetchall()
            return [self._row_to_result(row) for row in rows]

    def get_latest_run(self, contract_name: str) -> Optional[int]:
        """获取指定契约的最近一次运行 ID

        Args:
            contract_name: 契约名称

        Returns:
            运行 ID，如果不存在返回 None
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id FROM test_runs 
                WHERE contract_name = ? 
                ORDER BY run_at DESC 
                LIMIT 1
            """, (contract_name,))
            row = cursor.fetchone()
            return row["id"] if row else None

    def list_runs(self, contract_name: Optional[str] = None, limit: int = 20) -> List[dict]:
        """列出测试运行记录

        Args:
            contract_name: 可选的契约名称过滤
            limit: 返回条数限制

        Returns:
            运行记录列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if contract_name:
                cursor.execute("""
                    SELECT * FROM test_runs 
                    WHERE contract_name = ? 
                    ORDER BY run_at DESC 
                    LIMIT ?
                """, (contract_name, limit))
            else:
                cursor.execute("""
                    SELECT * FROM test_runs 
                    ORDER BY run_at DESC 
                    LIMIT ?
                """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def _row_to_result(self, row: sqlite3.Row) -> TestResult:
        """将数据库行转换为 TestResult 对象"""
        return TestResult(
            contract_name=row["contract_name"],
            subcommand_name=row["subcommand_name"],
            test_case_name=row["test_case_name"],
            status=ValidationStatus(row["status"]),
            command=row["command"],
            actual_exit_code=row["actual_exit_code"],
            actual_stdout=row["actual_stdout"] or "",
            actual_stderr=row["actual_stderr"] or "",
            expected_exit_code=row["expected_exit_code"],
            duration_seconds=row["duration_seconds"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            failures=json.loads(row["failures"]) if row["failures"] else [],
            tags=json.loads(row["tags"]) if row["tags"] else [],
            notes=row["notes"],
        )
