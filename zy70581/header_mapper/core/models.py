from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime


class MatchType(Enum):
    EXACT = "exact"
    SYNONYM = "synonym"
    FUZZY = "fuzzy"
    UNMATCHED = "unmatched"


@dataclass
class HeaderMatch:
    original_header: str
    original_index: int
    standard_field: Optional[str] = None
    match_type: MatchType = MatchType.UNMATCHED
    confidence: float = 0.0
    conflict: bool = False
    conflict_with: List[str] = field(default_factory=list)


@dataclass
class BadRow:
    row_index: int
    reason: str
    sample_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MappingResult:
    file_path: str
    sheet_name: str
    total_columns: int
    total_rows: int
    header_matches: List[HeaderMatch]
    bad_rows: List[BadRow]
    matched_count: int = 0
    unmatched_count: int = 0
    conflict_count: int = 0
    generated_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        self.matched_count = sum(1 for h in self.header_matches if h.match_type != MatchType.UNMATCHED)
        self.unmatched_count = sum(1 for h in self.header_matches if h.match_type == MatchType.UNMATCHED)
        self.conflict_count = sum(1 for h in self.header_matches if h.conflict)
