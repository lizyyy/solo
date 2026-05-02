# -*- coding: utf-8 -*-
"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import List, Optional, Dict, Any
from pathlib import Path
import hashlib


class IssueType(Enum):
    """问题类型枚举"""
    MISSING_POINT = "点位漏拍"
    TIME_MISMATCH = "时间不一致"
    DUPLICATE = "重复照片"
    NAMING_ERROR = "命名不规范"
    PAIR_MISMATCH = "整改配对错误"
    OTHER = "其他问题"


class IssueSeverity(Enum):
    """问题严重程度"""
    CRITICAL = "严重"
    WARNING = "警告"
    INFO = "提示"


@dataclass
class WorkOrder:
    """工单信息"""
    order_id: str  # 工单号
    elevator_no: str  # 电梯编号
    location: str  # 位置
    maintenance_date: datetime  # 维保日期
    technician: str  # 维保人员
    required_points: List[str] = field(default_factory=list)  # 必拍点位列表
    has_rectification: bool = False  # 是否有整改任务
    rectification_items: List[str] = field(default_factory=list)  # 整改项列表
    metadata: Dict[str, Any] = field(default_factory=dict)  # 扩展元数据
    
    def __post_init__(self):
        if not self.required_points:
            self.required_points = [
                "机房", "轿厢", "底坑", "安全回路"
            ]


@dataclass
class Photo:
    """照片信息"""
    file_path: Path
    file_name: str
    file_size: int  # 字节
    photo_hash: str  # SHA256哈希
    capture_time: Optional[datetime] = None  # 拍摄时间（从EXIF或文件名解析）
    point_type: Optional[str] = None  # 点位类型（机房/轿厢/底坑/安全回路/整改等）
    is_before_rectification: Optional[bool] = None  # 是否为整改前照片
    rectification_item: Optional[str] = None  # 关联的整改项
    paired_photo_id: Optional[str] = None  # 配对照片ID
    work_order_id: Optional[str] = None  # 关联工单ID
    validated: bool = False  # 是否已校验
    issues: List['QualityIssue'] = field(default_factory=list)  # 关联的问题
    archived: bool = False  # 是否已归档
    archive_path: Optional[Path] = None  # 归档路径
    
    @property
    def photo_id(self) -> str:
        """照片唯一标识"""
        return self.photo_hash[:16] + "_" + self.file_name
    
    @classmethod
    def calculate_hash(cls, file_path: Path) -> str:
        """计算文件SHA256哈希"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()


@dataclass
class InspectionPoint:
    """检查点位"""
    point_name: str  # 点位名称
    point_code: str  # 点位代码
    required: bool = True  # 是否必拍
    photo_count_min: int = 1  # 最少照片数
    photo_count_max: int = 5  # 最多照片数
    description: str = ""
    
    @classmethod
    def get_default_points(cls) -> List['InspectionPoint']:
        """获取默认检查点位"""
        return [
            InspectionPoint(
                point_name="机房",
                point_code="ROOM",
                description="机房环境、控制柜、曳引机等",
                photo_count_min=2,
                photo_count_max=5
            ),
            InspectionPoint(
                point_name="轿厢",
                point_code="CAR",
                description="轿厢内部、轿门、操纵箱等",
                photo_count_min=2,
                photo_count_max=4
            ),
            InspectionPoint(
                point_name="底坑",
                point_code="PIT",
                description="底坑环境、缓冲器、限位开关等",
                photo_count_min=2,
                photo_count_max=4
            ),
            InspectionPoint(
                point_name="安全回路",
                point_code="SAFETY",
                description="安全回路各开关、门锁等",
                photo_count_min=1,
                photo_count_max=3
            ),
        ]


@dataclass
class QualityIssue:
    """质检问题"""
    issue_id: str  # 问题ID
    issue_type: IssueType  # 问题类型
    severity: IssueSeverity  # 严重程度
    description: str  # 问题描述
    related_photo_ids: List[str] = field(default_factory=list)  # 关联照片ID
    related_work_order_id: Optional[str] = None  # 关联工单ID
    confirmed: bool = False  # 是否已人工确认
    confirmation_note: str = ""  # 确认备注
    resolved: bool = False  # 是否已解决
    created_at: datetime = field(default_factory=datetime.now)
    
    @classmethod
    def generate_id(cls) -> str:
        """生成问题ID"""
        return f"ISS_{datetime.now().strftime('%Y%m%d%H%M%S')}_{id(cls):x}"


@dataclass
class QualityReport:
    """质检报告"""
    report_id: str
    created_at: datetime = field(default_factory=datetime.now)
    work_order: Optional[WorkOrder] = None
    photos_count: int = 0
    valid_photos_count: int = 0
    issues_count: int = 0
    critical_issues_count: int = 0
    warning_issues_count: int = 0
    info_issues_count: int = 0
    issues: List[QualityIssue] = field(default_factory=list)
    points_status: Dict[str, Dict] = field(default_factory=dict)  # 各点位状态
    passed: bool = False  # 是否通过质检
    
    @classmethod
    def generate_id(cls) -> str:
        """生成报告ID"""
        return f"RPT_{datetime.now().strftime('%Y%m%d%H%M%S')}"


@dataclass
class PhotoArchive:
    """照片归档信息"""
    archive_id: str
    created_at: datetime = field(default_factory=datetime.now)
    work_order_id: str = ""
    source_directory: Path = None
    target_directory: Path = None
    archived_photos: List[Dict] = field(default_factory=list)  # 包含原路径、新路径、照片信息
    total_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    errors: List[str] = field(default_factory=list)
    
    @classmethod
    def generate_id(cls) -> str:
        """生成归档ID"""
        return f"ARC_{datetime.now().strftime('%Y%m%d%H%M%S')}"
