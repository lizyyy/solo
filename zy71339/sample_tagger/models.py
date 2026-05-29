from __future__ import annotations

import hashlib
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Sequence

from pydantic import BaseModel, Field, field_serializer, field_validator


class TagCategory(str, Enum):
    DRUM = "drum"
    BASS = "bass"
    AMBIENT = "ambient"
    SUSPICIOUS_NOISE = "suspicious_noise"
    SILENCE = "silence"
    UNKNOWN = "unknown"


class TagSource(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"
    CONFLICT_RESOLVED = "conflict_resolved"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    FEATURES_EXTRACTED = "features_extracted"
    TAGGED = "tagged"
    CONFLICT = "conflict"
    DUPLICATE = "duplicate"
    COMPLETED = "completed"
    ERROR = "error"


class ConflictType(str, Enum):
    MULTI_TAG = "multi_tag"
    AUTO_MANUAL_MISMATCH = "auto_manual_mismatch"
    LOW_CONFIDENCE = "low_confidence"


class DuplicateType(str, Enum):
    EXACT_FILE = "exact_file"
    AUDIO_FINGERPRINT = "audio_fingerprint"
    NAME_PATTERN = "name_pattern"
    SAME_ID = "same_id"


class SpectrumFeatures(BaseModel):
    spectral_centroid: float
    spectral_bandwidth: float
    spectral_rolloff: float
    spectral_contrast: list[float]
    zero_crossing_rate: float
    rms: float
    mfcc: list[float]
    chroma_stft: list[float]
    spectral_flatness: float
    peak_envelope: float
    duration: float

    class Config:
        frozen = True


class Tag(BaseModel):
    category: TagCategory
    confidence: float = Field(ge=0.0, le=1.0)
    source: TagSource
    timestamp: datetime = Field(default_factory=datetime.now)
    evidence: dict[str, Any] = Field(default_factory=dict)
    reviewer: Optional[str] = None

    @field_serializer("timestamp")
    def serialize_timestamp(self, v: datetime) -> str:
        return v.isoformat()


class ConflictRecord(BaseModel):
    conflict_id: str
    sample_id: str
    conflict_type: ConflictType
    tags: list[Tag]
    description: str
    resolved: bool = False
    resolution: Optional[Tag] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    @field_serializer("resolved_at")
    def serialize_resolved_at(self, v: Optional[datetime]) -> Optional[str]:
        return v.isoformat() if v else None


class DuplicateRecord(BaseModel):
    duplicate_group_id: str
    duplicate_type: DuplicateType
    sample_ids: list[str]
    primary_sample_id: Optional[str] = None
    similarity_score: float = Field(ge=0.0, le=1.0)
    evidence: dict[str, Any] = Field(default_factory=dict)


class SampleFile(BaseModel):
    sample_id: str
    file_path: Path
    file_name: str
    file_hash: str
    file_size: int
    sample_rate: int
    channels: int
    created_at: datetime = Field(default_factory=datetime.now)
    status: ProcessingStatus = ProcessingStatus.PENDING
    features: Optional[SpectrumFeatures] = None
    tags: list[Tag] = Field(default_factory=list)
    manual_tags: list[Tag] = Field(default_factory=list)
    is_silent: bool = False
    is_suspicious: bool = False
    error_message: Optional[str] = None
    source_folder: str = ""

    @field_validator("file_path", mode="before")
    @classmethod
    def path_to_path(cls, v: Any) -> Path:
        return Path(v) if not isinstance(v, Path) else v

    @field_serializer("file_path")
    def serialize_path(self, v: Path) -> str:
        return str(v)

    @field_serializer("created_at")
    def serialize_created_at(self, v: datetime) -> str:
        return v.isoformat()

    @classmethod
    def generate_id(cls, file_path: Path) -> str:
        return hashlib.md5(str(file_path.resolve()).encode()).hexdigest()[:12]

    def get_effective_tags(self) -> list[Tag]:
        all_tags = self.tags + self.manual_tags
        return sorted(all_tags, key=lambda t: t.confidence, reverse=True)

    def get_primary_tag(self) -> Optional[Tag]:
        effective = self.get_effective_tags()
        return effective[0] if effective else None


class ProcessingState(BaseModel):
    run_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_samples: int = 0
    processed_samples: int = 0
    status_counts: dict[ProcessingStatus, int] = Field(default_factory=dict)
    tag_distribution: dict[TagCategory, int] = Field(default_factory=dict)


class ReportSummary(BaseModel):
    total_files: int
    tagged_files: int
    silent_files: int
    suspicious_files: int
    conflict_count: int
    duplicate_count: int
    duplicate_groups: int
    tag_breakdown: dict[str, int]
    processing_time_seconds: float
    run_id: str
    generated_at: datetime

    @field_serializer("generated_at")
    def serialize_generated_at(self, v: datetime) -> str:
        return v.isoformat()


class DetailedReport(BaseModel):
    summary: ReportSummary
    samples: list[SampleFile]
    conflicts: list[ConflictRecord]
    duplicates: list[DuplicateRecord]
    source_folders: list[str]


class ExportBundle(BaseModel):
    version: str = "1.0"
    schema_version: str = "1.0"
    generated_at: datetime
    report: DetailedReport
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_serializer("generated_at")
    def serialize_generated_at(self, v: datetime) -> str:
        return v.isoformat()

    def lookup_sample(self, sample_id: str) -> Optional[SampleFile]:
        for s in self.report.samples:
            if s.sample_id == sample_id:
                return s
        return None

    def get_duplicates_for_sample(self, sample_id: str) -> list[DuplicateRecord]:
        return [d for d in self.report.duplicates if sample_id in d.sample_ids]
