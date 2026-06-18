from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import RecordStatus, CoordinateFormat


class SiltationRecordCreate(BaseModel):
    record_no: str
    harbor_name: str
    original_name: Optional[str] = None
    raw_latitude: str
    raw_longitude: str
    raw_siltation_value: Optional[float] = None
    raw_unit: Optional[str] = None


class SiltationRecordSimple(BaseModel):
    id: int
    record_no: str
    harbor_name: str
    name_changed: bool
    status: RecordStatus
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    siltation_cm: Optional[float] = None
    judgment_after: Optional[str] = None
    is_supplemented: bool
    supplement_count: int
    judgment_changed: bool
    fail_stage: Optional[str] = None
    fail_reason: Optional[str] = None

    class Config:
        from_attributes = True


class RemoteSensingImageCreate(BaseModel):
    record_id: int
    image_path: str
    capture_time: Optional[datetime] = None
    has_cloud_cover: bool = False
    cloud_cover_ratio: float = 0.0
    raw_latitude: Optional[str] = None
    raw_longitude: Optional[str] = None
    remark: Optional[str] = None


class SupplementNoteCreate(BaseModel):
    record_id: int
    note_type: str
    content: str
    operator: Optional[str] = None
    affected_judgments: Optional[str] = None


class SupplementNoteOut(BaseModel):
    id: int
    record_id: int
    note_type: str
    content: str
    operator: Optional[str] = None
    affected_judgments: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RejudgeLogOut(BaseModel):
    id: int
    record_id: int
    before_judgment: Optional[str] = None
    after_judgment: Optional[str] = None
    reason: Optional[str] = None
    triggered_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExportDiff(BaseModel):
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None


class SiltationRecordDetail(BaseModel):
    id: int
    record_no: str
    harbor_name: str
    original_name: Optional[str] = None
    name_changed: bool

    raw_latitude: str
    raw_longitude: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coord_format_detected: Optional[CoordinateFormat] = None
    coord_normalized: bool

    raw_siltation_value: Optional[float] = None
    raw_unit: Optional[str] = None
    siltation_cm: Optional[float] = None

    formula_version: Optional[str] = None
    status: RecordStatus
    fail_stage: Optional[str] = None
    fail_reason: Optional[str] = None
    fail_stage_desc: Optional[str] = None

    judgment_before: Optional[str] = None
    judgment_after: Optional[str] = None
    judgment_changed: bool

    is_supplemented: bool
    supplement_count: int

    gray_release_note: Optional[str] = None
    post_run_note: Optional[str] = None

    supplements: List[SupplementNoteOut] = []
    rejudge_logs: List[RejudgeLogOut] = []
    export_diffs: List[ExportDiff] = []

    class Config:
        from_attributes = True


class ManagerRecordView(BaseModel):
    id: int
    record_no: str
    harbor_name: str
    status: RecordStatus
    status_desc: str
    siltation_cm: Optional[float] = None
    judgment: Optional[str] = None

    is_supplemented: bool
    supplement_count: int
    supplement_tags: List[str] = Field(default_factory=list)

    judgment_changed: bool
    before_judgment: Optional[str] = None
    after_judgment: Optional[str] = None
    rejudge_reasons: List[str] = Field(default_factory=list)

    fail_stage: Optional[str] = None
    fail_reason: Optional[str] = None

    cloud_suspended: bool = False
    cloud_explanation: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GrayReleaseNoteUpdate(BaseModel):
    record_id: int
    changed_fields: List[str] = []
    remark: Optional[str] = None


class PostRunSupplement(BaseModel):
    record_id: int
    content: str
    operator: Optional[str] = None
    export_diffs: List[ExportDiff] = []
