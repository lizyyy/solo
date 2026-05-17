from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class EnvironmentStage(Enum):
    DEV = "dev"
    TEST = "test"
    STAGING = "staging"
    PROD = "prod"
    UNKNOWN = "unknown"


class ValidationStatus(Enum):
    VALID = "valid"
    WARNING = "warning"
    INVALID = "invalid"
    ERROR = "error"


@dataclass
class ImageInfo:
    image_name: str
    tag: str
    commit_hash: Optional[str] = None
    environment: Optional[str] = None
    line_number: Optional[int] = None
    raw_line: Optional[str] = None
    parsed_version: Optional[str] = None
    parsed_commit: Optional[str] = None
    parsed_stage: Optional[str] = None
    parsed_build_time: Optional[str] = None


@dataclass
class ValidationError:
    code: str
    message: str
    severity: ValidationStatus
    field: Optional[str] = None
    suggestion: Optional[str] = None


@dataclass
class ValidationResult:
    image_info: ImageInfo
    status: ValidationStatus
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)


@dataclass
class NamingRule:
    name: str
    pattern: str
    description: str
    required: bool = True
    examples: List[str] = field(default_factory=list)
    bad_examples: List[str] = field(default_factory=list)


@dataclass
class ValidationReport:
    total_images: int
    valid_count: int
    warning_count: int
    invalid_count: int
    error_count: int
    results: List[ValidationResult]
    rules: List[NamingRule]
    generated_at: datetime = field(default_factory=datetime.now)
    duration_seconds: float = 0.0
    input_file: Optional[str] = None

    def get_statistics(self) -> Dict[str, Any]:
        stage_counts: Dict[str, int] = {}
        for result in self.results:
            stage = result.image_info.parsed_stage or "unknown"
            stage_counts[stage] = stage_counts.get(stage, 0) + 1

        return {
            "total": self.total_images,
            "valid": self.valid_count,
            "warning": self.warning_count,
            "invalid": self.invalid_count,
            "error": self.error_count,
            "by_stage": stage_counts,
        }
