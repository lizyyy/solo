from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class Finding:
    file_path: Path
    field_path: str
    line: int
    column: int
    value: str
    pattern_name: str
    risk_level: str
    description: str
    raw_line: Optional[str] = None


@dataclass
class ParseError:
    file_path: Path
    line: int
    column: int
    message: str
    raw_line: Optional[str] = None


@dataclass
class FileResult:
    file_path: Path
    findings: List[Finding]
    errors: List[ParseError]
    scanned: bool = True


@dataclass
class ScanResult:
    files: List[FileResult]
    total_files: int
    total_findings: int
    total_errors: int
