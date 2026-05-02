import hashlib
import os
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


class FileType(Enum):
    PHOTO = "photo"
    GPX = "gpx"
    CSV = "csv"
    JSON = "json"
    UNKNOWN = "unknown"


@dataclass
class ParsedMetadata:
    file_path: str
    file_name: str
    file_size: int
    file_type: FileType
    source_package: str
    hash_sha256: str
    hash_md5: str
    last_modified: datetime
    created_at: Optional[datetime] = None
    coordinate_system: str = "WGS84"
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "file_type": self.file_type.value,
            "source_package": self.source_package,
            "hash_sha256": self.hash_sha256,
            "hash_md5": self.hash_md5,
            "last_modified": self.last_modified.isoformat(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "coordinate_system": self.coordinate_system,
            "errors": self.errors,
            "warnings": self.warnings,
        }


@dataclass
class TrackPoint:
    lat: float
    lon: float
    elevation: Optional[float] = None
    timestamp: Optional[datetime] = None
    speed: Optional[float] = None
    course: Optional[float] = None


@dataclass
class WayPoint:
    name: str
    lat: float
    lon: float
    elevation: Optional[float] = None
    timestamp: Optional[datetime] = None
    description: Optional[str] = None
    symbol: Optional[str] = None


@dataclass
class TrackSegment:
    points: List[TrackPoint] = field(default_factory=list)


@dataclass
class Track:
    name: str
    segments: List[TrackSegment] = field(default_factory=list)
    description: Optional[str] = None


@dataclass
class PointData:
    point_id: str
    lat: float
    lon: float
    elevation: Optional[float] = None
    timestamp: Optional[datetime] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    attachments: List[str] = field(default_factory=list)
    coordinate_system: str = "WGS84"


@dataclass
class ParseResult:
    metadata: ParsedMetadata
    tracks: List[Track] = field(default_factory=list)
    waypoints: List[WayPoint] = field(default_factory=list)
    points: List[PointData] = field(default_factory=list)
    json_data: Optional[Dict[str, Any]] = None
    photo_metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metadata": self.metadata.to_dict(),
            "tracks": [
                {
                    "name": t.name,
                    "description": t.description,
                    "segments": [
                        {
                            "points": [
                                {
                                    "lat": p.lat,
                                    "lon": p.lon,
                                    "elevation": p.elevation,
                                    "timestamp": p.timestamp.isoformat() if p.timestamp else None,
                                    "speed": p.speed,
                                    "course": p.course,
                                }
                                for p in s.points
                            ]
                        }
                        for s in t.segments
                    ],
                }
                for t in self.tracks
            ],
            "waypoints": [
                {
                    "name": w.name,
                    "lat": w.lat,
                    "lon": w.lon,
                    "elevation": w.elevation,
                    "timestamp": w.timestamp.isoformat() if w.timestamp else None,
                    "description": w.description,
                    "symbol": w.symbol,
                }
                for w in self.waypoints
            ],
            "points": [
                {
                    "point_id": p.point_id,
                    "lat": p.lat,
                    "lon": p.lon,
                    "elevation": p.elevation,
                    "timestamp": p.timestamp.isoformat() if p.timestamp else None,
                    "attributes": p.attributes,
                    "attachments": p.attachments,
                    "coordinate_system": p.coordinate_system,
                }
                for p in self.points
            ],
            "json_data": self.json_data,
            "photo_metadata": self.photo_metadata,
        }


class BaseParser:
    SUPPORTED_EXTENSIONS: List[str] = []

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def can_parse(self, file_path: str) -> bool:
        ext = Path(file_path).suffix.lower().lstrip(".")
        return ext in [e.lower().lstrip(".") for e in self.SUPPORTED_EXTENSIONS]

    def parse(self, file_path: str, source_package: str) -> ParseResult:
        raise NotImplementedError("Subclasses must implement parse method")

    def _calculate_hashes(self, file_path: str) -> tuple:
        sha256_hash = hashlib.sha256()
        md5_hash = hashlib.md5()

        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
                md5_hash.update(byte_block)

        return sha256_hash.hexdigest(), md5_hash.hexdigest()

    def _get_file_metadata(
        self,
        file_path: str,
        source_package: str,
        file_type: FileType,
    ) -> ParsedMetadata:
        stat = os.stat(file_path)
        sha256, md5 = self._calculate_hashes(file_path)

        return ParsedMetadata(
            file_path=file_path,
            file_name=os.path.basename(file_path),
            file_size=stat.st_size,
            file_type=file_type,
            source_package=source_package,
            hash_sha256=sha256,
            hash_md5=md5,
            last_modified=datetime.fromtimestamp(stat.st_mtime),
            created_at=datetime.fromtimestamp(stat.st_birthtime)
            if hasattr(stat, "st_birthtime")
            else None,
            errors=self.errors.copy(),
            warnings=self.warnings.copy(),
        )

    def add_error(self, message: str) -> None:
        self.errors.append(message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def clear_errors(self) -> None:
        self.errors = []
        self.warnings = []
