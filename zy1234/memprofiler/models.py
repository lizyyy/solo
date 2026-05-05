"""
数据模型模块
定义SQLite数据库表结构和数据操作类
"""

import sqlite3
import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum


class LeakSeverity(Enum):
    """泄漏严重程度枚举"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IssueType(Enum):
    """问题类型枚举"""
    CYCLE_REFERENCE = "cycle_reference"
    DEL_METHOD = "del_method"
    REF_COUNT_LEAK = "ref_count_leak"
    WEAKREF_INVALID = "weakref_invalid"
    CACHE_RESIDUE = "cache_residue"
    LARGE_OBJECT = "large_object"
    UNCOLLECTABLE = "uncollectable"


@dataclass
class ObjectInfo:
    """对象信息"""
    obj_id: str
    obj_type: str
    size: int
    ref_count: int
    address: str = ""
    module: str = ""
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReferenceRelation:
    """引用关系"""
    from_obj_id: str
    to_obj_id: str
    ref_type: str  # "strong", "weak", "attribute", "container"
    attribute_name: str = ""
    container_index: int = -1


@dataclass
class CycleReference:
    """循环引用"""
    cycle_id: str
    objects: List[str]  # 对象ID列表
    size: int
    has_del: bool
    is_uncollectable: bool
    evidence: str = ""


@dataclass
class LeakSuspect:
    """泄漏嫌疑对象"""
    suspect_id: str
    obj_id: str
    obj_type: str
    issue_type: IssueType
    severity: LeakSeverity
    size: int
    evidence: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    reference_chain: List[str] = field(default_factory=list)


@dataclass
class SnapshotInfo:
    """快照信息"""
    snapshot_id: str
    name: str
    timestamp: datetime
    total_objects: int
    total_size: int
    top_types: List[Dict[str, Any]] = field(default_factory=list)
    source_file: str = ""


@dataclass
class AnalysisResult:
    """分析结果"""
    analysis_id: str
    timestamp: datetime
    status: str  # "running", "completed", "failed"
    summary: Dict[str, Any] = field(default_factory=dict)
    suspects: List[LeakSuspect] = field(default_factory=list)
    cycles: List[CycleReference] = field(default_factory=list)
    objects: List[ObjectInfo] = field(default_factory=list)
    references: List[ReferenceRelation] = field(default_factory=list)
    snapshots: List[SnapshotInfo] = field(default_factory=list)
    error_message: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "analysis_id": self.analysis_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "status": self.status,
            "summary": self.summary,
            "suspects": [
                {
                    "suspect_id": s.suspect_id,
                    "obj_id": s.obj_id,
                    "obj_type": s.obj_type,
                    "issue_type": s.issue_type.value,
                    "severity": s.severity.value,
                    "size": s.size,
                    "evidence": s.evidence,
                    "suggestions": s.suggestions,
                    "reference_chain": s.reference_chain,
                }
                for s in self.suspects
            ],
            "cycles": [
                {
                    "cycle_id": c.cycle_id,
                    "objects": c.objects,
                    "size": c.size,
                    "has_del": c.has_del,
                    "is_uncollectable": c.is_uncollectable,
                    "evidence": c.evidence,
                }
                for c in self.cycles
            ],
        }


class DatabaseManager:
    """SQLite数据库管理器"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()
    
    def _get_connection(self) -> sqlite3.Connection:
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_database(self):
        """初始化数据库表结构"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                status TEXT NOT NULL,
                summary TEXT,
                error_message TEXT
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id TEXT PRIMARY KEY,
                analysis_id TEXT,
                name TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                total_objects INTEGER,
                total_size INTEGER,
                top_types TEXT,
                source_file TEXT,
                FOREIGN KEY (analysis_id) REFERENCES analyses(id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS suspects (
                id TEXT PRIMARY KEY,
                analysis_id TEXT,
                obj_id TEXT NOT NULL,
                obj_type TEXT NOT NULL,
                issue_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                size INTEGER,
                evidence TEXT,
                suggestions TEXT,
                reference_chain TEXT,
                FOREIGN KEY (analysis_id) REFERENCES analyses(id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cycles (
                id TEXT PRIMARY KEY,
                analysis_id TEXT,
                objects TEXT NOT NULL,
                size INTEGER,
                has_del INTEGER,
                is_uncollectable INTEGER,
                evidence TEXT,
                FOREIGN KEY (analysis_id) REFERENCES analyses(id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS objects (
                id TEXT PRIMARY KEY,
                analysis_id TEXT,
                obj_type TEXT NOT NULL,
                size INTEGER,
                ref_count INTEGER,
                address TEXT,
                module TEXT,
                attributes TEXT,
                FOREIGN KEY (analysis_id) REFERENCES analyses(id)
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_suspects_analysis ON suspects(analysis_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_cycles_analysis ON cycles(analysis_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_objects_analysis ON objects(analysis_id)
        """)
        
        conn.commit()
        conn.close()
    
    def create_analysis(self) -> str:
        """创建新的分析记录"""
        analysis_id = str(uuid.uuid4())
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO analyses (id, timestamp, status) VALUES (?, ?, ?)",
            (analysis_id, datetime.now().isoformat(), "running")
        )
        
        conn.commit()
        conn.close()
        return analysis_id
    
    def update_analysis(self, analysis_id: str, status: str, 
                        summary: Dict[str, Any] = None,
                        error_message: str = ""):
        """更新分析记录"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """UPDATE analyses 
               SET status = ?, summary = ?, error_message = ?, timestamp = ?
               WHERE id = ?""",
            (
                status,
                json.dumps(summary or {}, ensure_ascii=False),
                error_message,
                datetime.now().isoformat(),
                analysis_id
            )
        )
        
        conn.commit()
        conn.close()
    
    def save_snapshot(self, analysis_id: str, snapshot: SnapshotInfo):
        """保存快照信息"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT INTO snapshots 
               (id, analysis_id, name, timestamp, total_objects, total_size, top_types, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                snapshot.snapshot_id,
                analysis_id,
                snapshot.name,
                snapshot.timestamp.isoformat() if snapshot.timestamp else None,
                snapshot.total_objects,
                snapshot.total_size,
                json.dumps(snapshot.top_types, ensure_ascii=False),
                snapshot.source_file
            )
        )
        
        conn.commit()
        conn.close()
    
    def save_suspect(self, analysis_id: str, suspect: LeakSuspect):
        """保存泄漏嫌疑对象"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT INTO suspects 
               (id, analysis_id, obj_id, obj_type, issue_type, severity, 
                size, evidence, suggestions, reference_chain)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                suspect.suspect_id,
                analysis_id,
                suspect.obj_id,
                suspect.obj_type,
                suspect.issue_type.value,
                suspect.severity.value,
                suspect.size,
                json.dumps(suspect.evidence, ensure_ascii=False),
                json.dumps(suspect.suggestions, ensure_ascii=False),
                json.dumps(suspect.reference_chain, ensure_ascii=False)
            )
        )
        
        conn.commit()
        conn.close()
    
    def save_cycle(self, analysis_id: str, cycle: CycleReference):
        """保存循环引用"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT INTO cycles 
               (id, analysis_id, objects, size, has_del, is_uncollectable, evidence)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                cycle.cycle_id,
                analysis_id,
                json.dumps(cycle.objects, ensure_ascii=False),
                cycle.size,
                1 if cycle.has_del else 0,
                1 if cycle.is_uncollectable else 0,
                cycle.evidence
            )
        )
        
        conn.commit()
        conn.close()
    
    def save_object(self, analysis_id: str, obj: ObjectInfo):
        """保存对象信息"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """INSERT INTO objects 
               (id, analysis_id, obj_type, size, ref_count, address, module, attributes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                obj.obj_id,
                analysis_id,
                obj.obj_type,
                obj.size,
                obj.ref_count,
                obj.address,
                obj.module,
                json.dumps(obj.attributes, ensure_ascii=False)
            )
        )
        
        conn.commit()
        conn.close()
    
    def get_latest_analysis(self) -> Optional[Dict[str, Any]]:
        """获取最近一次分析"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM analyses ORDER BY timestamp DESC LIMIT 1"
        )
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def get_analysis(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """获取指定分析"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM analyses WHERE id = ?", (analysis_id,)
        )
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def get_suspects(self, analysis_id: str) -> List[Dict[str, Any]]:
        """获取分析的所有嫌疑对象"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM suspects WHERE analysis_id = ? ORDER BY severity DESC, size DESC",
            (analysis_id,)
        )
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_cycles(self, analysis_id: str) -> List[Dict[str, Any]]:
        """获取分析的所有循环引用"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM cycles WHERE analysis_id = ?",
            (analysis_id,)
        )
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_all_analyses(self) -> List[Dict[str, Any]]:
        """获取所有分析记录"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM analyses ORDER BY timestamp DESC"
        )
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
