from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import date
from enum import Enum
import uuid


class RightType(Enum):
    LYRIC = "词曲"
    RECORDING = "录音"
    DISTRIBUTION = "发行"


class Platform(Enum):
    NETEASE = "网易云"
    QQ = "QQ音乐"
    KUGOU = "酷狗"
    SPOTIFY = "Spotify"
    APPLE = "Apple Music"


@dataclass
class RightsHolder:
    id: str
    name: str
    type: str


@dataclass
class Track:
    id: str
    title: str
    artist: str
    isrc: Optional[str] = None


@dataclass
class Contract:
    id: str
    track_id: str
    version: str
    effective_date: date
    expiry_date: Optional[date] = None
    is_active: bool = True


@dataclass
class RoyaltySplit:
    id: str
    contract_id: str
    track_id: str
    right_type: RightType
    rights_holder_id: str
    platform: Optional[Platform]
    split_ratio: float
    source_ref: str


@dataclass
class PlatformDeduction:
    id: str
    track_id: str
    platform: Platform
    deduction_type: str
    deduction_ratio: float
    source_ref: str


@dataclass
class ValidationIssue:
    level: str
    category: str
    message: str
    evidence: List[Dict]
    track_id: Optional[str] = None
    contract_id: Optional[str] = None
    right_type: Optional[str] = None
    platform: Optional[str] = None


@dataclass
class MatrixRow:
    track_title: str
    track_id: str
    right_type: str
    rights_holder: str
    platform: str
    split_ratio: float
    contract_version: str
    source_ref: str
    normalized_ratio: Optional[float] = None


@dataclass
class ValidationResult:
    is_valid: bool
    issues: List[ValidationIssue]
    matrix: List[MatrixRow]
    summary: Dict
