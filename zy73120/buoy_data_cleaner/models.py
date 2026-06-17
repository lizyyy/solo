from dataclasses import dataclass, field, asdict
from typing import Optional, List
from datetime import datetime
import uuid
import csv
import io


@dataclass
class BuoyRecord:
    record_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    buoy_id: str = ""
    sample_bottle_id: str = ""
    timestamp: str = ""
    latitude_raw: str = ""
    longitude_raw: str = ""
    latitude_std: Optional[float] = None
    longitude_std: Optional[float] = None
    sea_state: str = ""
    wave_height: str = ""
    water_temp: str = ""
    source_file: str = ""
    is_late_arrival: bool = False
    status: str = "pending"
    manual_note: str = ""
    import_batch: str = ""
    imported_at: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    def to_row(self) -> dict:
        return {
            "record_id": self.record_id,
            "buoy_id": self.buoy_id,
            "sample_bottle_id": self.sample_bottle_id,
            "timestamp": self.timestamp,
            "latitude_raw": self.latitude_raw,
            "longitude_raw": self.longitude_raw,
            "latitude_std": ("" if self.latitude_std is None else f"{self.latitude_std:.6f}"),
            "longitude_std": ("" if self.longitude_std is None else f"{self.longitude_std:.6f}"),
            "sea_state": self.sea_state,
            "wave_height": self.wave_height,
            "water_temp": self.water_temp,
            "source_file": self.source_file,
            "is_late_arrival": ("是" if self.is_late_arrival else "否"),
            "status": self.status,
            "manual_note": self.manual_note,
            "import_batch": self.import_batch,
            "imported_at": self.imported_at,
        }

    @classmethod
    def fieldnames(cls) -> List[str]:
        return [
            "record_id", "buoy_id", "sample_bottle_id", "timestamp",
            "latitude_raw", "longitude_raw", "latitude_std", "longitude_std",
            "sea_state", "wave_height", "water_temp",
            "source_file", "is_late_arrival", "status", "manual_note",
            "import_batch", "imported_at",
        ]

    @classmethod
    def from_row(cls, row: dict) -> "BuoyRecord":
        lat = row.get("latitude_std", "")
        lon = row.get("longitude_std", "")
        return cls(
            record_id=row.get("record_id", uuid.uuid4().hex[:12]),
            buoy_id=row.get("buoy_id", ""),
            sample_bottle_id=row.get("sample_bottle_id", ""),
            timestamp=row.get("timestamp", ""),
            latitude_raw=row.get("latitude_raw", ""),
            longitude_raw=row.get("longitude_raw", ""),
            latitude_std=(None if lat in ("", None) else float(lat)),
            longitude_std=(None if lon in ("", None) else float(lon)),
            sea_state=row.get("sea_state", ""),
            wave_height=row.get("wave_height", ""),
            water_temp=row.get("water_temp", ""),
            source_file=row.get("source_file", ""),
            is_late_arrival=(row.get("is_late_arrival", "") == "是"),
            status=row.get("status", "pending"),
            manual_note=row.get("manual_note", ""),
            import_batch=row.get("import_batch", ""),
            imported_at=row.get("imported_at", datetime.now().isoformat(timespec="seconds")),
        )


@dataclass
class AuditLog:
    log_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    record_id: str = ""
    field_name: str = ""
    old_value: str = ""
    new_value: str = ""
    reason: str = ""
    operator: str = ""
    changed_at: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    def to_row(self) -> dict:
        return asdict(self)

    @classmethod
    def fieldnames(cls) -> List[str]:
        return ["log_id", "record_id", "field_name", "old_value", "new_value", "reason", "operator", "changed_at"]

    @classmethod
    def from_row(cls, row: dict) -> "AuditLog":
        return cls(**row)


@dataclass
class DuplicateIssue:
    sample_bottle_id: str
    affected_records: List[str]
    reason: str = ""

    def to_row(self) -> dict:
        return {
            "sample_bottle_id": self.sample_bottle_id,
            "affected_record_ids": ",".join(self.affected_records),
            "affected_count": len(self.affected_records),
            "reason": self.reason,
        }

    @classmethod
    def fieldnames(cls) -> List[str]:
        return ["sample_bottle_id", "affected_record_ids", "affected_count", "reason"]
