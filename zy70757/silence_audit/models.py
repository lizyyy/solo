from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any


@dataclass
class LabelMatcher:
    name: str
    value: str
    is_regex: bool = False


@dataclass
class Silence:
    id: str
    matchers: List[LabelMatcher]
    starts_at: datetime
    ends_at: datetime
    created_by: str
    comment: str
    status: str = "active"
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    raw_content: Optional[str] = None
    parse_error: Optional[str] = None


@dataclass
class Alert:
    labels: Dict[str, str]
    annotations: Dict[str, str] = field(default_factory=dict)
    starts_at: Optional[datetime] = None
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    raw_content: Optional[str] = None
    parse_error: Optional[str] = None


@dataclass
class ParseResult:
    valid_items: List[Any]
    invalid_items: List[Any]
    total_count: int
    valid_count: int
    invalid_count: int


@dataclass
class MatchResult:
    silence: Silence
    matched_alerts: List[Alert]
    match_details: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class RiskLevel:
    level: str
    score: int
    reason: str


RISK_LEVELS = {
    "CRITICAL": {"score": 100, "color": "red"},
    "HIGH": {"score": 75, "color": "orange"},
    "MEDIUM": {"score": 50, "color": "yellow"},
    "LOW": {"score": 25, "color": "blue"},
    "INFO": {"score": 0, "color": "green"},
}
