"""
文本分类边界样本管理系统
核心数据模型定义
"""
import sqlite3
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict
from enum import Enum


class SampleStatus(str, Enum):
    """边界样本处理状态"""
    PENDING_REVIEW = "pending_review"        # 待复核（同一批重复训练等异常）
    IMPORTED = "imported"                    # 已导入（YAML刚导入）
    SLICE_VIEWED = "slice_viewed"            # 老唐已补看评测切片
    FEATURE_UPDATED = "feature_updated"      # 特征版本表已更新
    ABNORMAL = "abnormal"                    # 确认异常
    NORMAL = "normal"                        # 确认正常


class AnomalyType(str, Enum):
    """异常类型"""
    DUPLICATE_IMPORT = "duplicate_import"        # 重复导入
    DUPLICATE_TRAIN = "duplicate_train"          # 同一批数据重复训练
    SUPPLEMENT_RECALC = "supplement_recalc"      # 补录后重算
    EXPORT_INCONSISTENT = "export_inconsistent"  # 导出不一致


@dataclass
class YAMLLineRecord:
    """YAML原始行记录 - 保留每一行的证据"""
    id: Optional[int] = None
    yaml_version_id: int = 0
    line_number: int = 0
    original_content: str = ""
    current_content: str = ""
    is_modified: bool = False
    modified_by: str = ""
    modified_at: Optional[datetime] = None
    remark: str = ""


@dataclass
class YAMLVersion:
    """YAML版本记录"""
    id: Optional[int] = None
    version_name: str = ""
    import_time: datetime = field(default_factory=datetime.now)
    imported_by: str = ""
    file_name: str = ""
    raw_content: str = ""
    line_count: int = 0
    is_active: bool = True


@dataclass
class EvaluationSlice:
    """评测切片记录"""
    id: Optional[int] = None
    sample_id: int = 0
    slice_data: str = ""          # 评测切片的原始数据（JSON格式）
    viewed_by: str = ""
    viewed_at: Optional[datetime] = None
    viewer_remark: str = ""


@dataclass
class FeatureVersion:
    """特征版本表记录"""
    id: Optional[int] = None
    sample_id: int = 0
    feature_version: str = ""
    updated_by: str = ""
    updated_at: Optional[datetime] = None
    update_remark: str = ""


@dataclass
class BoundarySample:
    """文本分类边界样本主记录"""
    id: Optional[int] = None
    sample_key: str = ""                    # 样本唯一标识（如数据批次ID+样本ID）
    batch_id: str = ""                      # 数据批次ID
    text_content: str = ""                  # 文本内容
    predicted_category: str = ""            # 预测分类
    actual_category: str = ""               # 实际分类
    status: SampleStatus = SampleStatus.IMPORTED
    anomaly_types: List[AnomalyType] = field(default_factory=list)
    
    yaml_version_id: int = 0                # 关联的YAML版本
    yaml_line_number: int = 0               # 在YAML中的原始行号
    
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    last_updated_by: str = ""
    
    # 关联数据（查询时填充）
    yaml_lines: List[YAMLLineRecord] = field(default_factory=list)
    slices: List[EvaluationSlice] = field(default_factory=list)
    feature_versions: List[FeatureVersion] = field(default_factory=list)
    
    @property
    def is_abnormal(self) -> bool:
        return len(self.anomaly_types) > 0


def init_db(db_path: str = "boundary_samples.db"):
    """初始化数据库"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # YAML版本表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS yaml_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_name TEXT NOT NULL,
        import_time TIMESTAMP NOT NULL,
        imported_by TEXT NOT NULL,
        file_name TEXT NOT NULL,
        raw_content TEXT NOT NULL,
        line_count INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
    )
    ''')
    
    # YAML行记录表 - 保留每一行的改动痕迹
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS yaml_line_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        yaml_version_id INTEGER NOT NULL,
        line_number INTEGER NOT NULL,
        original_content TEXT NOT NULL,
        current_content TEXT NOT NULL,
        is_modified INTEGER NOT NULL DEFAULT 0,
        modified_by TEXT,
        modified_at TIMESTAMP,
        remark TEXT,
        FOREIGN KEY (yaml_version_id) REFERENCES yaml_versions (id)
    )
    ''')
    
    # 边界样本主表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS boundary_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_key TEXT NOT NULL UNIQUE,
        batch_id TEXT NOT NULL,
        text_content TEXT NOT NULL,
        predicted_category TEXT NOT NULL,
        actual_category TEXT NOT NULL,
        status TEXT NOT NULL,
        anomaly_types TEXT NOT NULL DEFAULT '[]',
        yaml_version_id INTEGER NOT NULL,
        yaml_line_number INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        last_updated_by TEXT NOT NULL,
        FOREIGN KEY (yaml_version_id) REFERENCES yaml_versions (id)
    )
    ''')
    
    # 评测切片表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS evaluation_slices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id INTEGER NOT NULL,
        slice_data TEXT NOT NULL,
        viewed_by TEXT,
        viewed_at TIMESTAMP,
        viewer_remark TEXT,
        FOREIGN KEY (sample_id) REFERENCES boundary_samples (id)
    )
    ''')
    
    # 特征版本表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS feature_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id INTEGER NOT NULL,
        feature_version TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        update_remark TEXT,
        FOREIGN KEY (sample_id) REFERENCES boundary_samples (id)
    )
    ''')
    
    # 审计日志表
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id INTEGER,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        operator TEXT NOT NULL,
        operate_time TIMESTAMP NOT NULL,
        remark TEXT,
        detail TEXT
    )
    ''')
    
    # 创建索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sample_key ON boundary_samples(sample_key)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_batch_id ON boundary_samples(batch_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_status ON boundary_samples(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_yaml_version ON boundary_samples(yaml_version_id)')
    
    conn.commit()
    conn.close()
