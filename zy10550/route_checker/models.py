from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class MatchType(Enum):
    EXACT = "exact"
    PREFIX = "prefix"
    REGEX = "regex"


class RouteSource(Enum):
    YAML = "yaml"
    JSON = "json"
    NGINX = "nginx"
    UNKNOWN = "unknown"


@dataclass
class RouteRule:
    path: str
    upstream: str
    match_type: MatchType = MatchType.PREFIX
    priority: int = 0
    methods: List[str] = field(default_factory=lambda: ["GET", "POST", "PUT", "DELETE"])
    headers: Dict[str, str] = field(default_factory=dict)
    source_file: str = ""
    line_number: int = 0
    raw_content: str = ""


@dataclass
class RequestSample:
    path: str
    method: str = "GET"
    headers: Dict[str, str] = field(default_factory=dict)
    source_file: str = ""
    line_number: int = 0
    raw_content: str = ""


@dataclass
class MatchResult:
    request: RequestSample
    matched_route: Optional[RouteRule] = None
    candidate_routes: List[RouteRule] = field(default_factory=list)
    is_matched: bool = False
    match_reason: str = ""


@dataclass
class BadLine:
    source_file: str
    line_number: int
    raw_content: str
    error_message: str
    error_type: str


@dataclass
class CheckResult:
    routes: List[RouteRule] = field(default_factory=list)
    requests: List[RequestSample] = field(default_factory=list)
    match_results: List[MatchResult] = field(default_factory=list)
    unmatched_requests: List[RequestSample] = field(default_factory=list)
    bad_lines: List[BadLine] = field(default_factory=list)
    upstream_stats: Dict[str, int] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
