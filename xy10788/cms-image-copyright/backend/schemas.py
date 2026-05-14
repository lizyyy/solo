from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class ImageBase(BaseModel):
    original_url: str
    file_name: str
    copyright_holder: str
    license_type: str
    copyright_expiry_date: datetime
    notes: Optional[str] = None

class ImageCreate(ImageBase):
    pass

class ImageResponse(ImageBase):
    id: int
    file_path: str
    upload_date: datetime
    status: str
    created_at: datetime
    updated_at: datetime
    usage_count: Optional[int] = 0
    
    class Config:
        orm_mode = True

class ImageUsageBase(BaseModel):
    page_url: str
    page_title: str
    usage_location: Optional[str] = None

class ImageUsageCreate(ImageUsageBase):
    image_id: int

class ImageUsageResponse(ImageUsageBase):
    id: int
    image_id: int
    is_active: bool
    added_at: datetime
    
    class Config:
        orm_mode = True

class ReplacementInitiate(BaseModel):
    old_image_id: int
    new_image_id: int
    page_url: str
    initiated_by: str

class ReplacementResponse(BaseModel):
    id: int
    old_image_id: int
    new_image_id: int
    page_url: str
    old_url: str
    new_url: str
    status: str
    initiated_by: str
    initiated_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    
    class Config:
        orm_mode = True

class CopyrightExtensionCreate(BaseModel):
    image_id: int
    new_expiry_date: datetime
    extended_by: str
    reason: str

class CopyrightExtensionResponse(BaseModel):
    id: int
    image_id: int
    previous_expiry_date: datetime
    new_expiry_date: datetime
    extended_by: str
    reason: str
    extended_at: datetime
    
    class Config:
        orm_mode = True

class RiskExportItem(BaseModel):
    image_id: int
    original_url: str
    file_name: str
    status: str
    copyright_expiry_date: datetime
    copyright_holder: str
    usage_pages: List[str]
    days_until_expiry: Optional[int]

class UsageDetail(BaseModel):
    page_url: str
    page_title: str
    usage_location: Optional[str]
    is_active: bool
    added_at: datetime
