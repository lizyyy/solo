from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models import FaultStatus, ImpactLevel

class InterfaceBase(BaseModel):
    api_path: str
    api_method: str
    service_name: str
    description: Optional[str] = None

class InterfaceCreate(InterfaceBase):
    pass

class Interface(InterfaceBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class CustomerBase(BaseModel):
    customer_id: str
    customer_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    id: int
    is_notified: bool
    notified_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class VersionBase(BaseModel):
    version: int
    title: str
    description: str
    impact_level: ImpactLevel
    change_log: Optional[str] = None

class VersionCreate(VersionBase):
    created_by: str

class Version(VersionBase):
    id: int
    created_by: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class UpdateRecordBase(BaseModel):
    update_type: str
    content: str

class UpdateRecordCreate(UpdateRecordBase):
    created_by: str

class UpdateRecord(UpdateRecordBase):
    id: int
    created_by: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class NotificationBase(BaseModel):
    customer_id: str
    notification_content: str

class NotificationCreate(NotificationBase):
    pass

class Notification(NotificationBase):
    id: int
    sent_at: datetime
    confirmed: bool
    confirmed_at: Optional[datetime]
    confirmed_by: Optional[str]
    
    class Config:
        from_attributes = True

class FaultEventBase(BaseModel):
    event_id: str
    title: str
    description: str
    impact_level: ImpactLevel = ImpactLevel.MEDIUM
    created_by: str

class FaultEventCreate(FaultEventBase):
    interfaces: List[InterfaceCreate] = Field(default_factory=list)
    customers: List[CustomerCreate] = Field(default_factory=list)

class FaultEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    impact_level: Optional[ImpactLevel] = None
    status: Optional[FaultStatus] = None

class FaultEvent(FaultEventBase):
    id: int
    status: FaultStatus
    created_at: datetime
    updated_at: Optional[datetime]
    interfaces: List[Interface] = Field(default_factory=list)
    customers: List[Customer] = Field(default_factory=list)
    versions: List[Version] = Field(default_factory=list)
    updates: List[UpdateRecord] = Field(default_factory=list)
    notifications: List[Notification] = Field(default_factory=list)
    
    class Config:
        from_attributes = True

class ImpactCalculationResult(BaseModel):
    total_interfaces: int
    total_customers: int
    impact_level: ImpactLevel
    severity_score: float

class PublishRequest(BaseModel):
    change_log: Optional[str] = None
    published_by: str

class StatusUpdateRequest(BaseModel):
    status: FaultStatus
    updated_by: str
    comment: Optional[str] = None

class ResolutionConfirmRequest(BaseModel):
    confirmed_by: str
    resolution_note: Optional[str] = None
