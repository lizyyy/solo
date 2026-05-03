from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime


@dataclass
class Device:
    device_id: str
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    last_calibration_date: Optional[datetime] = None
    import_timestamp: datetime = field(default_factory=datetime.now)
    source_file: Optional[str] = None
    raw_data: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "device_name": self.device_name,
            "device_model": self.device_model,
            "serial_number": self.serial_number,
            "manufacturer": self.manufacturer,
            "last_calibration_date": self.last_calibration_date.isoformat() if self.last_calibration_date else None,
            "import_timestamp": self.import_timestamp.isoformat(),
            "source_file": self.source_file
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "Device":
        last_calibration = None
        if data.get("last_calibration_date"):
            try:
                last_calibration = datetime.fromisoformat(data["last_calibration_date"])
            except (ValueError, TypeError):
                pass
        
        import_timestamp = datetime.now()
        if data.get("import_timestamp"):
            try:
                import_timestamp = datetime.fromisoformat(data["import_timestamp"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            device_id=data.get("device_id", ""),
            device_name=data.get("device_name"),
            device_model=data.get("device_model"),
            serial_number=data.get("serial_number"),
            manufacturer=data.get("manufacturer"),
            last_calibration_date=last_calibration,
            import_timestamp=import_timestamp,
            source_file=data.get("source_file")
        )
