from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None


class DatasetCreate(DatasetBase):
    pass


class Dataset(DatasetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    status: str

    class Config:
        from_attributes = True


class UpstreamTaskBase(BaseModel):
    name: str
    task_type: Optional[str] = None
    source_system: Optional[str] = None
    schedule: Optional[str] = None


class UpstreamTaskCreate(UpstreamTaskBase):
    dataset_id: int


class UpstreamTask(UpstreamTaskBase):
    id: int
    dataset_id: int
    last_run_time: Optional[datetime] = None
    status: str
    handler: Optional[str] = None
    handled_at: Optional[datetime] = None
    handle_reason: Optional[str] = None
    is_failed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DownstreamReportBase(BaseModel):
    name: str
    report_type: Optional[str] = None
    target_audience: Optional[str] = None
    refresh_frequency: Optional[str] = None


class DownstreamReportCreate(DownstreamReportBase):
    dataset_id: int


class DownstreamReport(DownstreamReportBase):
    id: int
    dataset_id: int
    last_refresh_time: Optional[datetime] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class FieldMappingBase(BaseModel):
    source_field: str
    target_field: str
    mapping_rule: Optional[str] = None
    transformation_logic: Optional[str] = None


class FieldMappingCreate(FieldMappingBase):
    dataset_id: int


class FieldMappingManualCorrection(BaseModel):
    mapping_rule: Optional[str] = None
    transformation_logic: Optional[str] = None
    corrected_by: str
    correction_reason: str


class FieldMapping(FieldMappingBase):
    id: int
    dataset_id: int
    is_manual_correction: bool
    corrected_by: Optional[str] = None
    corrected_at: Optional[datetime] = None
    correction_reason: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChangeImpactBase(BaseModel):
    change_type: str
    change_description: Optional[str] = None
    impacted_fields: Optional[List[str]] = None
    impacted_reports: Optional[List[str]] = None
    severity: Optional[str] = "medium"


class ChangeImpactCreate(ChangeImpactBase):
    dataset_id: int


class ChangeImpact(ChangeImpactBase):
    id: int
    dataset_id: int
    status: str
    handler: Optional[str] = None
    handled_at: Optional[datetime] = None
    handle_reason: Optional[str] = None
    is_failed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LineageGraphBase(BaseModel):
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    graph_data: Optional[Dict[str, Any]] = None


class LineageGraphCreate(LineageGraphBase):
    dataset_id: int


class LineageGraph(LineageGraphBase):
    id: int
    dataset_id: int
    calculated_at: datetime
    version: int

    class Config:
        from_attributes = True


class FailedItemDetail(BaseModel):
    id: int
    type: str
    name: str
    status: str
    handler: Optional[str] = None
    handled_at: Optional[datetime] = None
    handle_reason: Optional[str] = None
    created_at: datetime
    dataset_name: Optional[str] = None


class DatasetDetail(Dataset):
    upstream_tasks: List[UpstreamTask] = []
    downstream_reports: List[DownstreamReport] = []
    field_mappings: List[FieldMapping] = []
    change_impacts: List[ChangeImpact] = []
    lineage_graph: Optional[LineageGraph] = None
