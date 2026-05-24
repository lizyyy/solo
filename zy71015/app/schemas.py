from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class PerformanceBase(BaseModel):
    name: str
    date: datetime
    venue: str
    is_temporary: bool = False

class PerformanceCreate(PerformanceBase):
    pass

class PerformanceResponse(PerformanceBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class FireworkPointBase(BaseModel):
    location_code: str
    x_coordinate: float
    y_coordinate: float
    distance_to_audience: float
    firework_type: str
    quantity: int

class FireworkPointCreate(FireworkPointBase):
    pass

class FireworkPointResponse(FireworkPointBase):
    id: int
    performance_id: int
    safety_verified: bool
    verification_note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class FireApprovalBase(BaseModel):
    department: str
    approver_name: str
    certificate_number: Optional[str] = None
    notes: Optional[str] = None

class FireApprovalCreate(FireApprovalBase):
    pass

class FireApprovalResponse(FireApprovalBase):
    id: int
    performance_id: int
    status: str
    approval_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TestRecordBase(BaseModel):
    test_time: datetime
    tester_name: str
    witness_name: str
    weather_condition: Optional[str] = None
    video_evidence_url: Optional[str] = None
    notes: Optional[str] = None

class TestRecordCreate(TestRecordBase):
    pass

class TestRecordResponse(TestRecordBase):
    id: int
    performance_id: int
    test_result: str
    created_at: datetime

    class Config:
        from_attributes = True

class PropItemBase(BaseModel):
    item_name: str
    quantity: int
    safety_rating: Optional[str] = None
    storage_location: Optional[str] = None
    handler: Optional[str] = None

class PropItemCreate(PropItemBase):
    pass

class PropItemResponse(PropItemBase):
    id: int
    performance_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ApprovalResponse(BaseModel):
    approved: bool
    message: str
    performance_id: int
    current_status: str
    violations: List[str] = []
    warnings: List[str] = []

class ReportGenerateRequest(BaseModel):
    stage_manager_name: str
    fire_department_name: str
    prop_team_name: str

class ReportResponse(BaseModel):
    report_number: str
    overall_status: str
    generated_at: datetime
    download_url: str

class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    existing_record_id: Optional[int]
    message: str
