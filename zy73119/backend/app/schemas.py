from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class AnomalyTraceBase(BaseModel):
    step: int
    from_node: str
    to_node: str
    reason: str
    operator: str = ""


class AnomalyTrace(AnomalyTraceBase):
    id: int
    anomaly_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyRecordBase(BaseModel):
    anomaly_type: str = ""
    detail: str = ""
    source: str = ""
    operator: str = ""
    root_cause: str = ""
    action: str = ""
    resolved: bool = False
    resolved_by: str = ""


class AnomalyRecord(AnomalyRecordBase):
    id: int
    checklist_id: int
    resolved_at: Optional[datetime] = None
    created_at: datetime
    traces: List[AnomalyTrace] = []

    class Config:
        from_attributes = True


class AnomalyRecordCreate(AnomalyRecordBase):
    checklist_id: int


class MaterialSubmissionBase(BaseModel):
    material_name: str
    current_value: str = ""
    remark: str = ""
    screenshot_path: str = ""
    submitted_by: str = ""


class MaterialSubmission(MaterialSubmissionBase):
    id: int
    checklist_id: int
    version: int
    submitted_at: datetime
    is_current: bool

    class Config:
        from_attributes = True


class MaterialSubmissionCreate(MaterialSubmissionBase):
    checklist_id: int


class ChangeHistoryBase(BaseModel):
    field_name: str
    old_value: str = ""
    new_value: str = ""
    remark: str = ""
    screenshot_ref: str = ""
    changed_by: str = ""


class ChangeHistory(ChangeHistoryBase):
    id: int
    checklist_id: int
    changed_at: datetime

    class Config:
        from_attributes = True


class CoordinateOffsetBase(BaseModel):
    offset_x: float = 0.0
    offset_y: float = 0.0
    offset_z: float = 0.0
    threshold: float = 50.0
    action_owner: str = ""
    action_item: str = ""
    action_status: str = "待指派"


class CoordinateOffset(CoordinateOffsetBase):
    id: int
    checklist_id: int
    exceeds: bool
    detected_at: datetime

    class Config:
        from_attributes = True


class CoordinateOffsetCreate(CoordinateOffsetBase):
    checklist_id: int


class SurveyChecklistBase(BaseModel):
    item_no: str
    location: str
    description: str = ""
    model_ref: str = ""
    has_anomaly: bool = False
    anomaly_level: str = ""
    anomaly_note: str = ""
    status: str = "待处理"
    coordinator: str = ""
    operator: str = ""
    batch_id: str = ""


class SurveyChecklist(SurveyChecklistBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    anomalies: List[AnomalyRecord] = []
    materials: List[MaterialSubmission] = []
    offsets: List[CoordinateOffset] = []
    history: List[ChangeHistory] = []

    class Config:
        from_attributes = True


class SurveyChecklistCreate(SurveyChecklistBase):
    pass


class SurveyChecklistUpdate(BaseModel):
    location: Optional[str] = None
    description: Optional[str] = None
    model_ref: Optional[str] = None
    has_anomaly: Optional[bool] = None
    anomaly_level: Optional[str] = None
    anomaly_note: Optional[str] = None
    status: Optional[str] = None
    coordinator: Optional[str] = None
    operator: Optional[str] = None
    changed_by: Optional[str] = ""


class BatchRunBase(BaseModel):
    run_by: str = ""
    standard_version: str = ""
    standard_desc: str = ""


class BatchRun(BatchRunBase):
    id: int
    batch_id: str
    total_items: int
    anomaly_count: int
    offset_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchRunResult(BaseModel):
    batch: BatchRun
    anomaly_items: List[SurveyChecklist] = []
    offset_items: List[SurveyChecklist] = []
    standard_version: str
    standard_desc: str


class CSVExportMeta(BaseModel):
    export_at: datetime
    standard_version: str
    standard_desc: str
    batch_id: str
    operator: str
    total_rows: int
