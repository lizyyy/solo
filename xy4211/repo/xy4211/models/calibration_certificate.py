from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class CalibrationStatus(Enum):
    VALID = "valid"
    EXPIRED = "expired"
    UNKNOWN = "unknown"


@dataclass
class CalibrationCertificate:
    certificate_id: str
    device_id: str
    calibration_date: datetime
    valid_until: Optional[datetime] = None
    issued_by: Optional[str] = None
    certificate_number: Optional[str] = None
    calibration_standard: Optional[str] = None
    technician: Optional[str] = None
    calibration_data: Dict[str, Any] = field(default_factory=dict)
    left_ear_calibration: Dict[int, Optional[float]] = field(default_factory=dict)
    right_ear_calibration: Dict[int, Optional[float]] = field(default_factory=dict)
    notes: Optional[str] = None
    import_timestamp: datetime = field(default_factory=datetime.now)
    source_file: Optional[str] = None
    raw_data: dict = field(default_factory=dict)
    
    def get_status(self, reference_date: Optional[datetime] = None) -> CalibrationStatus:
        if self.valid_until is None:
            return CalibrationStatus.UNKNOWN
        
        if reference_date is None:
            reference_date = datetime.now()
        
        if self.valid_until >= reference_date:
            return CalibrationStatus.VALID
        else:
            return CalibrationStatus.EXPIRED
    
    def get_days_remaining(self, reference_date: Optional[datetime] = None) -> Optional[int]:
        if self.valid_until is None:
            return None
        
        if reference_date is None:
            reference_date = datetime.now()
        
        delta = self.valid_until - reference_date
        return delta.days
    
    def to_dict(self) -> dict:
        return {
            "certificate_id": self.certificate_id,
            "device_id": self.device_id,
            "calibration_date": self.calibration_date.isoformat(),
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "issued_by": self.issued_by,
            "certificate_number": self.certificate_number,
            "calibration_standard": self.calibration_standard,
            "technician": self.technician,
            "calibration_data": self.calibration_data,
            "left_ear_calibration": self.left_ear_calibration,
            "right_ear_calibration": self.right_ear_calibration,
            "notes": self.notes,
            "import_timestamp": self.import_timestamp.isoformat(),
            "source_file": self.source_file
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "CalibrationCertificate":
        calibration_date = datetime.now()
        if data.get("calibration_date"):
            try:
                calibration_date = datetime.fromisoformat(data["calibration_date"])
            except (ValueError, TypeError):
                pass
        
        valid_until = None
        if data.get("valid_until"):
            try:
                valid_until = datetime.fromisoformat(data["valid_until"])
            except (ValueError, TypeError):
                pass
        
        import_timestamp = datetime.now()
        if data.get("import_timestamp"):
            try:
                import_timestamp = datetime.fromisoformat(data["import_timestamp"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            certificate_id=data.get("certificate_id", ""),
            device_id=data.get("device_id", ""),
            calibration_date=calibration_date,
            valid_until=valid_until,
            issued_by=data.get("issued_by"),
            certificate_number=data.get("certificate_number"),
            calibration_standard=data.get("calibration_standard"),
            technician=data.get("technician"),
            calibration_data=data.get("calibration_data", {}),
            left_ear_calibration=data.get("left_ear_calibration", {}),
            right_ear_calibration=data.get("right_ear_calibration", {}),
            notes=data.get("notes"),
            import_timestamp=import_timestamp,
            source_file=data.get("source_file")
        )
