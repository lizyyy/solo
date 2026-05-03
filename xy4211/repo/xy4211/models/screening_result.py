from dataclasses import dataclass, field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum


class EarSide(Enum):
    LEFT = "left"
    RIGHT = "right"
    BOTH = "both"


class ScreeningStatus(Enum):
    NORMAL = "normal"
    REFER = "refer"
    INVALID = "invalid"
    INCOMPLETE = "incomplete"


@dataclass
class ThresholdData:
    frequency: int
    threshold: Optional[int] = None
    ear_side: Optional[EarSide] = None
    is_valid: bool = True
    notes: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "frequency": self.frequency,
            "threshold": self.threshold,
            "ear_side": self.ear_side.value if self.ear_side else None,
            "is_valid": self.is_valid,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ThresholdData":
        ear_side = None
        if data.get("ear_side"):
            try:
                ear_side = EarSide(data["ear_side"])
            except ValueError:
                pass
        
        return cls(
            frequency=data.get("frequency", 0),
            threshold=data.get("threshold"),
            ear_side=ear_side,
            is_valid=data.get("is_valid", True),
            notes=data.get("notes")
        )


@dataclass
class ScreeningResult:
    screening_id: str
    student_id: str
    device_id: Optional[str] = None
    screening_date: Optional[datetime] = None
    status: ScreeningStatus = ScreeningStatus.NORMAL
    left_ear_thresholds: Dict[int, Optional[int]] = field(default_factory=dict)
    right_ear_thresholds: Dict[int, Optional[int]] = field(default_factory=dict)
    left_ear_status: Optional[ScreeningStatus] = None
    right_ear_status: Optional[ScreeningStatus] = None
    tester: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    import_timestamp: datetime = field(default_factory=datetime.now)
    source_file: Optional[str] = None
    raw_data: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "screening_id": self.screening_id,
            "student_id": self.student_id,
            "device_id": self.device_id,
            "screening_date": self.screening_date.isoformat() if self.screening_date else None,
            "status": self.status.value,
            "left_ear_thresholds": self.left_ear_thresholds,
            "right_ear_thresholds": self.right_ear_thresholds,
            "left_ear_status": self.left_ear_status.value if self.left_ear_status else None,
            "right_ear_status": self.right_ear_status.value if self.right_ear_status else None,
            "tester": self.tester,
            "location": self.location,
            "notes": self.notes,
            "import_timestamp": self.import_timestamp.isoformat(),
            "source_file": self.source_file
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ScreeningResult":
        screening_date = None
        if data.get("screening_date"):
            try:
                screening_date = datetime.fromisoformat(data["screening_date"])
            except (ValueError, TypeError):
                pass
        
        import_timestamp = datetime.now()
        if data.get("import_timestamp"):
            try:
                import_timestamp = datetime.fromisoformat(data["import_timestamp"])
            except (ValueError, TypeError):
                pass
        
        status = ScreeningStatus.NORMAL
        if data.get("status"):
            try:
                status = ScreeningStatus(data["status"])
            except ValueError:
                pass
        
        left_ear_status = None
        if data.get("left_ear_status"):
            try:
                left_ear_status = ScreeningStatus(data["left_ear_status"])
            except ValueError:
                pass
        
        right_ear_status = None
        if data.get("right_ear_status"):
            try:
                right_ear_status = ScreeningStatus(data["right_ear_status"])
            except ValueError:
                pass
        
        return cls(
            screening_id=data.get("screening_id", ""),
            student_id=data.get("student_id", ""),
            device_id=data.get("device_id"),
            screening_date=screening_date,
            status=status,
            left_ear_thresholds=data.get("left_ear_thresholds", {}),
            right_ear_thresholds=data.get("right_ear_thresholds", {}),
            left_ear_status=left_ear_status,
            right_ear_status=right_ear_status,
            tester=data.get("tester"),
            location=data.get("location"),
            notes=data.get("notes"),
            import_timestamp=import_timestamp,
            source_file=data.get("source_file")
        )
    
    def get_left_ear_max_threshold(self) -> Optional[int]:
        valid_thresholds = [v for v in self.left_ear_thresholds.values() if v is not None]
        return max(valid_thresholds) if valid_thresholds else None
    
    def get_right_ear_max_threshold(self) -> Optional[int]:
        valid_thresholds = [v for v in self.right_ear_thresholds.values() if v is not None]
        return max(valid_thresholds) if valid_thresholds else None
