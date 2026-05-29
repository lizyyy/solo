from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class BatchBase(BaseModel):
    name: str
    description: Optional[str] = None


class BatchCreate(BatchBase):
    pass


class Batch(BatchBase):
    id: int
    batch_no: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchDetail(Batch):
    material_count: int = 0
    anomaly_count: int = 0
    report_count: int = 0


class MaterialBase(BaseModel):
    material_type: str
    name: str
    source: str
    meta: Dict[str, Any] = Field(default_factory=dict)


class MaterialCreate(MaterialBase):
    batch_id: int
    content: Optional[str] = None
    file_path: Optional[str] = None


class Material(MaterialBase):
    id: int
    batch_id: int
    file_path: Optional[str]
    content_hash: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialDetail(Material):
    content_preview: Optional[str] = None


class ParsedLogEntryBase(BaseModel):
    log_time: Optional[datetime] = None
    log_level: Optional[str] = None
    category: Optional[str] = None
    message: str
    raw_text: str
    line_number: Optional[int] = None
    is_anomaly: bool = False
    meta: Dict[str, Any] = Field(default_factory=dict)


class ParsedLogEntryCreate(ParsedLogEntryBase):
    batch_id: int
    material_id: Optional[int] = None


class ParsedLogEntry(ParsedLogEntryBase):
    id: int
    batch_id: int
    material_id: Optional[int]

    class Config:
        from_attributes = True


class CacheFingerprintBase(BaseModel):
    cache_key: str
    fingerprint: str
    expected_fingerprint: Optional[str] = None
    status: str = "unknown"
    dependency_name: Optional[str] = None
    dependency_version: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class CacheFingerprintCreate(CacheFingerprintBase):
    batch_id: int
    material_id: Optional[int] = None


class CacheFingerprint(CacheFingerprintBase):
    id: int
    batch_id: int
    material_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class FailureClusterBase(BaseModel):
    cluster_type: str
    title: str
    description: Optional[str] = None
    severity: str = "medium"
    affected_count: int = 0
    sample_log_ids: List[int] = Field(default_factory=list)
    related_material_ids: List[int] = Field(default_factory=list)
    pattern_signature: Optional[str] = None
    is_normal_result: bool = False
    meta: Dict[str, Any] = Field(default_factory=dict)


class FailureClusterCreate(FailureClusterBase):
    batch_id: int


class FailureCluster(FailureClusterBase):
    id: int
    batch_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReproductionScriptBase(BaseModel):
    name: str
    script_type: str = "bash"
    content: str
    description: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class ReproductionScriptCreate(ReproductionScriptBase):
    batch_id: int
    cluster_id: Optional[int] = None


class ReproductionScript(ReproductionScriptBase):
    id: int
    batch_id: int
    cluster_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyBase(BaseModel):
    anomaly_type: str
    title: str
    description: Optional[str] = None
    severity: str = "medium"
    evidence_material_ids: List[int] = Field(default_factory=list)
    evidence_log_ids: List[int] = Field(default_factory=list)
    evidence_fingerprint_ids: List[int] = Field(default_factory=list)
    status: str = "identified"
    meta: Dict[str, Any] = Field(default_factory=dict)


class AnomalyCreate(AnomalyBase):
    batch_id: int


class Anomaly(AnomalyBase):
    id: int
    batch_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisReportBase(BaseModel):
    title: str
    summary: Optional[str] = None
    content: str
    anomaly_count: int = 0
    anomaly_details: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)


class AnalysisReportCreate(AnalysisReportBase):
    batch_id: int


class AnalysisReportReview(BaseModel):
    reviewed_by: str
    review_comment: Optional[str] = None


class AnalysisReport(AnalysisReportBase):
    id: int
    batch_id: int
    report_no: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    review_comment: Optional[str]
    export_path: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LogParseRequest(BaseModel):
    batch_id: int
    material_id: Optional[int] = None


class FingerprintAnalyzeRequest(BaseModel):
    batch_id: int
    material_id: Optional[int] = None


class ClusterRequest(BaseModel):
    batch_id: int


class ScriptGenerateRequest(BaseModel):
    batch_id: int
    cluster_id: Optional[int] = None


class ReportGenerateRequest(BaseModel):
    batch_id: int


class SampleImportRequest(BaseModel):
    batch_name: str
    preset: str = "default"


class ApiResponse(BaseModel):
    code: int = 0
    message: str = "success"
    data: Optional[Any] = None
