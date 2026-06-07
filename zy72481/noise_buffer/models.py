from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime
import uuid
import json


@dataclass
class SamplePoint:
    id: str
    location_id: str
    location_name: str
    x: float
    y: float
    time_slot: str
    noise_level: float
    is_night: bool
    source: str
    complaint_id: Optional[str] = None
    status: str = "normal"
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ComplaintRecord:
    id: str
    complaint_no: str
    location_id: str
    location_name: str
    noise_level: float
    reported_at: str
    description: str
    source_caliber: str = "resident_report"
    linked_sample_id: Optional[str] = None
    status: str = "pending"


@dataclass
class HeatmapCell:
    x: float
    y: float
    noise_level: float
    sample_count: int
    is_low_confidence: bool
    reason: str = ""


@dataclass
class CorrectionRecord:
    id: str
    sample_id: str
    old_noise_level: float
    new_noise_level: float
    old_status: str
    new_status: str
    operator: str
    reason: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ProjectData:
    samples: List[SamplePoint] = field(default_factory=list)
    complaints: List[ComplaintRecord] = field(default_factory=list)
    corrections: List[CorrectionRecord] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "samples": [s.__dict__ for s in self.samples],
            "complaints": [c.__dict__ for c in self.complaints],
            "corrections": [c.__dict__ for c in self.corrections],
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "ProjectData":
        samples = [SamplePoint(**s) for s in data.get("samples", [])]
        complaints = [ComplaintRecord(**c) for c in data.get("complaints", [])]
        corrections = [CorrectionRecord(**c) for c in data.get("corrections", [])]
        return cls(samples=samples, complaints=complaints, corrections=corrections)

    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, path: str) -> "ProjectData":
        with open(path, "r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))
