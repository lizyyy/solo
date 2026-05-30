from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from datetime import datetime


class ConflictType(Enum):
    CHANNEL_DUPLICATE = "channel_duplicate"
    TIMESTAMP_MISALIGN = "timestamp_misalign"
    PART_MISSING = "part_missing"
    TRIPLE_CONFLICT = "triple_conflict"


class InfoSource(Enum):
    FILENAME = "filename"
    METADATA = "metadata"
    CHANNEL_TABLE = "channel_table"
    PART_ASSIGNMENT = "part_assignment"


@dataclass
class ConflictRecord:
    conflict_type: ConflictType
    track_indices: list[int]
    description: str
    sources: dict[str, str] = field(default_factory=dict)
    resolution: str = ""
    resolved: bool = False


@dataclass
class TrackInfo:
    file_path: str
    original_name: str
    channel_name_from_filename: str = ""
    channel_name_from_metadata: str = ""
    channel_name_from_table: str = ""
    part_from_filename: str = ""
    part_from_assignment: str = ""
    timestamp_from_filename: Optional[datetime] = None
    timestamp_from_metadata: Optional[datetime] = None
    resolved_channel_name: str = ""
    resolved_part: str = ""
    resolved_timestamp: Optional[datetime] = None
    track_index: int = -1
    sample_rate: int = 0
    channels: int = 0
    duration_seconds: float = 0.0
    new_name: str = ""
    conflicts: list[ConflictRecord] = field(default_factory=list)


@dataclass
class ChannelGroup:
    canonical_name: str
    part: str
    track_indices: list[int] = field(default_factory=list)
    duplicate_count: int = 0


@dataclass
class OrganizeResult:
    total_tracks: int = 0
    renamed_count: int = 0
    conflict_count: int = 0
    duplicate_channel_count: int = 0
    misaligned_timestamp_count: int = 0
    missing_part_count: int = 0
    tracks: list[TrackInfo] = field(default_factory=list)
    channel_groups: list[ChannelGroup] = field(default_factory=list)
    conflicts: list[ConflictRecord] = field(default_factory=list)
    timestamp_anchor: Optional[datetime] = None
