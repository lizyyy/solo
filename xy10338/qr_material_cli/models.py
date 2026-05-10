from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class MaterialType(Enum):
    TRUSS = "桁架"
    LIGHTING = "灯具"
    FURNITURE = "桌椅"


class RecordSource(Enum):
    SCAN = "扫码"
    OFFLINE = "离线补录"


class RecordStatus(Enum):
    ACTIVE = "有效"
    DUPLICATE = "重复"
    OVER_RETURN = "归还超额"
    SKIPPED = "跳过"


@dataclass
class Material:
    qr_code: str
    name: str
    material_type: MaterialType
    specification: str
    initial_quantity: int
    project: str
    location: str = ""
    remarks: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "二维码编号": self.qr_code,
            "物料名称": self.name,
            "物料类型": self.material_type.value,
            "规格型号": self.specification,
            "初始数量": self.initial_quantity,
            "展会项目": self.project,
            "存放位置": self.location,
            "备注": self.remarks,
        }


@dataclass
class ScanRecord:
    qr_code: str
    scan_time: datetime
    receiver: str
    receiver_department: str
    project: str
    source: RecordSource = RecordSource.SCAN
    quantity: int = 1
    status: RecordStatus = RecordStatus.ACTIVE
    skip_reason: str = ""
    original_record: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "二维码编号": self.qr_code,
            "扫码时间": self.scan_time.strftime("%Y-%m-%d %H:%M:%S"),
            "领用人": self.receiver,
            "领用部门": self.receiver_department,
            "展会项目": self.project,
            "来源": self.source.value,
            "领用数量": self.quantity,
            "状态": self.status.value,
            "跳过原因": self.skip_reason,
        }


@dataclass
class ReturnRecord:
    qr_code: str
    return_time: datetime
    returner: str
    return_department: str
    project: str
    quantity: int = 1
    status: RecordStatus = RecordStatus.ACTIVE
    skip_reason: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "二维码编号": self.qr_code,
            "归还时间": self.return_time.strftime("%Y-%m-%d %H:%M:%S"),
            "归还人": self.returner,
            "归还部门": self.return_department,
            "展会项目": self.project,
            "归还数量": self.quantity,
            "状态": self.status.value,
            "跳过原因": self.skip_reason,
        }


@dataclass
class MaterialUsage:
    qr_code: str
    material: Material
    scan_records: List[ScanRecord] = field(default_factory=list)
    return_records: List[ReturnRecord] = field(default_factory=list)
    
    @property
    def total_received(self) -> int:
        return sum(r.quantity for r in self.scan_records if r.status == RecordStatus.ACTIVE)
    
    @property
    def total_returned(self) -> int:
        return sum(r.quantity for r in self.return_records if r.status == RecordStatus.ACTIVE)
    
    @property
    def remaining(self) -> int:
        return self.material.initial_quantity - self.total_received + self.total_returned
    
    @property
    def deficit(self) -> int:
        return max(0, self.total_received - self.total_returned)
    
    @property
    def has_deficit(self) -> bool:
        return self.deficit > 0
    
    def get_active_scan_records(self) -> List[ScanRecord]:
        return [r for r in self.scan_records if r.status == RecordStatus.ACTIVE]
    
    def get_active_return_records(self) -> List[ReturnRecord]:
        return [r for r in self.return_records if r.status == RecordStatus.ACTIVE]


@dataclass
class ProjectReport:
    project: str
    materials: Dict[str, MaterialUsage] = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)
    
    @property
    def total_deficit(self) -> int:
        return sum(m.deficit for m in self.materials.values())
    
    @property
    def has_issues(self) -> bool:
        return len(self.issues) > 0 or self.total_deficit > 0
