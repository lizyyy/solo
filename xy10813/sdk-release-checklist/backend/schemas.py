from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import ReleaseStatus


class InterfaceDiffBase(BaseModel):
    interface_name: str
    change_type: Optional[str] = None
    previous_signature: Optional[str] = None
    new_signature: Optional[str] = None
    description: Optional[str] = None
    breaking_change: bool = False


class InterfaceDiffCreate(InterfaceDiffBase):
    pass


class InterfaceDiffUpdate(BaseModel):
    verified: Optional[bool] = None
    verified_by: Optional[str] = None


class InterfaceDiff(InterfaceDiffBase):
    id: int
    sdk_version_id: int
    verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ExampleProjectBase(BaseModel):
    project_name: str
    project_url: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None


class ExampleProjectCreate(ExampleProjectBase):
    pass


class ExampleProjectUpdate(BaseModel):
    build_status: Optional[str] = None
    test_status: Optional[str] = None
    verified: Optional[bool] = None
    verified_by: Optional[str] = None
    verification_notes: Optional[str] = None


class ExampleProject(ExampleProjectBase):
    id: int
    sdk_version_id: int
    build_status: str
    test_status: str
    verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    
    class Config:
        from_attributes = True


class CompatibilityMatrixBase(BaseModel):
    platform: str
    min_version: Optional[str] = None
    max_version: Optional[str] = None
    supported: bool = True
    notes: Optional[str] = None


class CompatibilityMatrixCreate(CompatibilityMatrixBase):
    pass


class CompatibilityMatrixUpdate(BaseModel):
    confirmed: Optional[bool] = None
    confirmed_by: Optional[str] = None


class CompatibilityMatrix(CompatibilityMatrixBase):
    id: int
    sdk_version_id: int
    confirmed: bool
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ReleaseTaskBase(BaseModel):
    task_name: str
    task_type: Optional[str] = None
    description: Optional[str] = None
    assignee: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[datetime] = None
    dependency_task_ids: Optional[List[int]] = None


class ReleaseTaskCreate(ReleaseTaskBase):
    pass


class ReleaseTaskUpdate(BaseModel):
    status: Optional[str] = None
    completed_by: Optional[str] = None
    notes: Optional[str] = None


class ReleaseTask(ReleaseTaskBase):
    id: int
    sdk_version_id: int
    status: str
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class RollbackNoteBase(BaseModel):
    reason: str
    rollback_version: Optional[str] = None
    affected_components: Optional[List[str]] = None
    resolution_plan: Optional[str] = None


class RollbackNoteCreate(RollbackNoteBase):
    pass


class RollbackNote(RollbackNoteBase):
    id: int
    sdk_version_id: int
    rollback_date: datetime
    rolled_back_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class StatusHistoryBase(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    reason: Optional[str] = None


class StatusHistory(StatusHistoryBase):
    id: int
    sdk_version_id: int
    changed_by: Optional[str] = None
    changed_at: datetime
    
    class Config:
        from_attributes = True


class SDKVersionBase(BaseModel):
    version: str
    sdk_name: str
    language: Optional[str] = None
    changelog: Optional[str] = None
    release_notes: Optional[str] = None
    created_by: Optional[str] = None


class SDKVersionCreate(SDKVersionBase):
    interface_diffs: List[InterfaceDiffCreate] = Field(default_factory=list)
    example_projects: List[ExampleProjectCreate] = Field(default_factory=list)
    compatibility_matrix: List[CompatibilityMatrixCreate] = Field(default_factory=list)
    release_tasks: List[ReleaseTaskCreate] = Field(default_factory=list)
    idempotency_key: Optional[str] = None


class SDKVersionUpdate(BaseModel):
    changelog: Optional[str] = None
    release_notes: Optional[str] = None
    status: Optional[ReleaseStatus] = None


class SDKVersion(SDKVersionBase):
    id: int
    status: ReleaseStatus
    release_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_dirty: bool
    dirty_reason: Optional[str] = None
    interface_diffs: List[InterfaceDiff] = Field(default_factory=list)
    example_projects: List[ExampleProject] = Field(default_factory=list)
    compatibility_matrix: List[CompatibilityMatrix] = Field(default_factory=list)
    release_tasks: List[ReleaseTask] = Field(default_factory=list)
    rollback_notes: List[RollbackNote] = Field(default_factory=list)
    status_history: List[StatusHistory] = Field(default_factory=list)
    
    class Config:
        from_attributes = True


class StatusTransition(BaseModel):
    new_status: ReleaseStatus
    changed_by: str
    reason: Optional[str] = None


class CompensationActionCreate(BaseModel):
    action_type: str
    description: Optional[str] = None


class CompensationAction(BaseModel):
    id: int
    sdk_version_id: int
    action_type: str
    description: Optional[str] = None
    status: str
    executed_at: Optional[datetime] = None
    executed_by: Optional[str] = None
    result: Optional[str] = None
    
    class Config:
        from_attributes = True


class ValidationErrorDetail(BaseModel):
    field: str
    message: str
    severity: str = "error"


class ReleaseValidationResult(BaseModel):
    valid: bool
    errors: List[ValidationErrorDetail] = Field(default_factory=list)
    warnings: List[ValidationErrorDetail] = Field(default_factory=list)


class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    errors: Optional[List[dict]] = None
