from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class FractalStatus(str, Enum):
    SUCCESS = "success"
    NEEDS_REVIEW = "needs_review"
    LEGACY = "legacy"
    ERROR = "error"


class UnitType(str, Enum):
    PIXEL = "px"
    MILLIMETER = "mm"
    CENTIMETER = "cm"
    INCH = "in"
    PERCENT = "%"


@dataclass
class FractalPattern:
    fractal_dimension: Optional[float] = None
    iterations: Optional[int] = None
    scale_factor: Optional[float] = None
    rotation_angle: Optional[float] = None
    base_shape: Optional[str] = None
    unit: Optional[UnitType] = None
    color_palette: Optional[str] = None
    complexity_score: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.unit:
            data['unit'] = self.unit.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FractalPattern':
        if not isinstance(data, dict):
            raise ValueError(f"FractalPattern.from_dict 期望 dict，收到 {type(data).__name__}")
        data = dict(data)
        if data.get('unit') and isinstance(data['unit'], str):
            try:
                data['unit'] = UnitType(data['unit'])
            except ValueError:
                data['unit'] = None
        return cls(**data)


@dataclass
class ValidationIssue:
    field: str
    message: str
    severity: str
    suggestion: Optional[str] = None


@dataclass
class FractalRecord:
    record_id: str
    pattern: FractalPattern
    status: FractalStatus
    source: str
    processed_at: datetime
    created_at: datetime = field(default_factory=datetime.now)
    validation_issues: List[ValidationIssue] = field(default_factory=list)
    manual_override: bool = False
    override_reason: Optional[str] = None
    override_by: Optional[str] = None
    override_at: Optional[datetime] = None
    notes: Optional[str] = None
    raw_input: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'record_id': self.record_id,
            'pattern': self.pattern.to_dict(),
            'status': self.status.value,
            'source': self.source,
            'processed_at': self.processed_at.isoformat(),
            'created_at': self.created_at.isoformat(),
            'validation_issues': [asdict(issue) for issue in self.validation_issues],
            'manual_override': self.manual_override,
            'override_reason': self.override_reason,
            'override_by': self.override_by,
            'override_at': self.override_at.isoformat() if self.override_at else None,
            'notes': self.notes,
            'raw_input': self.raw_input
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FractalRecord':
        if not isinstance(data, dict):
            raise ValueError(f"FractalRecord.from_dict 期望 dict，收到 {type(data).__name__}")

        data = dict(data)

        pattern_data = data.get('pattern')
        if isinstance(pattern_data, dict):
            data['pattern'] = FractalPattern.from_dict(pattern_data)
        elif isinstance(pattern_data, FractalPattern):
            pass
        else:
            data['pattern'] = FractalPattern()

        status_val = data.get('status')
        if isinstance(status_val, str):
            try:
                data['status'] = FractalStatus(status_val)
            except ValueError:
                data['status'] = FractalStatus.ERROR
        elif not isinstance(status_val, FractalStatus):
            data['status'] = FractalStatus.ERROR

        for dt_field in ('processed_at', 'created_at'):
            val = data.get(dt_field)
            if isinstance(val, str):
                try:
                    data[dt_field] = datetime.fromisoformat(val)
                except (ValueError, TypeError):
                    data[dt_field] = datetime.now()
            elif not isinstance(val, datetime):
                data[dt_field] = datetime.now()

        override_at_val = data.get('override_at')
        if isinstance(override_at_val, str):
            try:
                data['override_at'] = datetime.fromisoformat(override_at_val)
            except (ValueError, TypeError):
                data['override_at'] = None
        elif not isinstance(override_at_val, datetime) and override_at_val is not None:
            data['override_at'] = None

        issues_data = data.get('validation_issues', [])
        if isinstance(issues_data, list):
            parsed_issues = []
            for issue in issues_data:
                if isinstance(issue, dict):
                    try:
                        parsed_issues.append(ValidationIssue(**issue))
                    except Exception:
                        pass
                elif isinstance(issue, ValidationIssue):
                    parsed_issues.append(issue)
            data['validation_issues'] = parsed_issues
        else:
            data['validation_issues'] = []

        if not isinstance(data.get('raw_input'), dict):
            data['raw_input'] = {}

        return cls(**data)
