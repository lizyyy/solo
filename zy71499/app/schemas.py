from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models import AuthStatus


class ShowCreate(BaseModel):
    name: str = Field(..., max_length=200)
    producer: str = Field(..., max_length=200)
    description: str = ""


class ShowRead(BaseModel):
    id: int
    name: str
    producer: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntroMusicCreate(BaseModel):
    title: str = Field(..., max_length=200)
    artist: str = Field(..., max_length=200)
    duration_seconds: int = Field(..., gt=0)
    current_version: str = "v1"


class IntroMusicRead(BaseModel):
    id: int
    title: str
    artist: str
    duration_seconds: int
    current_version: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FileVersionCreate(BaseModel):
    version: str = Field(..., max_length=50)
    file_path: str = Field(..., max_length=500)
    file_hash: str = Field(..., max_length=64)


class FileVersionRead(BaseModel):
    id: int
    intro_music_id: int
    version: str
    file_path: str
    file_hash: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthContractCreate(BaseModel):
    show_id: int
    intro_music_id: int
    authorized_episode_count: int = Field(..., gt=0)
    auth_start_date: date
    auth_end_date: date
    contract_ref: Optional[str] = None


class AuthContractRead(BaseModel):
    id: int
    show_id: int
    intro_music_id: int
    status: AuthStatus
    authorized_episode_count: int
    used_episode_count: int
    auth_start_date: date
    auth_end_date: date
    locked_file_version: Optional[str]
    contract_ref: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EpisodeUsageCreate(BaseModel):
    episode_number: int = Field(..., gt=0)
    episode_title: str = Field(..., max_length=300)


class EpisodeUsageRead(BaseModel):
    id: int
    contract_id: int
    episode_number: int
    episode_title: str
    file_version_used: str
    used_at: datetime

    model_config = {"from_attributes": True}


class StatusTransitionRequest(BaseModel):
    to_status: AuthStatus
    reason: str = Field(..., min_length=1)
    operator: str = Field(..., min_length=1)
    detail: Optional[str] = None


class AuditLogRead(BaseModel):
    id: int
    contract_id: int
    action: str
    from_status: Optional[str]
    to_status: Optional[str]
    reason: str
    operator: str
    detail: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ShowBrief(BaseModel):
    id: int
    name: str
    producer: str

    model_config = {"from_attributes": True}


class IntroMusicBrief(BaseModel):
    id: int
    title: str
    artist: str
    current_version: str

    model_config = {"from_attributes": True}


class ContractAggregateRead(BaseModel):
    contract_id: int
    contract_ref: Optional[str]
    status: AuthStatus
    show: ShowBrief
    intro_music: IntroMusicBrief
    authorized_episode_count: int
    used_episode_count: int
    remaining_episodes: int
    auth_start_date: date
    auth_end_date: date
    is_expired: bool
    locked_file_version: Optional[str]
    current_file_version: str
    file_version_mismatch: bool
    created_at: datetime
    updated_at: datetime


class ContractAggregateExport(BaseModel):
    export_time: datetime
    total_records: int
    records: list[ContractAggregateRead]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    detail: Optional[str] = None
