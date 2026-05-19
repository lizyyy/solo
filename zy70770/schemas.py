from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List
from database import VariableStatus


class EnvFileBase(BaseModel):
    file_path: str
    project_name: Optional[str] = None
    environment: Optional[str] = None


class EnvFileCreate(EnvFileBase):
    pass


class EnvFileUpdate(BaseModel):
    project_name: Optional[str] = None
    environment: Optional[str] = None


class EnvFile(EnvFileBase):
    id: int
    created_at: datetime
    updated_at: datetime
    variable_count: Optional[int] = 0

    class Config:
        from_attributes = True


class EnvVariableBase(BaseModel):
    key: str
    original_value: Optional[str] = None
    current_value: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_sensitive: bool = False


class EnvVariableCreate(EnvVariableBase):
    env_file_id: int


class EnvVariableUpdate(BaseModel):
    original_value: Optional[str] = None
    current_value: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_sensitive: Optional[bool] = None


class EnvVariable(EnvVariableBase):
    id: int
    env_file_id: int
    created_at: datetime
    updated_at: datetime
    reference_count: Optional[int] = 0

    class Config:
        from_attributes = True


class VariableReferenceBase(BaseModel):
    from_variable_id: int
    to_variable_id: int
    reference_type: Optional[str] = None
    line_number: Optional[int] = None


class VariableReferenceCreate(VariableReferenceBase):
    pass


class VariableReference(VariableReferenceBase):
    id: int
    created_at: datetime
    from_variable_key: Optional[str] = None
    to_variable_key: Optional[str] = None

    class Config:
        from_attributes = True


class ResponsiblePersonBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    department: Optional[str] = None


class ResponsiblePersonCreate(ResponsiblePersonBase):
    pass


class ResponsiblePersonUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None


class ResponsiblePerson(ResponsiblePersonBase):
    id: int
    created_at: datetime
    batch_count: Optional[int] = 0

    class Config:
        from_attributes = True


class RotationBatchBase(BaseModel):
    batch_name: str
    description: Optional[str] = None
    responsible_person_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None


class RotationBatchCreate(RotationBatchBase):
    pass


class RotationBatchUpdate(BaseModel):
    description: Optional[str] = None
    responsible_person_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[VariableStatus] = None


class RotationBatch(RotationBatchBase):
    id: int
    status: VariableStatus
    executed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    item_count: Optional[int] = 0

    class Config:
        from_attributes = True


class RotationItemBase(BaseModel):
    batch_id: int
    variable_id: int
    new_value: str
    rollback_value: str


class RotationItemCreate(RotationItemBase):
    pass


class RotationItemUpdate(BaseModel):
    new_value: Optional[str] = None
    rollback_value: Optional[str] = None
    status: Optional[VariableStatus] = None
    requires_review: Optional[bool] = None
    review_note: Optional[str] = None


class RotationItem(BaseModel):
    id: int
    batch_id: int
    variable_id: int
    variable_key: Optional[str] = None
    new_value: Optional[str] = None
    rollback_value_masked: Optional[str] = None
    status: VariableStatus
    requires_review: bool
    review_note: Optional[str] = None
    executed_at: Optional[datetime] = None
    rolled_back_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EnvImportRequest(BaseModel):
    file_path: str
    project_name: Optional[str] = None
    environment: Optional[str] = None
    auto_scan_references: bool = True


class EnvImportResponse(BaseModel):
    success: bool
    env_file_id: int
    variable_count: int
    reference_count: int
    message: str


class BatchGroupRequest(BaseModel):
    batch_name: str
    variable_ids: List[int]
    description: Optional[str] = None
    responsible_person_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    auto_detect_dependencies: bool = True


class BatchGroupResponse(BaseModel):
    success: bool
    batch_id: int
    item_count: int
    message: str


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class ReportRequest(BaseModel):
    batch_id: Optional[int] = None
    status: Optional[VariableStatus] = None
    responsible_person_id: Optional[int] = None
    format: str = "json"


class ReportResponse(BaseModel):
    success: bool
    report_data: dict
    generated_at: datetime


class DependencyScanResult(BaseModel):
    variable_id: int
    variable_key: str
    depends_on: List[dict]
    depended_by: List[dict]
    dependency_level: int
