from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Any
from models import HazardStatus, HazardLevel, BatchStatus, OperationType


class ResponsiblePersonBase(BaseModel):
    name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)


class ResponsiblePersonCreate(ResponsiblePersonBase):
    pass


class ResponsiblePersonUpdate(ResponsiblePersonBase):
    name: Optional[str] = Field(None, max_length=100)


class ResponsiblePersonResponse(ResponsiblePersonBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class HazardPhotoBase(BaseModel):
    photo_type: Optional[str] = Field(None, max_length=50)
    file_path: str = Field(..., max_length=500)
    file_name: Optional[str] = Field(None, max_length=200)
    file_size: Optional[int] = None
    uploader: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class HazardPhotoCreate(HazardPhotoBase):
    pass


class HazardPhotoResponse(HazardPhotoBase):
    id: int
    hazard_id: int
    upload_time: datetime
    is_deleted: bool

    class Config:
        from_attributes = True


class RectificationPhotoBase(BaseModel):
    file_path: str = Field(..., max_length=500)
    file_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None


class RectificationPhotoCreate(RectificationPhotoBase):
    pass


class RectificationPhotoResponse(RectificationPhotoBase):
    id: int
    rectification_id: int
    upload_time: datetime

    class Config:
        from_attributes = True


class RectificationBase(BaseModel):
    rectifier: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    measures: Optional[str] = None
    cost: Optional[float] = None


class RectificationCreate(RectificationBase):
    photos: List[RectificationPhotoCreate] = Field(default_factory=list)


class RectificationResponse(RectificationBase):
    id: int
    hazard_id: int
    rectify_time: datetime
    photos: List[RectificationPhotoResponse]

    class Config:
        from_attributes = True


class RecheckPhotoBase(BaseModel):
    file_path: str = Field(..., max_length=500)
    file_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None


class RecheckPhotoCreate(RecheckPhotoBase):
    pass


class RecheckPhotoResponse(RecheckPhotoBase):
    id: int
    recheck_id: int
    upload_time: datetime

    class Config:
        from_attributes = True


class RecheckBase(BaseModel):
    rechecker: Optional[str] = Field(None, max_length=100)
    result: bool
    description: Optional[str] = None
    suggestion: Optional[str] = None


class RecheckCreate(RecheckBase):
    photos: List[RecheckPhotoCreate] = Field(default_factory=list)


class RecheckResponse(RecheckBase):
    id: int
    hazard_id: int
    recheck_time: datetime
    photos: List[RecheckPhotoResponse]

    class Config:
        from_attributes = True


class RuleCheckResultBase(BaseModel):
    rule_code: str = Field(..., max_length=50)
    rule_name: str = Field(..., max_length=100)
    passed: bool
    message: str
    check_stage: Optional[str] = Field(None, max_length=50)


class RuleCheckResultCreate(RuleCheckResultBase):
    pass


class RuleCheckResultResponse(RuleCheckResultBase):
    id: int
    hazard_id: int
    check_time: datetime

    class Config:
        from_attributes = True


class HazardBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=200)
    location_detail: Optional[str] = Field(None, max_length=500)
    level: HazardLevel = HazardLevel.MEDIUM
    discoverer: Optional[str] = Field(None, max_length=100)
    discoverer_phone: Optional[str] = Field(None, max_length=20)
    deadline: Optional[datetime] = None
    department: Optional[str] = Field(None, max_length=100)
    team: Optional[str] = Field(None, max_length=100)


class HazardCreate(HazardBase):
    photos: List[HazardPhotoCreate] = Field(default_factory=list)
    responsible_person_id: Optional[int] = None


class HazardUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=200)
    location_detail: Optional[str] = Field(None, max_length=500)
    level: Optional[HazardLevel] = None
    status: Optional[HazardStatus] = None
    deadline: Optional[datetime] = None
    responsible_person_id: Optional[int] = None
    department: Optional[str] = None
    team: Optional[str] = None


class HazardResponse(HazardBase):
    id: int
    hazard_code: str
    status: HazardStatus
    discover_time: datetime
    actual_close_time: Optional[datetime] = None
    responsible_person: Optional[ResponsiblePersonResponse] = None
    photos: List[HazardPhotoResponse]
    rectifications: List[RectificationResponse]
    rechecks: List[RecheckResponse]
    rule_check_results: List[RuleCheckResultResponse]
    is_duplicate: bool
    duplicate_with: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HazardFilter(BaseModel):
    responsible_person_id: Optional[int] = None
    department: Optional[str] = None
    team: Optional[str] = None
    status: Optional[HazardStatus] = None
    level: Optional[HazardLevel] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    has_exception: Optional[bool] = None
    is_closed: Optional[bool] = None


class BatchItemResult(BaseModel):
    row_index: int
    success: bool
    hazard_id: Optional[int] = None
    hazard_code: Optional[str] = None
    error_message: Optional[str] = None
    rule_checks: List[RuleCheckResultResponse] = Field(default_factory=list)


class BatchOperationResult(BaseModel):
    batch_no: str
    operation_type: OperationType
    status: BatchStatus
    total_count: int
    success_count: int
    failed_count: int
    items: List[BatchItemResult]
    operator: Optional[str] = None
    operate_time: datetime


class HazardExportRow(BaseModel):
    hazard_code: str
    title: str
    description: str
    location: str
    location_detail: str
    level: str
    status: str
    discover_time: str
    discoverer: str
    deadline: str
    actual_close_time: str
    responsible_person: str
    department: str
    team: str
    photo_count: int
    rectification_count: int
    recheck_count: int
    is_closed: str
    has_exception: str
    latest_rule_message: str
