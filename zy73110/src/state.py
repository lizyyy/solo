import os
import json
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from datetime import datetime


STATUS_PENDING = "pending"
STATUS_REVIEWING = "reviewing"
STATUS_SUSPENDED = "suspended"
STATUS_CONFIRMED = "confirmed"
STATUS_COMPLETED = "completed"

STATUS_LABELS = {
    "pending": "待复核",
    "reviewing": "复核中",
    "suspended": "挂起",
    "confirmed": "已确认",
    "completed": "已完成",
}


@dataclass
class MaterialState:
    material_id: str
    material_type: str
    current_version: int = 0
    latest_batch: int = 0
    status: str = STATUS_PENDING
    signature: str = ""
    title: str = ""
    related_to: str = ""
    history: List[Dict[str, Any]] = field(default_factory=list)
    remarks: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MaterialState":
        return cls(**d)


@dataclass
class ReviewState:
    project_name: str = "施工变更图纸复核"
    overall_status: str = STATUS_PENDING
    current_batch: int = 0
    materials: Dict[str, MaterialState] = field(default_factory=dict)
    suspension_reasons: List[str] = field(default_factory=list)
    last_run_time: str = ""
    run_count: int = 0
    csv_export_time: str = ""
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["materials"] = {k: v.to_dict() for k, v in self.materials.items()}
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ReviewState":
        materials = {}
        for k, v in d.get("materials", {}).items():
            materials[k] = MaterialState.from_dict(v)
        d = {**d, "materials": materials}
        return cls(**d)


def load_state(state_file: str) -> ReviewState:
    if not os.path.isfile(state_file):
        return ReviewState()
    with open(state_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    return ReviewState.from_dict(data)


def save_state(state: ReviewState, state_file: str) -> None:
    os.makedirs(os.path.dirname(state_file), exist_ok=True)
    state.last_run_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)
