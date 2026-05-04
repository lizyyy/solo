from datetime import datetime, date
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class CheckStatus(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"
    PENDING = "pending"


class IssueType(str, Enum):
    LOUDNESS_TOO_LOW = "loudness_too_low"
    LOUDNESS_TOO_HIGH = "loudness_too_high"
    LOUDNESS_OUT_OF_RANGE = "loudness_out_of_range"
    AD_AUTHORIZATION_MISSING = "ad_authorization_missing"
    AD_AUTHORIZATION_EXPIRED = "ad_authorization_expired"
    AD_NOT_COVERED = "ad_not_covered"
    MUSIC_AUTHORIZATION_MISSING = "music_authorization_missing"
    MUSIC_AUTHORIZATION_EXPIRED = "music_authorization_expired"
    COVER_SIZE_TOO_SMALL = "cover_size_too_small"
    COVER_SIZE_TOO_LARGE = "cover_size_too_large"
    COVER_ASPECT_RATIO_INVALID = "cover_aspect_ratio_invalid"
    COVER_MISSING = "cover_missing"
    DUPLICATE_EPISODE = "duplicate_episode"
    EPISODE_NUMBER_MISSING = "episode_number_missing"


class Issue(BaseModel):
    issue_type: IssueType
    severity: CheckStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    affected_field: Optional[str] = None


class Episode(BaseModel):
    episode_number: int = Field(..., ge=1, description="集号")
    title: str = Field(..., description="标题")
    publish_date: Optional[date] = Field(None, description="计划发布日期")
    audio_file: Optional[str] = Field(None, description="音频文件名")
    duration_seconds: Optional[int] = Field(None, description="时长(秒)")
    sponsors: List[str] = Field(default_factory=list, description="广告赞助商列表")
    music_tracks: List[str] = Field(default_factory=list, description="使用的音轨列表")
    cover_file: Optional[str] = Field(None, description="封面文件名")
    description: Optional[str] = Field(None, description="描述")


class LoudnessCheckResult(BaseModel):
    audio_file: str
    integrated_lufs: float
    true_peak_dbfs: Optional[float] = None
    loudness_range: Optional[float] = None
    measured_at: datetime = Field(default_factory=datetime.now)


class AdSponsor(BaseModel):
    sponsor_id: str
    name: str
    campaign: Optional[str] = None


class AdAuthorization(BaseModel):
    sponsor_id: str
    episode_numbers: List[int]
    valid_from: date
    valid_to: date
    is_active: bool = True
    notes: Optional[str] = None


class MusicTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album: Optional[str] = None


class MusicAuthorization(BaseModel):
    track_id: str
    episode_numbers: List[int]
    valid_from: date
    valid_to: date
    license_type: str
    is_active: bool = True
    notes: Optional[str] = None


class CoverImage(BaseModel):
    file_name: str
    episode_number: Optional[int] = None
    width: int
    height: int
    format: str
    file_size_bytes: int


class ReviewNote(BaseModel):
    id: Optional[int] = None
    episode_number: int
    note: str
    reviewer: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None


class EpisodeCheckResult(BaseModel):
    episode_number: int
    title: str
    overall_status: CheckStatus = CheckStatus.PENDING
    issues: List[Issue] = Field(default_factory=list)
    loudness_status: CheckStatus = CheckStatus.PENDING
    ad_status: CheckStatus = CheckStatus.PENDING
    music_status: CheckStatus = CheckStatus.PENDING
    cover_status: CheckStatus = CheckStatus.PENDING
    checked_at: Optional[datetime] = None
    review_notes: List[ReviewNote] = Field(default_factory=list)
    
    class Config:
        validate_assignment = True
    
    @property
    def can_publish(self) -> bool:
        return self.overall_status == CheckStatus.PASS and all(
            issue.severity != CheckStatus.FAIL
            for issue in self.issues
        )
    
    @property
    def fail_issues(self) -> List[Issue]:
        return [i for i in self.issues if i.severity == CheckStatus.FAIL]
    
    @property
    def warning_issues(self) -> List[Issue]:
        return [i for i in self.issues if i.severity == CheckStatus.WARNING]


class AuditPackage(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.now)
    version: str = "1.0"
    episodes: List[EpisodeCheckResult]
    statistics: Dict[str, Any]
    raw_data: Dict[str, Any]
