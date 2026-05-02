"""镜头瑕疵分拣台 - 数据模型定义"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple


class DefectType(Enum):
    MOLD = "霉斑"
    DUST = "灰尘"
    DARK_CORNER = "暗角"
    COLOR_SHIFT = "色偏"
    DEAD_PIXEL = "坏点"
    HOT_PIXEL = "热点"
    DECENTERING = "偏心"
    SCRATCH = "划痕"
    UNKNOWN = "未知"


class InspectionStatus(Enum):
    PENDING = "待检测"
    PROCESSING = "处理中"
    COMPLETED = "检测完成"
    HUMAN_CONFIRMED = "人工确认"
    FLAGGED = "需复检"


@dataclass
class ImageFeatures:
    image_id: str
    file_path: str
    sharpness: float = 0.0
    sharpness_score: float = 0.0
    dark_corner_score: float = 0.0
    color_shift_r: float = 0.0
    color_shift_g: float = 0.0
    color_shift_b: float = 0.0
    color_shift_score: float = 0.0
    dead_pixel_count: int = 0
    dead_pixel_heatmap: List[Tuple[int, int, float]] = field(default_factory=list)
    hot_pixel_count: int = 0
    hot_pixel_heatmap: List[Tuple[int, int, float]] = field(default_factory=list)
    brightness_mean: float = 0.0
    brightness_std: float = 0.0
    contrast: float = 0.0
    noise_level: float = 0.0
    edge_intensity: float = 0.0
    extracted_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["extracted_at"] = self.extracted_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImageFeatures":
        data = data.copy()
        if "extracted_at" in data and isinstance(data["extracted_at"], str):
            data["extracted_at"] = datetime.fromisoformat(data["extracted_at"])
        return cls(**data)


@dataclass
class LensNote:
    lens_id: str
    body_id: Optional[str]
    notes: str = ""
    inspector: str = ""
    received_date: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.received_date:
            data["received_date"] = self.received_date.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LensNote":
        data = data.copy()
        if "received_date" in data and isinstance(data["received_date"], str):
            data["received_date"] = datetime.fromisoformat(data["received_date"])
        return cls(**data)


@dataclass
class DefectDetection:
    defect_id: str
    defect_type: DefectType
    confidence: float
    location: Tuple[int, int] = (0, 0)
    area: float = 0.0
    severity: str = "低"
    image_id: str = ""
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["defect_type"] = self.defect_type.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DefectDetection":
        data = data.copy()
        if "defect_type" in data and isinstance(data["defect_type"], str):
            try:
                data["defect_type"] = DefectType(data["defect_type"])
            except ValueError:
                data["defect_type"] = DefectType.UNKNOWN
        return cls(**data)


@dataclass
class LensInspection:
    lens_id: str
    images: List[str] = field(default_factory=list)
    image_features: Dict[str, ImageFeatures] = field(default_factory=dict)
    defects: List[DefectDetection] = field(default_factory=list)
    anomaly_score: float = 0.0
    anomaly_score_breakdown: Dict[str, float] = field(default_factory=dict)
    cluster_id: Optional[int] = None
    cluster_label: str = ""
    similar_defects: List[str] = field(default_factory=list)
    status: InspectionStatus = InspectionStatus.PENDING
    human_verified: bool = False
    human_notes: str = ""
    note: Optional[LensNote] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        data["created_at"] = self.created_at.isoformat()
        data["updated_at"] = self.updated_at.isoformat()
        data["image_features"] = {
            k: v.to_dict() for k, v in self.image_features.items()
        }
        data["defects"] = [d.to_dict() for d in self.defects]
        if self.note:
            data["note"] = self.note.to_dict()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LensInspection":
        data = data.copy()
        if "status" in data and isinstance(data["status"], str):
            try:
                data["status"] = InspectionStatus(data["status"])
            except ValueError:
                data["status"] = InspectionStatus.PENDING
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "updated_at" in data and isinstance(data["updated_at"], str):
            data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        if "image_features" in data:
            data["image_features"] = {
                k: ImageFeatures.from_dict(v)
                for k, v in data["image_features"].items()
            }
        if "defects" in data:
            data["defects"] = [
                DefectDetection.from_dict(d) for d in data["defects"]
            ]
        if "note" in data and data["note"]:
            data["note"] = LensNote.from_dict(data["note"])
        return cls(**data)


@dataclass
class SessionState:
    session_id: str
    inspection_dir: str
    notes_csv: str = ""
    inspections: Dict[str, LensInspection] = field(default_factory=dict)
    clusters: Dict[int, List[str]] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        data["updated_at"] = self.updated_at.isoformat()
        data["inspections"] = {
            k: v.to_dict() for k, v in self.inspections.items()
        }
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionState":
        data = data.copy()
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "updated_at" in data and isinstance(data["updated_at"], str):
            data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        if "inspections" in data:
            data["inspections"] = {
                k: LensInspection.from_dict(v)
                for k, v in data["inspections"].items()
            }
        return cls(**data)
