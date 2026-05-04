from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class TreeBase(BaseModel):
    tree_id: str
    latitude: float
    longitude: float
    species: str = ""
    address: str = ""
    district: str = ""
    status: str = "healthy"


class TreeCreate(TreeBase):
    pass


class TreeResponse(TreeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    inspection_id: str
    tree_id: str
    inspector: str = ""
    inspection_date: datetime
    photo_paths: List[str] = []
    pest_damage: bool = False
    disease_present: bool = False
    health_status: str = "normal"
    notes: str = ""


class InspectionCreate(InspectionBase):
    pass


class InspectionResponse(InspectionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TreatmentBase(BaseModel):
    treatment_id: str
    tree_id: str
    inspector: str = ""
    treatment_date: datetime
    chemical_used: str = ""
    dosage: str = ""
    treatment_type: str = ""
    notes: str = ""
    is_effective: Optional[bool] = None


class TreatmentCreate(TreatmentBase):
    pass


class TreatmentResponse(TreatmentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RuleBase(BaseModel):
    rule_type: str
    name: str
    value: str
    description: str = ""
    is_active: bool = True


class RuleCreate(RuleBase):
    pass


class RuleResponse(RuleBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RiskBase(BaseModel):
    risk_type: str
    severity: str = "medium"
    tree_id: Optional[str] = None
    inspection_id: Optional[str] = None
    treatment_id: Optional[str] = None
    description: str
    details: str = ""
    is_resolved: bool = False


class RiskResponse(RiskBase):
    id: int
    created_at: datetime
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TreeDetailResponse(TreeResponse):
    inspections: List[InspectionResponse] = []
    treatments: List[TreatmentResponse] = []
    risks: List[RiskResponse] = []


class ClosedLoopResponse(BaseModel):
    tree_id: str
    inspection_id: str
    treatment_id: str
    inspection_date: datetime
    treatment_date: datetime
    pest_damage: bool
    disease_present: bool
    chemical_used: str
    is_effective: Optional[bool]
    status: str


class ImportResult(BaseModel):
    success: bool
    message: str
    imported_count: int = 0
    errors: List[str] = []


class RiskSummary(BaseModel):
    risk_type: str
    count: int
    severity: str
