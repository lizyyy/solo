from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Any, List, Dict, Union


class SessionCreate(BaseModel):
    session_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class SessionResponse(BaseModel):
    id: int
    session_name: str
    created_at: datetime
    status: str
    description: Optional[str]
    keys_file: Optional[str]
    events_file: Optional[str]
    rules_file: Optional[str]

    class Config:
        from_attributes = True


class RedisKeyResponse(BaseModel):
    id: int
    session_id: int
    key_name: str
    data_type: str
    ttl: Optional[int]
    memory_bytes: Optional[int]
    value_size: Optional[int]
    field_count: Optional[int]
    list_length: Optional[int]
    set_cardinality: Optional[int]
    zset_cardinality: Optional[int]
    stream_length: Optional[int]
    tags: Optional[str]
    description: Optional[str]

    class Config:
        from_attributes = True


class UsageEventResponse(BaseModel):
    id: int
    session_id: int
    timestamp: datetime
    key_name: str
    command: str
    read_write: str
    latency_ms: Optional[float]
    client_id: Optional[str]
    database: Optional[int]

    class Config:
        from_attributes = True


class ImportResponse(BaseModel):
    session_id: int
    status: str
    message: str
    keys_imported: Optional[int]
    events_imported: Optional[int]
    rules_loaded: Optional[bool]


class KeyAnalysisResponse(BaseModel):
    id: int
    key_id: int
    scenario: Optional[str]
    recommended_type: Optional[str]
    current_type_suitability: Optional[float]
    estimated_memory_bytes: Optional[int]
    memory_optimization_potential: Optional[float]
    is_hot_key: bool
    hot_key_score: Optional[float]
    is_big_key: bool
    big_key_score: Optional[float]
    ttl_risk_level: Optional[str]
    migration_risk_level: Optional[str]
    issues: Optional[List[Dict[str, Any]]]
    warnings: Optional[List[Dict[str, Any]]]
    suggestions: Optional[List[Dict[str, Any]]]


class AnalysisResultResponse(BaseModel):
    id: int
    session_id: int
    analysis_type: str
    summary: str
    score: Optional[float]
    total_keys: Optional[int]
    issues_found: Optional[int]
    warnings_found: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class FullAnalysisResponse(BaseModel):
    session_id: int
    session_name: str
    status: str
    overall_score: Optional[float]
    analysis_results: List[AnalysisResultResponse]
    key_analyses: List[KeyAnalysisResponse]


class AlternativeStructure(BaseModel):
    data_type: str
    suitability_score: float
    estimated_memory_bytes: int
    pros: List[str]
    cons: List[str]


class ComparisonAlternative(BaseModel):
    data_type: str
    suitability_score: float
    memory_estimate: int
    migration_complexity: str
    code_changes: str


class ComparisonResultResponse(BaseModel):
    id: int
    session_id: int
    scenario: str
    current_structure: str
    alternatives: List[ComparisonAlternative]
    comparison_summary: str
    recommended_structure: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConfirmationRequest(BaseModel):
    session_id: int
    report_id: int
    confirmed_by: str
    notes: Optional[str] = Field(None, max_length=1000)


class ConfirmationResponse(BaseModel):
    report_id: int
    session_id: int
    human_confirmed: bool
    confirmed_by: str
    confirmed_at: datetime
    notes: Optional[str]


class ReportGenerateRequest(BaseModel):
    session_id: int
    report_type: str = Field(default="full", pattern="^(full|summary|migration)$")
    format: str = Field(default="json", pattern="^(json|html|markdown)$")
    include_charts: Optional[bool] = True


class ReportResponse(BaseModel):
    id: int
    session_id: int
    report_name: str
    report_type: str
    format: str
    file_path: str
    created_at: datetime
    human_confirmed: bool
    download_url: Optional[str]


class StructureRule(BaseModel):
    scenario: str
    recommended_types: List[str]
    anti_patterns: List[str]
    memory_considerations: str
    performance_notes: str


class StatsSummary(BaseModel):
    total_sessions: int
    total_keys_analyzed: int
    total_reports_generated: int
    top_issues: List[Dict[str, Any]]


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    has_next: bool
