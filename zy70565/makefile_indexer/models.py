from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional


@dataclass
class MakefileTarget:
    name: str
    dependencies: List[str] = field(default_factory=list)
    comments: List[str] = field(default_factory=list)
    recipe: List[str] = field(default_factory=list)
    line_number: int = 0
    has_side_effect: bool = False
    side_effect_reason: str = ""
    expanded_deps: List[str] = field(default_factory=list)


@dataclass
class BadLine:
    line_number: int
    content: str
    reason: str
    error_type: str


@dataclass
class ParseResult:
    targets: Dict[str, MakefileTarget] = field(default_factory=dict)
    bad_lines: List[BadLine] = field(default_factory=list)
    variables: Dict[str, str] = field(default_factory=dict)
    includes: List[str] = field(default_factory=list)
    phony_targets: Set[str] = field(default_factory=set)


@dataclass
class IndexReport:
    total_targets: int = 0
    safe_targets: List[str] = field(default_factory=list)
    risky_targets: List[str] = field(default_factory=list)
    bad_lines_count: int = 0
    parse_result: ParseResult = None
