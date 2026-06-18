"""核心数据模型定义."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict


class RecordStatus(str, Enum):
    CONFIRMED = "已确认"
    PENDING = "待补件"
    RETURNED = "退回"


@dataclass
class CoordinateIssue:
    """经纬度问题记录."""
    issue_type: str
    description: str
    source_line: int
    raw_value: str


@dataclass
class SamplingRecord:
    """单条深海采样记录."""
    record_id: str
    source_file: str
    source_line: int
    raw_content: str

    station_name: Optional[str] = None
    sample_time: Optional[str] = None
    raw_latitude: Optional[str] = None
    raw_longitude: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    depth: Optional[float] = None
    temperature: Optional[float] = None
    salinity: Optional[float] = None

    coordinate_issues: List[CoordinateIssue] = field(default_factory=list)
    lat_lon_reversed: bool = False

    status: RecordStatus = RecordStatus.PENDING
    notes: str = ""
    screenshot_note: str = ""

    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "source_file": self.source_file,
            "source_line": self.source_line,
            "raw_content": self.raw_content,
            "station_name": self.station_name,
            "sample_time": self.sample_time,
            "raw_latitude": self.raw_latitude,
            "raw_longitude": self.raw_longitude,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "depth": self.depth,
            "temperature": self.temperature,
            "salinity": self.salinity,
            "lat_lon_reversed": self.lat_lon_reversed,
            "coordinate_issues": [
                {"issue_type": i.issue_type, "description": i.description,
                 "source_line": i.source_line, "raw_value": i.raw_value}
                for i in self.coordinate_issues
            ],
            "status": self.status.value,
            "notes": self.notes,
            "screenshot_note": self.screenshot_note,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "SamplingRecord":
        issues = [
            CoordinateIssue(
                issue_type=i["issue_type"],
                description=i["description"],
                source_line=i["source_line"],
                raw_value=i["raw_value"],
            )
            for i in data.get("coordinate_issues", [])
        ]
        return cls(
            record_id=data["record_id"],
            source_file=data["source_file"],
            source_line=data["source_line"],
            raw_content=data["raw_content"],
            station_name=data.get("station_name"),
            sample_time=data.get("sample_time"),
            raw_latitude=data.get("raw_latitude"),
            raw_longitude=data.get("raw_longitude"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            depth=data.get("depth"),
            temperature=data.get("temperature"),
            salinity=data.get("salinity"),
            coordinate_issues=issues,
            lat_lon_reversed=data.get("lat_lon_reversed", False),
            status=RecordStatus(data.get("status", "待补件")),
            notes=data.get("notes", ""),
            screenshot_note=data.get("screenshot_note", ""),
        )
