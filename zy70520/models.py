from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MigrationPhase(str, Enum):
    INITIALIZED = "initialized"
    PRE_CHECK = "pre_check"
    DATA_BACKUP = "data_backup"
    DATA_EXPORT = "data_export"
    DATA_IMPORT = "data_import"
    DATA_VALIDATION = "data_validation"
    SWITCH_TRAFFIC = "switch_traffic"
    POST_CLEANUP = "post_cleanup"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLBACK = "rollback"


class MigrationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class ValidationResult(BaseModel):
    check_name: str
    status: MigrationStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class RollbackPoint(BaseModel):
    rollback_id: str
    phase: MigrationPhase
    description: str
    backup_location: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    metadata: Optional[Dict[str, Any]] = None


class ExceptionRecord(BaseModel):
    exception_id: str
    phase: MigrationPhase
    error_type: str
    error_message: str
    raw_input: Optional[Dict[str, Any]] = None
    processing_context: Optional[Dict[str, Any]] = None
    resolution: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None


class PhaseRecord(BaseModel):
    phase: MigrationPhase
    status: MigrationStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    validation_results: List[ValidationResult] = Field(default_factory=list)
    exceptions: List[ExceptionRecord] = Field(default_factory=list)
    retry_count: int = 0
    operator: Optional[str] = None


class TenantMigration(BaseModel):
    migration_id: str
    tenant_id: str
    source_region: str
    target_region: str
    current_phase: MigrationPhase = MigrationPhase.INITIALIZED
    phase_history: List[PhaseRecord] = Field(default_factory=list)
    rollback_points: List[RollbackPoint] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: Optional[str] = None
    remarks: Optional[str] = None
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CreateMigrationRequest(BaseModel):
    tenant_id: str
    source_region: str
    target_region: str
    created_by: Optional[str] = None
    remarks: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AdvancePhaseRequest(BaseModel):
    operator: Optional[str] = None
    force: bool = False
    validation_results: Optional[List[ValidationResult]] = None


class ReportExceptionRequest(BaseModel):
    error_type: str
    error_message: str
    raw_input: Optional[Dict[str, Any]] = None
    processing_context: Optional[Dict[str, Any]] = None
    operator: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    target_phase: Optional[MigrationPhase] = None
    resolution: str
    operator: str
    new_status: Optional[MigrationStatus] = None


class MigrationSummary(BaseModel):
    migration_id: str
    tenant_id: str
    source_region: str
    target_region: str
    current_phase: MigrationPhase
    overall_status: MigrationStatus
    created_at: datetime
    updated_at: datetime
    total_phases: int
    completed_phases: int
    failed_phases: int
    exception_count: int
    unresolved_exceptions: int
