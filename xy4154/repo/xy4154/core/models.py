"""
数据模型定义
定义展品、扫描记录、照片等核心数据结构
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any


@dataclass
class Exhibit:
    """展品信息模型"""
    exhibit_id: str  # 展品编号（唯一标识）
    name: str  # 展品名称
    category: str = ""  # 展品类别
    location: str = ""  # 原位置
    condition: str = "完好"  # 展品状态
    is_fragile: bool = False  # 是否易碎品
    special_requirements: str = ""  # 特殊要求
    estimated_value: float = 0.0  # 预估价值
    notes: str = ""  # 备注
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "exhibit_id": self.exhibit_id,
            "name": self.name,
            "category": self.category,
            "location": self.location,
            "condition": self.condition,
            "is_fragile": self.is_fragile,
            "special_requirements": self.special_requirements,
            "estimated_value": self.estimated_value,
            "notes": self.notes
        }


@dataclass
class ScanRecord:
    """扫描记录模型"""
    scan_id: str  # 扫描记录ID
    exhibit_id: str  # 展品编号
    box_number: str  # 箱号
    scan_time: datetime  # 扫描时间
    operator: str  # 操作人员
    location: str = ""  # 扫描位置
    temperature: Optional[float] = None  # 温度记录
    humidity: Optional[float] = None  # 湿度记录
    buffer_verified: bool = False  # 缓冲材料确认
    has_signature: bool = False  # 是否有签名
    notes: str = ""  # 备注
    photo_references: List[str] = field(default_factory=list)  # 关联照片ID列表
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "exhibit_id": self.exhibit_id,
            "box_number": self.box_number,
            "scan_time": self.scan_time.isoformat() if self.scan_time else None,
            "operator": self.operator,
            "location": self.location,
            "temperature": self.temperature,
            "humidity": self.humidity,
            "buffer_verified": self.buffer_verified,
            "has_signature": self.has_signature,
            "notes": self.notes,
            "photo_references": self.photo_references
        }


@dataclass
class PhotoRecord:
    """照片记录模型"""
    photo_id: str  # 照片唯一标识（通常是文件名的哈希或完整路径）
    file_path: str  # 文件路径
    file_name: str  # 文件名
    file_size: int  # 文件大小（字节）
    capture_time: Optional[datetime] = None  # 拍摄时间（从EXIF或文件名提取）
    exhibit_references: List[str] = field(default_factory=list)  # 关联的展品编号列表
    box_references: List[str] = field(default_factory=list)  # 关联的箱号列表
    is_evidence_photo: bool = True  # 是否为证据照片
    notes: str = ""  # 备注
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "photo_id": self.photo_id,
            "file_path": self.file_path,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "capture_time": self.capture_time.isoformat() if self.capture_time else None,
            "exhibit_references": self.exhibit_references,
            "box_references": self.box_references,
            "is_evidence_photo": self.is_evidence_photo,
            "notes": self.notes
        }


@dataclass
class Anomaly:
    """异常记录模型"""
    anomaly_id: str  # 异常ID
    anomaly_type: str  # 异常类型
    severity: str  # 严重程度：critical, high, medium, low
    exhibit_id: Optional[str] = None  # 关联展品编号
    box_number: Optional[str] = None  # 关联箱号
    scan_id: Optional[str] = None  # 关联扫描记录ID
    photo_id: Optional[str] = None  # 关联照片ID
    description: str = ""  # 异常描述
    suggestion: str = ""  # 处理建议
    detected_time: datetime = field(default_factory=datetime.now)  # 检测时间
    is_resolved: bool = False  # 是否已解决
    resolved_by: Optional[str] = None  # 解决人
    resolved_time: Optional[datetime] = None  # 解决时间
    resolution_notes: str = ""  # 解决备注
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "anomaly_id": self.anomaly_id,
            "anomaly_type": self.anomaly_type,
            "severity": self.severity,
            "exhibit_id": self.exhibit_id,
            "box_number": self.box_number,
            "scan_id": self.scan_id,
            "photo_id": self.photo_id,
            "description": self.description,
            "suggestion": self.suggestion,
            "detected_time": self.detected_time.isoformat(),
            "is_resolved": self.is_resolved,
            "resolved_by": self.resolved_by,
            "resolved_time": self.resolved_time.isoformat() if self.resolved_time else None,
            "resolution_notes": self.resolution_notes
        }


@dataclass
class ReviewComment:
    """人工复核意见模型"""
    comment_id: str  # 意见ID
    anomaly_id: str  # 关联的异常ID
    reviewer: str  # 复核人
    comment: str  # 复核意见
    review_time: datetime = field(default_factory=datetime.now)  # 复核时间
    is_approved: bool = False  # 是否通过
    follow_up_required: bool = False  # 是否需要跟进
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "comment_id": self.comment_id,
            "anomaly_id": self.anomaly_id,
            "reviewer": self.reviewer,
            "comment": self.comment,
            "review_time": self.review_time.isoformat(),
            "is_approved": self.is_approved,
            "follow_up_required": self.follow_up_required
        }


@dataclass
class ProjectData:
    """项目数据集模型 - 整合所有导入的数据"""
    project_name: str = "未命名项目"
    exhibits: List[Exhibit] = field(default_factory=list)
    scan_records: List[ScanRecord] = field(default_factory=list)
    photo_records: List[PhotoRecord] = field(default_factory=list)
    anomalies: List[Anomaly] = field(default_factory=list)
    review_comments: List[ReviewComment] = field(default_factory=list)
    
    def get_exhibit_by_id(self, exhibit_id: str) -> Optional[Exhibit]:
        """根据展品编号获取展品信息"""
        for exhibit in self.exhibits:
            if exhibit.exhibit_id == exhibit_id:
                return exhibit
        return None
    
    def get_scans_by_exhibit_id(self, exhibit_id: str) -> List[ScanRecord]:
        """获取某个展品的所有扫描记录"""
        return [scan for scan in self.scan_records if scan.exhibit_id == exhibit_id]
    
    def get_scans_by_box_number(self, box_number: str) -> List[ScanRecord]:
        """获取某个箱子的所有扫描记录"""
        return [scan for scan in self.scan_records if scan.box_number == box_number]
    
    def get_photos_by_exhibit_id(self, exhibit_id: str) -> List[PhotoRecord]:
        """获取关联某个展品的所有照片"""
        return [photo for photo in self.photo_records if exhibit_id in photo.exhibit_references]
    
    def get_anomalies_by_severity(self, severity: str) -> List[Anomaly]:
        """按严重程度获取异常列表"""
        return [anomaly for anomaly in self.anomalies if anomaly.severity == severity]
    
    def get_unresolved_anomalies(self) -> List[Anomaly]:
        """获取未解决的异常列表"""
        return [anomaly for anomaly in self.anomalies if not anomaly.is_resolved]
