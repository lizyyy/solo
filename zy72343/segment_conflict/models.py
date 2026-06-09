"""数据模型定义"""
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import json


@dataclass
class Point3D:
    """3D坐标点"""
    x: float
    y: float
    z: float

    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.x, self.y, self.z)

    def to_dict(self) -> Dict[str, float]:
        return {"x": self.x, "y": self.y, "z": self.z}


@dataclass
class Segment:
    """施工线段"""
    id: int
    original_row_num: int
    name: str
    start: Point3D
    end: Point3D
    category: str
    source_type: str
    is_deleted: bool = False
    deleted_reason: Optional[str] = None
    questionnaire_row: Optional[int] = None
    remark: Optional[str] = None
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["start"] = self.start.to_dict()
        data["end"] = self.end.to_dict()
        return data


@dataclass
class Conflict:
    """线段相交冲突"""
    id: int
    segment1_id: int
    segment2_id: int
    intersection_point: Point3D
    distance: float
    conflict_type: str
    severity: str
    status: str = "pending_review"
    review_note: Optional[str] = None
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["intersection_point"] = self.intersection_point.to_dict()
        if self.reviewed_at:
            data["reviewed_at"] = self.reviewed_at.isoformat()
        return data


@dataclass
class GapRecord:
    """断档记录"""
    gap_start: int
    gap_end: int
    missing_count: int
    segment_before: Optional[int]
    segment_after: Optional[int]
    status: str = "pending_supplement"
    supplemented_rows: List[int] = field(default_factory=list)
    note: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.reviewed_at:
            data["reviewed_at"] = self.reviewed_at.isoformat()
        return data


@dataclass
class ReviewRecord:
    """人工复核记录（保留原始说法、改后值、处理原因、下一步找谁）"""
    id: int
    target_type: str
    target_id: Any
    original_status: str
    new_status: str
    reason: str
    next_owner: str
    reviewer: str
    reviewed_at: datetime
    changes: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["reviewed_at"] = self.reviewed_at.isoformat()
        return data


@dataclass
class ParameterVersion:
    """参数版本记录"""
    version: int
    segment_id: int
    kept_reason: str
    missing_materials: List[str]
    next_owner: str
    status: str
    created_at: datetime
    created_by: str
    original_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None
    change_log: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        return data


@dataclass
class Project:
    """项目"""
    name: str
    segments: List[Segment] = field(default_factory=list)
    conflicts: List[Conflict] = field(default_factory=list)
    gaps: List[GapRecord] = field(default_factory=list)
    parameter_versions: List[ParameterVersion] = field(default_factory=list)
    review_records: List[ReviewRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "segments": [s.to_dict() for s in self.segments],
            "conflicts": [c.to_dict() for c in self.conflicts],
            "gaps": [g.to_dict() for g in self.gaps],
            "parameter_versions": [p.to_dict() for p in self.parameter_versions],
            "review_records": [r.to_dict() for r in self.review_records],
        }

    def save(self, filepath: str):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)
