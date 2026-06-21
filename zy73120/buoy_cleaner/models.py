from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict


@dataclass
class BuoyRecord:
    record_id: str
    sample_bottle_no: str
    latitude_raw: str
    longitude_raw: str
    latitude_std: Optional[float] = None
    longitude_std: Optional[float] = None
    latitude_suggested: Optional[float] = None
    longitude_suggested: Optional[float] = None
    water_temp: Optional[float] = None
    wave_height: Optional[float] = None
    wind_speed: Optional[float] = None
    collect_time: Optional[datetime] = None
    is_duplicate: bool = False
    duplicate_reason: Optional[str] = None
    needs_confirmation: bool = False
    confirmation_reason: Optional[str] = None
    is_confirmed: bool = False
    manual_note: Optional[str] = None
    source_file: Optional[str] = None
    import_time: Optional[datetime] = None
    lat_lon_format: Optional[str] = None

    def unique_key(self) -> str:
        return f"{self.sample_bottle_no}_{self.collect_time.strftime('%Y%m%d%H%M')}" if self.collect_time else self.sample_bottle_no


@dataclass
class DuplicateGroup:
    sample_bottle_no: str
    records: List[BuoyRecord] = field(default_factory=list)
    reason: str = ""
    affected_count: int = 0


@dataclass
class AuditLogEntry:
    timestamp: datetime
    record_id: str
    sample_bottle_no: str
    field_name: str
    old_value: str
    new_value: str
    operator: str
    reason: str


@dataclass
class CleanResult:
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    duplicate_groups: List[DuplicateGroup] = field(default_factory=list)
    pending_confirmation: List[BuoyRecord] = field(default_factory=list)
    records: List[BuoyRecord] = field(default_factory=list)
    filter_criteria: Dict[str, str] = field(default_factory=dict)
