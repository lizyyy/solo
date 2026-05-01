# -*- coding: utf-8 -*-
"""
数据存储模块
负责SQLite数据库操作，保存计算结果和历史查询
"""

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional, Iterator
from collections import defaultdict

from .calculator import AlkalinityResult, GranFitResult
from .quality_control import QCStatus, BatchQCResult, SampleQCResult, DuplicateQCResult


@dataclass
class CalculationBatch:
    """计算批次"""
    id: Optional[int]
    batch_name: str
    created_at: str
    project_name: str
    standard_concentration_mol_l: float
    sample_volume_used_ml: float
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StoredSampleResult:
    """存储的样品结果"""
    id: Optional[int]
    batch_id: int
    sample_id: str
    sampling_point: str
    bottle_number: str
    total_alkalinity_mg_l_caco3: float
    endpoint_volume_ml: float
    blank_corrected_volume_ml: float
    temperature_c: Optional[float]
    dilution_factor: float
    qc_status: str
    qc_issues: List[Dict[str, Any]] = field(default_factory=list)
    gran_fit_data: Optional[Dict[str, Any]] = None
    is_blank: bool = False
    is_duplicate: bool = False
    parent_sample_id: Optional[str] = None


class DatabaseManager:
    """SQLite数据库管理器"""

    DB_FILENAME = "alkcalc_results.db"

    def __init__(self, data_dir: Path):
        """
        初始化数据库管理器
        
        Args:
            data_dir: 数据目录路径
        """
        self.data_dir = data_dir
        self.db_path = data_dir / self.DB_FILENAME
        self._ensure_db_exists()

    def _ensure_db_exists(self) -> None:
        """确保数据库和表存在"""
        with self._get_connection() as conn:
            self._create_tables(conn)

    @contextmanager
    def _get_connection(self) -> Iterator[sqlite3.Connection]:
        """获取数据库连接（上下文管理器）"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _create_tables(self, conn: sqlite3.Connection) -> None:
        """创建数据库表"""
        # 计算批次表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS calculation_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                project_name TEXT,
                standard_concentration_mol_l REAL,
                sample_volume_used_ml REAL,
                notes TEXT,
                metadata TEXT
            )
        """)

        # 样品结果表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sample_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER NOT NULL,
                sample_id TEXT NOT NULL,
                sampling_point TEXT,
                bottle_number TEXT,
                total_alkalinity_mg_l_caco3 REAL,
                endpoint_volume_ml REAL,
                blank_corrected_volume_ml REAL,
                temperature_c REAL,
                dilution_factor REAL,
                qc_status TEXT,
                qc_issues TEXT,
                gran_fit_data TEXT,
                is_blank INTEGER DEFAULT 0,
                is_duplicate INTEGER DEFAULT 0,
                parent_sample_id TEXT,
                FOREIGN KEY (batch_id) REFERENCES calculation_batches (id)
            )
        """)

        # 创建索引以加速查询
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sample_results_batch_id 
            ON sample_results (batch_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sample_results_sample_id 
            ON sample_results (sample_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sample_results_sampling_point 
            ON sample_results (sampling_point)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sample_results_qc_status 
            ON sample_results (qc_status)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_batches_created_at 
            ON calculation_batches (created_at)
        """)

    def save_calculation_batch(
        self,
        batch_name: str,
        project_name: str,
        standard_concentration_mol_l: float,
        sample_volume_used_ml: float,
        sample_results: Dict[str, AlkalinityResult],
        sample_infos: Dict[str, Any],
        batch_qc_result: BatchQCResult,
        notes: str = ""
    ) -> int:
        """
        保存计算批次及其所有样品结果
        
        Args:
            batch_name: 批次名称
            project_name: 项目名称
            standard_concentration_mol_l: 标准液浓度
            sample_volume_used_ml: 样品体积
            sample_results: 样品碱度计算结果字典
            sample_infos: 样品信息字典
            batch_qc_result: 批次质控结果
            notes: 备注
            
        Returns:
            批次ID
        """
        metadata = {
            "qc_summary": batch_qc_result.summary,
            "overall_status": batch_qc_result.overall_status.value,
            "saved_at": datetime.now().isoformat()
        }

        with self._get_connection() as conn:
            # 插入批次记录
            cursor = conn.execute("""
                INSERT INTO calculation_batches 
                (batch_name, created_at, project_name, standard_concentration_mol_l, 
                 sample_volume_used_ml, notes, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                batch_name,
                datetime.now().isoformat(),
                project_name,
                standard_concentration_mol_l,
                sample_volume_used_ml,
                notes,
                json.dumps(metadata, ensure_ascii=False)
            ))
            batch_id = cursor.lastrowid

            # 插入每个样品结果
            for sample_id, result in sample_results.items():
                sample_info = sample_infos.get(sample_id, {})
                qc_result = batch_qc_result.sample_results.get(sample_id)

                qc_status = qc_result.status.value if qc_result else QCStatus.PASS.value
                qc_issues = []
                if qc_result:
                    qc_issues = [
                        {
                            "rule_code": issue.rule_code,
                            "status": issue.status.value,
                            "message": issue.message,
                            "details": issue.details
                        }
                        for issue in qc_result.issues
                    ]

                gran_fit_data = None
                if result.gran_fit:
                    gran_fit_data = {
                        "endpoint_volume_ml": result.gran_fit.endpoint_volume_ml,
                        "slope": result.gran_fit.slope,
                        "intercept": result.gran_fit.intercept,
                        "r_squared": result.gran_fit.r_squared,
                        "used_points": result.gran_fit.used_points,
                        "ph_range_used": list(result.gran_fit.ph_range_used)
                    }

                conn.execute("""
                    INSERT INTO sample_results 
                    (batch_id, sample_id, sampling_point, bottle_number,
                     total_alkalinity_mg_l_caco3, endpoint_volume_ml, 
                     blank_corrected_volume_ml, temperature_c, dilution_factor,
                     qc_status, qc_issues, gran_fit_data,
                     is_blank, is_duplicate, parent_sample_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch_id,
                    sample_id,
                    getattr(sample_info, 'sampling_point', '') if hasattr(sample_info, 'sampling_point') else '',
                    getattr(sample_info, 'bottle_number', '') if hasattr(sample_info, 'bottle_number') else '',
                    result.total_alkalinity_mg_l_caco3,
                    result.endpoint_volume_ml,
                    result.blank_corrected_volume_ml,
                    result.temperature_c,
                    result.dilution_factor,
                    qc_status,
                    json.dumps(qc_issues, ensure_ascii=False),
                    json.dumps(gran_fit_data, ensure_ascii=False) if gran_fit_data else None,
                    1 if getattr(sample_info, 'is_blank', False) else 0,
                    1 if getattr(sample_info, 'is_duplicate', False) else 0,
                    getattr(sample_info, 'parent_sample_id', None) if hasattr(sample_info, 'parent_sample_id') else None
                ))

            return batch_id

    def get_batch(self, batch_id: int) -> Optional[CalculationBatch]:
        """
        获取指定批次的信息
        
        Args:
            batch_id: 批次ID
            
        Returns:
            批次信息，不存在则返回None
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, batch_name, created_at, project_name, 
                       standard_concentration_mol_l, sample_volume_used_ml, 
                       notes, metadata
                FROM calculation_batches
                WHERE id = ?
            """, (batch_id,))
            row = cursor.fetchone()
            
            if row is None:
                return None
            
            metadata = {}
            if row["metadata"]:
                try:
                    metadata = json.loads(row["metadata"])
                except json.JSONDecodeError:
                    pass
            
            return CalculationBatch(
                id=row["id"],
                batch_name=row["batch_name"],
                created_at=row["created_at"],
                project_name=row["project_name"] or "",
                standard_concentration_mol_l=row["standard_concentration_mol_l"] or 0,
                sample_volume_used_ml=row["sample_volume_used_ml"] or 0,
                notes=row["notes"] or "",
                metadata=metadata
            )

    def get_sample_results(self, batch_id: int) -> List[StoredSampleResult]:
        """
        获取指定批次的所有样品结果
        
        Args:
            batch_id: 批次ID
            
        Returns:
            样品结果列表
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, batch_id, sample_id, sampling_point, bottle_number,
                       total_alkalinity_mg_l_caco3, endpoint_volume_ml,
                       blank_corrected_volume_ml, temperature_c, dilution_factor,
                       qc_status, qc_issues, gran_fit_data,
                       is_blank, is_duplicate, parent_sample_id
                FROM sample_results
                WHERE batch_id = ?
                ORDER BY sample_id
            """, (batch_id,))
            
            results = []
            for row in cursor:
                qc_issues = []
                if row["qc_issues"]:
                    try:
                        qc_issues = json.loads(row["qc_issues"])
                    except json.JSONDecodeError:
                        pass
                
                gran_fit_data = None
                if row["gran_fit_data"]:
                    try:
                        gran_fit_data = json.loads(row["gran_fit_data"])
                    except json.JSONDecodeError:
                        pass
                
                results.append(StoredSampleResult(
                    id=row["id"],
                    batch_id=row["batch_id"],
                    sample_id=row["sample_id"],
                    sampling_point=row["sampling_point"] or "",
                    bottle_number=row["bottle_number"] or "",
                    total_alkalinity_mg_l_caco3=row["total_alkalinity_mg_l_caco3"] or 0,
                    endpoint_volume_ml=row["endpoint_volume_ml"] or 0,
                    blank_corrected_volume_ml=row["blank_corrected_volume_ml"] or 0,
                    temperature_c=row["temperature_c"],
                    dilution_factor=row["dilution_factor"] or 1.0,
                    qc_status=row["qc_status"] or QCStatus.PASS.value,
                    qc_issues=qc_issues,
                    gran_fit_data=gran_fit_data,
                    is_blank=bool(row["is_blank"]),
                    is_duplicate=bool(row["is_duplicate"]),
                    parent_sample_id=row["parent_sample_id"]
                ))
            
            return results

    def query_history(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sampling_point: Optional[str] = None,
        qc_status: Optional[str] = None,
        sample_id: Optional[str] = None
    ) -> Dict[int, Dict[str, Any]]:
        """
        查询历史计算结果
        
        Args:
            start_date: 开始日期
            end_date: 结束日期
            sampling_point: 采样点过滤
            qc_status: 质控状态过滤
            sample_id: 样品ID过滤
            
        Returns:
            按批次ID分组的查询结果
        """
        conditions = []
        params = []

        # 构建查询条件
        base_query = """
            SELECT DISTINCT b.id as batch_id, b.batch_name, b.created_at, 
                   b.project_name, b.standard_concentration_mol_l,
                   s.id as result_id, s.sample_id, s.sampling_point,
                   s.total_alkalinity_mg_l_caco3, s.qc_status
            FROM calculation_batches b
            JOIN sample_results s ON b.id = s.batch_id
            WHERE 1=1
        """

        if start_date:
            conditions.append("date(b.created_at) >= ?")
            params.append(start_date.isoformat())
        
        if end_date:
            conditions.append("date(b.created_at) <= ?")
            params.append(end_date.isoformat())
        
        if sampling_point:
            conditions.append("s.sampling_point LIKE ?")
            params.append(f"%{sampling_point}%")
        
        if qc_status:
            conditions.append("s.qc_status = ?")
            params.append(qc_status)
        
        if sample_id:
            conditions.append("s.sample_id LIKE ?")
            params.append(f"%{sample_id}%")

        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        base_query += " ORDER BY b.created_at DESC, s.sample_id"

        with self._get_connection() as conn:
            cursor = conn.execute(base_query, params)
            
            results: Dict[int, Dict[str, Any]] = defaultdict(lambda: {
                "batch_info": None,
                "samples": []
            })
            
            for row in cursor:
                batch_id = row["batch_id"]
                
                if results[batch_id]["batch_info"] is None:
                    results[batch_id]["batch_info"] = {
                        "id": batch_id,
                        "batch_name": row["batch_name"],
                        "created_at": row["created_at"],
                        "project_name": row["project_name"],
                        "standard_concentration_mol_l": row["standard_concentration_mol_l"]
                    }
                
                results[batch_id]["samples"].append({
                    "result_id": row["result_id"],
                    "sample_id": row["sample_id"],
                    "sampling_point": row["sampling_point"],
                    "total_alkalinity_mg_l_caco3": row["total_alkalinity_mg_l_caco3"],
                    "qc_status": row["qc_status"]
                })
            
            return dict(results)

    def get_all_batches(self) -> List[CalculationBatch]:
        """
        获取所有计算批次
        
        Returns:
            批次列表（按创建时间倒序）
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, batch_name, created_at, project_name, 
                       standard_concentration_mol_l, sample_volume_used_ml, 
                       notes, metadata
                FROM calculation_batches
                ORDER BY created_at DESC
            """)
            
            batches = []
            for row in cursor:
                metadata = {}
                if row["metadata"]:
                    try:
                        metadata = json.loads(row["metadata"])
                    except json.JSONDecodeError:
                        pass
                
                batches.append(CalculationBatch(
                    id=row["id"],
                    batch_name=row["batch_name"],
                    created_at=row["created_at"],
                    project_name=row["project_name"] or "",
                    standard_concentration_mol_l=row["standard_concentration_mol_l"] or 0,
                    sample_volume_used_ml=row["sample_volume_used_ml"] or 0,
                    notes=row["notes"] or "",
                    metadata=metadata
                ))
            
            return batches

    def delete_batch(self, batch_id: int) -> bool:
        """
        删除指定批次及其所有样品结果
        
        Args:
            batch_id: 批次ID
            
        Returns:
            是否成功删除
        """
        with self._get_connection() as conn:
            # 先检查批次是否存在
            cursor = conn.execute("SELECT id FROM calculation_batches WHERE id = ?", (batch_id,))
            if cursor.fetchone() is None:
                return False
            
            # 删除样品结果（外键约束可能需要先删）
            conn.execute("DELETE FROM sample_results WHERE batch_id = ?", (batch_id,))
            
            # 删除批次
            conn.execute("DELETE FROM calculation_batches WHERE id = ?", (batch_id,))
            
            return True

    def get_statistics(self, batch_id: Optional[int] = None) -> Dict[str, Any]:
        """
        获取统计信息
        
        Args:
            batch_id: 可选的批次ID，不指定则返回所有批次的统计
            
        Returns:
            统计信息字典
        """
        with self._get_connection() as conn:
            if batch_id:
                # 单个批次的统计
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_samples,
                        AVG(total_alkalinity_mg_l_caco3) as avg_alkalinity,
                        MIN(total_alkalinity_mg_l_caco3) as min_alkalinity,
                        MAX(total_alkalinity_mg_l_caco3) as max_alkalinity,
                        SUM(CASE WHEN qc_status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
                        SUM(CASE WHEN qc_status = 'WARNING' THEN 1 ELSE 0 END) as warning_count,
                        SUM(CASE WHEN qc_status = 'FAIL' THEN 1 ELSE 0 END) as fail_count,
                        SUM(CASE WHEN qc_status = 'ERROR' THEN 1 ELSE 0 END) as error_count
                    FROM sample_results
                    WHERE batch_id = ?
                """, (batch_id,))
            else:
                # 所有批次的统计
                cursor = conn.execute("""
                    SELECT 
                        COUNT(DISTINCT batch_id) as total_batches,
                        COUNT(*) as total_samples,
                        AVG(total_alkalinity_mg_l_caco3) as avg_alkalinity,
                        MIN(total_alkalinity_mg_l_caco3) as min_alkalinity,
                        MAX(total_alkalinity_mg_l_caco3) as max_alkalinity,
                        SUM(CASE WHEN qc_status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
                        SUM(CASE WHEN qc_status = 'WARNING' THEN 1 ELSE 0 END) as warning_count,
                        SUM(CASE WHEN qc_status = 'FAIL' THEN 1 ELSE 0 END) as fail_count,
                        SUM(CASE WHEN qc_status = 'ERROR' THEN 1 ELSE 0 END) as error_count
                    FROM sample_results
                """)
            
            row = cursor.fetchone()
            
            return {
                "total_batches": row["total_batches"] if "total_batches" in row.keys() else 1,
                "total_samples": row["total_samples"] or 0,
                "avg_alkalinity": row["avg_alkalinity"] or 0,
                "min_alkalinity": row["min_alkalinity"] or 0,
                "max_alkalinity": row["max_alkalinity"] or 0,
                "qc_counts": {
                    "PASS": row["pass_count"] or 0,
                    "WARNING": row["warning_count"] or 0,
                    "FAIL": row["fail_count"] or 0,
                    "ERROR": row["error_count"] or 0
                }
            }
