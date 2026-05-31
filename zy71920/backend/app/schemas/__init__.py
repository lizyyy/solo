from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class ArtworkBase(BaseModel):
    artwork_id: str
    title: str
    artist: str
    width: float
    height: float
    depth: Optional[float] = None
    unit: str = "cm"
    medium: Optional[str] = None
    year: Optional[str] = None
    wall_location: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class ArtworkCreate(ArtworkBase):
    pass


class ArtworkUpdate(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    unit: Optional[str] = None
    medium: Optional[str] = None
    year: Optional[str] = None
    wall_location: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    status: Optional[str] = None
    needs_confirmation: Optional[bool] = None
    change_reason: Optional[str] = None


class Artwork(ArtworkBase):
    id: int
    status: str
    issues: List[Any]
    needs_confirmation: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LightingBase(BaseModel):
    light_type: str
    intensity: int
    color_temp: Optional[int] = None
    angle: Optional[float] = None
    notes: Optional[str] = None


class LightingCreate(LightingBase):
    artwork_id: int


class LightingUpdate(BaseModel):
    light_type: Optional[str] = None
    intensity: Optional[int] = None
    color_temp: Optional[int] = None
    angle: Optional[float] = None
    notes: Optional[str] = None
    is_locked: Optional[bool] = None


class Lighting(LightingBase):
    id: int
    artwork_id: int
    is_locked: bool
    locked_by: Optional[str]
    locked_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VersionHistoryBase(BaseModel):
    version_number: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None


class VersionHistory(VersionHistoryBase):
    id: int
    artwork_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class ImportIssue(BaseModel):
    row: int
    artwork_id: Optional[str]
    type: str
    message: str
    severity: str


class ImportResult(BaseModel):
    success: bool
    session_id: Optional[int] = None
    message: str
    total_records: int = 0
    success_count: int = 0
    warning_count: int = 0
    error_count: int = 0
    issues: List[ImportIssue] = []


class ConfirmationRequest(BaseModel):
    artwork_ids: List[int]
    confirmed: bool
    notes: Optional[str] = None


class ExportRequest(BaseModel):
    artwork_ids: Optional[List[int]] = None
    format: str = "xlsx"
    include_lighting: bool = True


class WallBase(BaseModel):
    wall_id: str
    name: str
    width: float
    height: float
    location: Optional[str] = None


class Wall(WallBase):
    id: int
    version: int
    uploaded_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ComparisonResult(BaseModel):
    field: str
    old_value: Optional[str]
    new_value: Optional[str]
    change_type: str


class ArtworkComparison(BaseModel):
    artwork_id: str
    title: str
    changes: List[ComparisonResult]
