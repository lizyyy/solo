from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.migration import MigrationStatus

class AffectedTableBase(BaseModel):
    table_name: str
    operation_type: Optional[str] = None
    estimated_rows: int = 0
    has_backup: bool = False
    remarks: Optional[str] = None

class AffectedTableCreate(AffectedTableBase):
    pass

class AffectedTableResponse(AffectedTableBase):
    id: int
    migration_id: int
    actual_rows: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ExecutionWindowBase(BaseModel):
    start_time: datetime
    end_time: datetime
    timezone: str = "Asia/Shanghai"
    is_enabled: bool = True
    remarks: Optional[str] = None

class ExecutionWindowCreate(ExecutionWindowBase):
    pass

class ExecutionWindowResponse(ExecutionWindowBase):
    id: int
    migration_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class RollbackScriptBase(BaseModel):
    script_content: str
    remarks: Optional[str] = None

class RollbackScriptCreate(RollbackScriptBase):
    pass

class RollbackScriptResponse(RollbackScriptBase):
    id: int
    migration_id: int
    version: int
    is_valid: bool
    validation_result: Optional[str] = None
    validated_at: Optional[datetime] = None
    validated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MigrationScriptBase(BaseModel):
    name: str
    description: Optional[str] = None
    script_content: str
    database_type: str = "mysql"
    created_by: Optional[str] = None

class MigrationScriptCreate(MigrationScriptBase):
    affected_tables: List[AffectedTableCreate] = Field(default_factory=list)
    execution_windows: List[ExecutionWindowCreate] = Field(default_factory=list)
    rollback_scripts: List[RollbackScriptCreate] = Field(default_factory=list)

class MigrationScriptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    script_content: Optional[str] = None
    database_type: Optional[str] = None
    status: Optional[MigrationStatus] = None

class MigrationScriptResponse(MigrationScriptBase):
    id: int
    status: MigrationStatus
    created_at: datetime
    updated_at: datetime
    executed_at: Optional[datetime] = None
    version: int
    parent_id: Optional[int] = None
    affected_tables: List[AffectedTableResponse] = Field(default_factory=list)
    execution_windows: List[ExecutionWindowResponse] = Field(default_factory=list)
    rollback_scripts: List[RollbackScriptResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True