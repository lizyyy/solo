from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SampleRegistrationBase(BaseModel):
    sample_code: str = Field(..., min_length=1, max_length=50)
    user_id: int
    sample_type: Optional[str] = None
    description: Optional[str] = None
    registered_at: datetime
    expected_pickup_at: Optional[datetime] = None
    actual_pickup_at: Optional[datetime] = None
    max_storage_hours: int = 72
    is_overdue: bool = False
    status: str = "in_storage"
    notes: Optional[str] = None


class SampleRegistrationImport(BaseModel):
    sample_code: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    sample_type: Optional[str] = None
    description: Optional[str] = None
    registered_at: str
    expected_pickup_at: Optional[str] = None
    actual_pickup_at: Optional[str] = None
    max_storage_hours: int = 72
    status: str = "in_storage"
    notes: Optional[str] = None


class SampleRegistrationCreate(SampleRegistrationBase):
    pass


class SampleRegistrationUpdate(BaseModel):
    user_id: Optional[int] = None
    sample_type: Optional[str] = None
    description: Optional[str] = None
    expected_pickup_at: Optional[datetime] = None
    actual_pickup_at: Optional[datetime] = None
    max_storage_hours: Optional[int] = None
    is_overdue: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class SampleRegistrationResponse(SampleRegistrationBase):
    id: int
    import_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
