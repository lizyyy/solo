from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AnimalStatus(str, Enum):
    ACTIVE = "active"
    DECEASED = "deceased"
    TRANSFERRED = "transferred"
    IN_QUARANTINE = "in_quarantine"


class AnomalyType(str, Enum):
    CAGE_CAPACITY_EXCEEDED = "cage_capacity_exceeded"
    QUARANTINE_ANIMAL_MIXED = "quarantine_animal_mixed"
    DECEASED_ANIMAL_SCANNED = "deceased_animal_scanned"
    TRANSFERRED_ANIMAL_SCANNED = "transferred_animal_scanned"
    DUPLICATE_SCAN = "duplicate_scan"


class AnomalyStatus(str, Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class AnimalBase(BaseModel):
    animal_id: str = Field(..., max_length=50)
    tag_id: Optional[str] = Field(None, max_length=50)
    species: str = Field(..., max_length=50)
    strain: Optional[str] = Field(None, max_length=100)
    sex: Optional[str] = Field(None, max_length=10)
    date_of_birth: Optional[datetime] = None
    status: AnimalStatus = AnimalStatus.ACTIVE
    quarantine_end_date: Optional[datetime] = None
    notes: Optional[str] = None


class AnimalCreate(AnimalBase):
    pass


class AnimalUpdate(BaseModel):
    tag_id: Optional[str] = None
    species: Optional[str] = None
    strain: Optional[str] = None
    sex: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    status: Optional[AnimalStatus] = None
    quarantine_end_date: Optional[datetime] = None
    notes: Optional[str] = None


class AnimalResponse(AnimalBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CageBase(BaseModel):
    cage_id: str = Field(..., max_length=50)
    location: Optional[str] = Field(None, max_length=100)
    max_capacity: int = 5
    is_quarantine: bool = False
    notes: Optional[str] = None


class CageCreate(CageBase):
    pass


class CageUpdate(BaseModel):
    location: Optional[str] = None
    max_capacity: Optional[int] = None
    is_quarantine: Optional[bool] = None
    notes: Optional[str] = None


class CageResponse(CageBase):
    id: int
    current_occupancy: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CageScanBase(BaseModel):
    scan_id: Optional[str] = None
    tag_id: str = Field(..., max_length=50)
    cage_id: str = Field(..., max_length=50)
    scan_timestamp: datetime
    scan_type: str = "check"
    operator: Optional[str] = None
    notes: Optional[str] = None


class CageScanCreate(CageScanBase):
    pass


class CageScanResponse(CageScanBase):
    id: int
    animal_id: Optional[int] = None
    is_duplicate: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class HealthCheckBase(BaseModel):
    check_id: Optional[str] = None
    animal_id: str
    check_date: datetime
    weight: Optional[float] = None
    temperature: Optional[float] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    condition: Optional[str] = None
    veterinarian: Optional[str] = None
    notes: Optional[str] = None


class HealthCheckCreate(HealthCheckBase):
    pass


class HealthCheckResponse(HealthCheckBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RuleBase(BaseModel):
    rule_name: str = Field(..., max_length=100)
    rule_type: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_active: bool = True
    priority: int = 1


class RuleCreate(RuleBase):
    pass


class RuleResponse(RuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnomalyBase(BaseModel):
    anomaly_type: AnomalyType
    description: Optional[str] = None


class AnomalyReview(BaseModel):
    status: AnomalyStatus
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None


class AnomalyResponse(AnomalyBase):
    id: int
    scan_event_id: Optional[int] = None
    animal_id: Optional[int] = None
    cage_id: Optional[int] = None
    detected_at: datetime
    status: AnomalyStatus
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    message: str
    records_imported: int
    errors: List[str] = []


class StateTransition(BaseModel):
    scan_id: str
    animal_id: str
    from_cage: Optional[str] = None
    to_cage: str
    transition_time: datetime
    is_valid: bool
    anomalies: List[AnomalyResponse] = []


class AnimalDetailResponse(AnimalResponse):
    current_cage: Optional[CageResponse] = None
    recent_scans: List[CageScanResponse] = []
    health_checks: List[HealthCheckResponse] = []


class CageDetailResponse(CageResponse):
    current_animals: List[AnimalResponse] = []
    recent_scans: List[CageScanResponse] = []
