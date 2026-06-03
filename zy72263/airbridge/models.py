import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List


@dataclass
class CoordinateOrigin:
    id: str
    name: str
    x: float
    y: float
    z: float = 0.0
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    version: int = 1

    def get_hash(self) -> str:
        data = {
            "id": self.id,
            "name": self.name,
            "x": self.x,
            "y": self.y,
            "z": self.z,
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "description": self.description,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "version": self.version,
        }


@dataclass
class InspectionPhoto:
    id: str
    photo_number: str
    coordinate_origin_id: str
    url: str = ""
    remark: str = ""
    has_mobile_screenshot: bool = False
    alert_label_visible: bool = True
    alert_label_area: Optional[Dict[str, float]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def is_alert_label_blocked(self) -> bool:
        return self.has_mobile_screenshot and not self.alert_label_visible

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "photo_number": self.photo_number,
            "coordinate_origin_id": self.coordinate_origin_id,
            "url": self.url,
            "remark": self.remark,
            "has_mobile_screenshot": self.has_mobile_screenshot,
            "alert_label_visible": self.alert_label_visible,
            "alert_label_area": self.alert_label_area,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class PreflightRecord:
    id: str
    coordinate_origin_id: str
    status: str = "pending"
    review_status: str = "pending"
    block_detected: bool = False
    block_verified: Optional[bool] = None
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: str = ""
    history: List[Dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_history_entry(self, action: str, actor: str, details: Dict[str, Any]):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "actor": actor,
            "details": details,
        }
        self.history.append(entry)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "coordinate_origin_id": self.coordinate_origin_id,
            "status": self.status,
            "review_status": self.review_status,
            "block_detected": self.block_detected,
            "block_verified": self.block_verified,
            "reviewer": self.reviewer,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "review_comment": self.review_comment,
            "history": self.history,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
