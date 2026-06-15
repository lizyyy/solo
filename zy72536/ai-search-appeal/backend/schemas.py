from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime


class SampleBase(BaseModel):
    sample_no: str
    query: str
    doc_title: str
    doc_url: str
    original_rank: int
    expected_rank: Optional[int] = None
    confidence: float
    is_low_confidence: bool = False
    is_hidden_by_avg: bool = False
    current_rank: Optional[int] = None
    status: str = "待复核"
    manual_note: Optional[str] = None


class SampleCreate(SampleBase):
    pass


class SampleUpdate(BaseModel):
    expected_rank: Optional[int] = None
    current_rank: Optional[int] = None
    status: Optional[str] = None
    manual_note: Optional[str] = None
    is_hidden_by_avg: Optional[bool] = None


class SampleVersionBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    rank: int
    score: float
    is_manual_modified: bool = False


class SampleVersionCreate(SampleVersionBase):
    model_version_id: int


class SampleVersion(SampleVersionBase):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: int
    sample_id: int
    model_version_id: int
    created_at: datetime


class Sample(SampleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ticket_id: int
    created_at: datetime
    updated_at: datetime
    versions: List[SampleVersion] = []


class AppealTicketBase(BaseModel):
    ticket_no: str
    source: str = "线上反馈工单"
    original_row_no: int
    raw_content: Union[List[Dict[str, Any]], Dict[str, Any]]
    status: str = "待处理"
    handler: Optional[str] = None
    desensitization_note: Optional[str] = None


class AppealTicketCreate(AppealTicketBase):
    samples: List[SampleCreate]


class AppealTicketUpdate(BaseModel):
    status: Optional[str] = None
    handler: Optional[str] = None
    desensitization_note: Optional[str] = None


class AppealTicket(AppealTicketBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    samples: List[Sample] = []


class ModelVersionBase(BaseModel):
    version_name: str
    description: Optional[str] = None


class ModelVersionCreate(ModelVersionBase):
    pass


class ModelVersion(ModelVersionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class AuditLogBase(BaseModel):
    action: str
    operator: str
    before_value: Optional[Any] = None
    after_value: Optional[Any] = None
    note: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    ticket_id: int
    sample_id: Optional[int] = None


class AuditLog(AuditLogBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ticket_id: int
    sample_id: Optional[int]
    created_at: datetime


class SelfCheckResultBase(BaseModel):
    ticket_id: int
    check_type: str
    passed: bool
    details: Optional[Any] = None


class SelfCheckResult(SelfCheckResultBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class ImportResult(BaseModel):
    success: bool
    ticket_id: int
    ticket_no: str
    samples_count: int
    warnings: List[str] = []


class RecalculateResult(BaseModel):
    success: bool
    ticket_id: int
    recalculated_count: int
    hidden_by_avg_count: int


class VersionCompareItem(BaseModel):
    sample_id: int
    sample_no: str
    query: str
    doc_title: str
    from_source: str
    status: str
    v1_rank: Optional[int] = None
    v2_rank: Optional[int] = None
    rank_change: Optional[int] = None
    is_low_confidence: bool
    is_hidden_by_avg: bool


class VersionCompareResult(BaseModel):
    version1: str
    version2: str
    items: List[VersionCompareItem]
    total_count: int
    pending_review_count: int
    from_ticket_count: int


class ExportRow(BaseModel):
    工单编号: str
    原始行号: int
    样本编号: str
    查询词: str
    文档标题: str
    文档URL: str
    原始排名: int
    预期排名: Optional[int]
    当前排名: Optional[int]
    置信度: float
    低置信度: str
    被平均指标盖住: str
    处理状态: str
    来源: str
    处理人: str
    脱敏规则备注: str
    人工备注: str


Sample.model_rebuild()
