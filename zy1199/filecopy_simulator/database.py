"""SQLite 数据库存储层"""

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import SimulationResult, TransferMethod, BottleneckType


class Database:
    """数据库管理类"""
    
    def __init__(self, db_path: Path = None):
        if db_path is None:
            db_path = Path.home() / ".filecopy_simulator" / "results.db"
        self.db_path = db_path
        self._ensure_db_exists()
    
    def _ensure_db_exists(self):
        """确保数据库和表存在"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS simulation_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_name TEXT NOT NULL,
                    file_size_mb REAL NOT NULL,
                    method TEXT NOT NULL,
                    user_space_copies INTEGER NOT NULL,
                    kernel_space_copies INTEGER NOT NULL,
                    total_copies INTEGER NOT NULL,
                    context_switches INTEGER NOT NULL,
                    system_calls INTEGER NOT NULL,
                    estimated_cpu_usage_pct REAL NOT NULL,
                    estimated_time_ms REAL NOT NULL,
                    estimated_throughput_mbps REAL NOT NULL,
                    bottleneck TEXT NOT NULL,
                    bottleneck_reason TEXT NOT NULL,
                    copy_details TEXT NOT NULL,
                    config_snapshot TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
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
    
    def save_result(self, result: SimulationResult) -> int:
        """保存模拟结果，返回记录 ID"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO simulation_results (
                    case_name, file_size_mb, method,
                    user_space_copies, kernel_space_copies, total_copies,
                    context_switches, system_calls,
                    estimated_cpu_usage_pct, estimated_time_ms, estimated_throughput_mbps,
                    bottleneck, bottleneck_reason,
                    copy_details, config_snapshot, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                result.case_name,
                result.file_size_mb,
                result.method.value,
                result.user_space_copies,
                result.kernel_space_copies,
                result.total_copies,
                result.context_switches,
                result.system_calls,
                result.estimated_cpu_usage_pct,
                result.estimated_time_ms,
                result.estimated_throughput_mbps,
                result.bottleneck.value,
                result.bottleneck_reason,
                json.dumps(result.copy_details, ensure_ascii=False),
                json.dumps(result.config_snapshot, ensure_ascii=False),
                result.created_at.isoformat()
            ))
            conn.commit()
            result.id = cursor.lastrowid
            return cursor.lastrowid
    
    def get_result(self, result_id: int) -> Optional[SimulationResult]:
        """根据 ID 获取模拟结果"""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM simulation_results WHERE id = ?",
                (result_id,)
            ).fetchone()
            if row is None:
                return None
            return self._row_to_result(row)
    
    def get_all_results(self, limit: int = 100) -> List[SimulationResult]:
        """获取所有模拟结果"""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM simulation_results ORDER BY created_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return [self._row_to_result(row) for row in rows]
    
    def get_results_by_case(self, case_name: str) -> List[SimulationResult]:
        """根据用例名称获取结果"""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM simulation_results WHERE case_name = ? ORDER BY created_at DESC",
                (case_name,)
            ).fetchall()
            return [self._row_to_result(row) for row in rows]
    
    def delete_result(self, result_id: int) -> bool:
        """删除指定的模拟结果"""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM simulation_results WHERE id = ?",
                (result_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def clear_all(self) -> int:
        """清空所有记录，返回删除的数量"""
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM simulation_results")
            conn.commit()
            return cursor.rowcount
    
    def _row_to_result(self, row) -> SimulationResult:
        """将数据库行转换为 SimulationResult 对象"""
        return SimulationResult(
            id=row["id"],
            case_name=row["case_name"],
            file_size_mb=row["file_size_mb"],
            method=TransferMethod(row["method"]),
            user_space_copies=row["user_space_copies"],
            kernel_space_copies=row["kernel_space_copies"],
            total_copies=row["total_copies"],
            context_switches=row["context_switches"],
            system_calls=row["system_calls"],
            estimated_cpu_usage_pct=row["estimated_cpu_usage_pct"],
            estimated_time_ms=row["estimated_time_ms"],
            estimated_throughput_mbps=row["estimated_throughput_mbps"],
            bottleneck=BottleneckType(row["bottleneck"]),
            bottleneck_reason=row["bottleneck_reason"],
            copy_details=json.loads(row["copy_details"]),
            config_snapshot=json.loads(row["config_snapshot"]),
            created_at=datetime.fromisoformat(row["created_at"])
        )
