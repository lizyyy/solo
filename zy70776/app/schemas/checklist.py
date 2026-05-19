from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.checklist import ChecklistStatus, MissingLevel


class ArtifactBase(BaseModel):
    name: str
    path: str
    version: Optional[str] = None


class ArtifactCreate(ArtifactBase):
    pass


class ArtifactResponse(ArtifactBase):
    id: int
    exists: Optional[bool] = None
    checked_at: Optional[datetime] = None
    checked_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MigrationScriptBase(BaseModel):
    name: str
    path: str
    description: Optional[str] = None
    rollback_available: bool = False


class MigrationScriptCreate(MigrationScriptBase):
    pass


class MigrationScriptResponse(MigrationScriptBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RollbackStepBase(BaseModel):
    step_order: int
    description: str
    owner: Optional[str] = None


class RollbackStepCreate(RollbackStepBase):
    pass


class RollbackStepResponse(RollbackStepBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReleaseChecklistBase(BaseModel):
    version: str
    title: str
    description: Optional[str] = None
    owner: str


class ReleaseChecklistCreate(ReleaseChecklistBase):
    artifacts: List[ArtifactCreate] = Field(default_factory=list)
    migration_scripts: List[MigrationScriptCreate] = Field(default_factory=list)
    rollback_steps: List[RollbackStepCreate] = Field(default_factory=list)
    raw_input: Optional[str] = None


class ReleaseChecklistUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    artifacts: Optional[List[ArtifactCreate]] = None
    migration_scripts: Optional[List[MigrationScriptCreate]] = None
    rollback_steps: Optional[List[RollbackStepCreate]] = None


class ReleaseChecklistResponse(ReleaseChecklistBase):
    id: int
    status: ChecklistStatus
    created_at: datetime
    updated_at: datetime
    artifacts: List[ArtifactResponse] = Field(default_factory=list)
    migration_scripts: List[MigrationScriptResponse] = Field(default_factory=list)
    rollback_steps: List[RollbackStepResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True
