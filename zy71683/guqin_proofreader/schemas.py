from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ScoreCreate(BaseModel):
    title: str
    composer: Optional[str] = None
    tuning: Optional[str] = None
    mode: Optional[str] = None


class ScoreOut(BaseModel):
    id: int
    title: str
    composer: Optional[str]
    tuning: Optional[str]
    mode: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScoreVersionCreate(BaseModel):
    score_id: int
    content_json: str
    change_note: Optional[str] = None


class ScoreVersionOut(BaseModel):
    id: int
    score_id: int
    version_number: int
    status: str
    change_note: Optional[str]
    superseded_by: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class FingeringAnnotationCreate(BaseModel):
    score_id: int
    version_id: int
    measure_number: int
    position_in_measure: Optional[float] = None
    jianzi_char: str
    fingering_type: str
    hand: Optional[str] = None
    string_number: Optional[int] = None
    technique_detail: Optional[str] = None
    is_manual_correction: bool = False
    correction_reason: Optional[str] = None


class FingeringAnnotationOut(BaseModel):
    id: int
    score_id: int
    version_id: int
    measure_number: int
    position_in_measure: Optional[float]
    jianzi_char: str
    fingering_type: str
    hand: Optional[str]
    string_number: Optional[int]
    technique_detail: Optional[str]
    is_manual_correction: bool
    correction_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class MeasureCreate(BaseModel):
    score_id: int
    version_id: int
    measure_number: int
    start_position: Optional[float] = None
    end_position: Optional[float] = None
    beat_count: Optional[float] = None
    time_signature: Optional[str] = None
    is_manually_adjusted: bool = False


class MeasureOut(BaseModel):
    id: int
    score_id: int
    version_id: int
    measure_number: int
    start_position: Optional[float]
    end_position: Optional[float]
    beat_count: Optional[float]
    time_signature: Optional[str]
    is_manually_adjusted: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentAnnotationCreate(BaseModel):
    score_id: int
    version_id: Optional[int] = None
    measure_number: Optional[int] = None
    student_name: str
    content: str
    annotation_type: Optional[str] = None


class StudentAnnotationOut(BaseModel):
    id: int
    score_id: int
    version_id: Optional[int]
    measure_number: Optional[int]
    student_name: str
    content: str
    annotation_type: Optional[str]
    is_resolved: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class AnomalyOut(BaseModel):
    id: int
    report_id: int
    anomaly_type: str
    severity: str
    measure_number: Optional[int]
    description: str
    cause_analysis: Optional[str]
    affected_data_json: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ProofreadReportOut(BaseModel):
    id: int
    score_id: int
    version_id: int
    report_type: str
    summary: str
    anomaly_count: int
    detail_json: str
    created_at: datetime
    anomalies: List[AnomalyOut] = []

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    version_id: Optional[int]
    operator: Optional[str]
    before_json: Optional[str]
    after_json: Optional[str]
    note: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionDiffOut(BaseModel):
    field: str
    old_value: Optional[str]
    new_value: Optional[str]
    description: str


class VersionCompareOut(BaseModel):
    old_version: ScoreVersionOut
    new_version: ScoreVersionOut
    diffs: List[VersionDiffOut]


class ProofreadRequest(BaseModel):
    score_id: int
    version_id: int
