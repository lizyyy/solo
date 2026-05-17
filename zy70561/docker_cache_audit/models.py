from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional


class CacheStatus(Enum):
    HIT = "HIT"
    MISS = "MISS"
    UNKNOWN = "UNKNOWN"


class ChangeType(Enum):
    FILE_ADDED = "A"
    FILE_MODIFIED = "M"
    FILE_DELETED = "D"
    FILE_RENAMED = "R"
    UNKNOWN = "?"


@dataclass
class ParseError:
    line_number: int
    line_content: str
    error_type: str
    message: str
    source_file: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_number": self.line_number,
            "line_content": self.line_content,
            "error_type": self.error_type,
            "message": self.message,
            "source_file": self.source_file
        }


@dataclass
class DockerfileInstruction:
    line_number: int
    instruction: str
    arguments: str
    raw_content: str
    layer_index: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_number": self.line_number,
            "instruction": self.instruction,
            "arguments": self.arguments,
            "raw_content": self.raw_content,
            "layer_index": self.layer_index
        }


@dataclass
class LayerInfo:
    index: int
    instruction: str
    cache_status: CacheStatus
    layer_hash: str = ""
    build_time_ms: int = 0
    size_bytes: int = 0
    dockerfile_line: Optional[int] = None
    cause_of_miss: str = ""
    raw_log_lines: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "instruction": self.instruction,
            "cache_status": self.cache_status.value,
            "layer_hash": self.layer_hash,
            "build_time_ms": self.build_time_ms,
            "size_bytes": self.size_bytes,
            "dockerfile_line": self.dockerfile_line,
            "cause_of_miss": self.cause_of_miss,
            "raw_log_lines": self.raw_log_lines
        }


@dataclass
class FileChange:
    filepath: str
    change_type: ChangeType
    old_filepath: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "filepath": self.filepath,
            "change_type": self.change_type.value,
            "old_filepath": self.old_filepath
        }


@dataclass
class AnalysisResult:
    dockerfile_instructions: List[DockerfileInstruction]
    layers: List[LayerInfo]
    file_changes: List[FileChange] = field(default_factory=list)
    parse_errors: List[ParseError] = field(default_factory=list)
    total_build_time_ms: int = 0
    cache_hit_count: int = 0
    cache_miss_count: int = 0
    recommendations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_hit_count + self.cache_miss_count
        if total == 0:
            return 0.0
        return self.cache_hit_count / total

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dockerfile_instructions": [i.to_dict() for i in self.dockerfile_instructions],
            "layers": [l.to_dict() for l in self.layers],
            "file_changes": [fc.to_dict() for fc in self.file_changes],
            "parse_errors": [e.to_dict() for e in self.parse_errors],
            "total_build_time_ms": self.total_build_time_ms,
            "cache_hit_count": self.cache_hit_count,
            "cache_miss_count": self.cache_miss_count,
            "cache_hit_rate": round(self.cache_hit_rate * 100, 2),
            "recommendations": self.recommendations,
            "metadata": self.metadata
        }
