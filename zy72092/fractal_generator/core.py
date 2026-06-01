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
        if data.get('unit'):
            data['unit'] = UnitType(data['unit'])
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
        data['pattern'] = FractalPattern.from_dict(data['pattern'])
        data['status'] = FractalStatus(data['status'])
        data['processed_at'] = datetime.fromisoformat(data['processed_at'])
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        data['validation_issues'] = [ValidationIssue(**issue) for issue in data['validation_issues']]
        if data.get('override_at'):
            data['override_at'] = datetime.fromisoformat(data['override_at'])
        return cls(**data)
