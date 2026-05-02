from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


class CloudCoverCategory(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    BAD = "bad"


class ValidationSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationIssue(BaseModel):
    code: str
    severity: ValidationSeverity
    message: str
    field: Optional[str] = None
    value: Optional[Any] = None
    suggestion: Optional[str] = None


class ObservationRecord(BaseModel):
    observer_name: str
    observation_date: str
    start_time: str
    end_time: str
    timezone: str
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    elevation: Optional[float] = Field(default=0.0, ge=-500.0, le=10000.0)
    cloud_cover: float = Field(ge=0.0, le=1.0)
    limiting_magnitude: float = Field(ge=0.0, le=8.0)
    meteor_count: int = Field(ge=0)
    remarks: Optional[str] = None
    source_file: Optional[str] = None
    record_index: Optional[int] = None
    raw_data: Optional[Dict[str, Any]] = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        import zoneinfo
        try:
            zoneinfo.ZoneInfo(v)
            return v
        except Exception:
            raise ValueError(f"无效的时区: {v}")

    @field_validator("cloud_cover")
    @classmethod
    def validate_cloud_cover(cls, v: float) -> float:
        if v < 0 or v > 1:
            raise ValueError(f"云量必须在 0-1 之间: {v}")
        return v

    @field_validator("limiting_magnitude")
    @classmethod
    def validate_limiting_magnitude(cls, v: float) -> float:
        if v < 0 or v > 8:
            raise ValueError(f"极限星等必须在 0-8 之间: {v}")
        return v

    @property
    def cloud_category(self) -> CloudCoverCategory:
        if self.cloud_cover <= 0.1:
            return CloudCoverCategory.EXCELLENT
        elif self.cloud_cover <= 0.25:
            return CloudCoverCategory.GOOD
        elif self.cloud_cover <= 0.5:
            return CloudCoverCategory.FAIR
        elif self.cloud_cover <= 0.75:
            return CloudCoverCategory.POOR
        else:
            return CloudCoverCategory.BAD

    @property
    def is_bad_weather(self) -> bool:
        return self.cloud_cover > 0.75 or self.limiting_magnitude < 4.5


class ObservationPeriod(BaseModel):
    utc_start: datetime
    utc_end: datetime

    @property
    def duration_hours(self) -> float:
        delta = self.utc_end - self.utc_start
        return delta.total_seconds() / 3600.0

    def overlaps_with(self, other: "ObservationPeriod") -> bool:
        return not (self.utc_end <= other.utc_start or self.utc_start >= other.utc_end)

    def get_overlap_hours(self, other: "ObservationPeriod") -> float:
        if not self.overlaps_with(other):
            return 0.0
        overlap_start = max(self.utc_start, other.utc_start)
        overlap_end = min(self.utc_end, other.utc_end)
        delta = overlap_end - overlap_start
        return delta.total_seconds() / 3600.0


class ZHRCalculation(BaseModel):
    record_id: str
    observer_name: str
    observation_date: str
    utc_start: datetime
    utc_end: datetime
    duration_hours: float
    latitude: float
    longitude: float
    meteor_count: int
    cloud_cover: float
    limiting_magnitude: float

    raw_zhr: float
    population_index: float = 2.0
    cloud_correction_factor: float
    limiting_mag_correction_factor: float
    corrected_zhr: float

    zhr_lower: float
    zhr_upper: float
    confidence_level: float = 0.68

    observation_weight: float
    is_bad_weather: bool

    @property
    def is_reliable(self) -> bool:
        return (
            not self.is_bad_weather
            and self.meteor_count >= 5
            and self.duration_hours >= 0.25
        )


class ValidationResult(BaseModel):
    record_index: Optional[int] = None
    source_file: Optional[str] = None
    issues: List[ValidationIssue] = []
    is_valid: bool = True
    has_warnings: bool = False

    @property
    def errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.ERROR]

    @property
    def warnings(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.WARNING]


class ImportResult(BaseModel):
    source_file: str
    total_rows: int
    valid_records: int
    invalid_records: int
    validation_results: List[ValidationResult]
    imported_at: datetime = Field(default_factory=datetime.now)


class BatchValidationResult(BaseModel):
    total_records: int
    valid_records: int
    invalid_records: int
    records_with_warnings: int
    issues_by_severity: Dict[ValidationSeverity, int]
    detailed_results: List[ValidationResult]
    duplicate_observer_groups: List[List[str]] = []
    overlapping_period_groups: List[List[str]] = []


class ZHRBatchResult(BaseModel):
    shower_name: str
    observation_date: str
    total_records: int
    reliable_records: int
    unreliable_records: int
    mean_zhr: float
    median_zhr: float
    weighted_mean_zhr: float
    zhr_lower_aggregate: float
    zhr_upper_aggregate: float
    calculations: List[ZHRCalculation]
    calculated_at: datetime = Field(default_factory=datetime.now)


class QuarantineEntry(BaseModel):
    source_file: str
    record_index: int
    raw_data: Dict[str, Any]
    issues: List[ValidationIssue]
    quarantined_at: datetime = Field(default_factory=datetime.now)


class QuarantineLog(BaseModel):
    entries: List[QuarantineEntry] = []
    quarantined_at: datetime = Field(default_factory=datetime.now)


class ProjectConfig(BaseModel):
    project_name: str = "流星雨 ZHR 复核项目"
    shower_name: str = "未指定流星雨"
    observation_date: Optional[str] = None
    default_timezone: str = "Asia/Shanghai"
    population_index: float = 2.0
    confidence_level: float = 0.68
    bad_weather_cloud_threshold: float = 0.75
    bad_weather_lm_threshold: float = 4.5
    min_meteor_count_for_reliable: int = 5
    min_duration_hours_for_reliable: float = 0.25

    @field_validator("confidence_level")
    @classmethod
    def validate_confidence_level(cls, v: float) -> float:
        if not 0.5 <= v <= 0.999:
            raise ValueError(f"置信水平必须在 0.5-0.999 之间: {v}")
        return v
