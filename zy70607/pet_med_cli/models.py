from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class PetType(str, Enum):
    DOG = "dog"
    CAT = "cat"
    BIRD = "bird"
    OTHER = "other"


class ShiftType(str, Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    NIGHT = "night"


class MedicationStatus(str, Enum):
    PENDING = "pending"
    ADMINISTERED = "administered"
    SKIPPED = "skipped"
    MISSED = "missed"


class ChangeStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class Pet(BaseModel):
    pet_id: str
    name: str
    type: PetType
    breed: Optional[str] = None
    age: Optional[float] = None
    weight_kg: Optional[float] = None
    owner_name: str
    owner_phone: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        frozen = True


class FosterOrder(BaseModel):
    order_id: str
    pet_id: str
    checkin_date: date
    checkout_date: date
    room_number: Optional[str] = None
    special_requirements: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.now)

    @validator("checkout_date")
    def checkout_after_checkin(cls, v, values):
        if "checkin_date" in values and v < values["checkin_date"]:
            raise ValueError("checkout_date must be after checkin_date")
        return v


class DosageVersion(BaseModel):
    version: int
    medication_name: str
    dosage_amount: str
    dosage_unit: str
    frequency: str
    route: str
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=datetime.now)


class MedicationPlan(BaseModel):
    plan_id: str
    order_id: str
    pet_id: str
    start_date: date
    end_date: Optional[date] = None
    dosage_versions: List[DosageVersion] = Field(default_factory=list)
    current_version: int = 1
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)

    def get_current_dosage(self) -> Optional[DosageVersion]:
        for v in self.dosage_versions:
            if v.version == self.current_version:
                return v
        return None

    def add_dosage_version(self, dosage: DosageVersion) -> None:
        existing_versions = [v.version for v in self.dosage_versions]
        if dosage.version in existing_versions:
            raise ValueError(f"Version {dosage.version} already exists")
        if dosage.version != self.current_version + 1:
            raise ValueError(f"New version must be {self.current_version + 1}")
        self.dosage_versions.append(dosage)
        self.current_version = dosage.version


class ShiftExecution(BaseModel):
    execution_id: str
    plan_id: str
    shift_date: date
    shift_type: ShiftType
    status: MedicationStatus = MedicationStatus.PENDING
    administered_at: Optional[datetime] = None
    administered_by: Optional[str] = None
    dosage_version_at_execution: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class ChangeRecord(BaseModel):
    change_id: str
    plan_id: str
    field_changed: str
    old_value: Any
    new_value: Any
    requested_by: str
    requested_at: datetime = Field(default_factory=datetime.now)
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    status: ChangeStatus = ChangeStatus.PENDING
    change_hash: str

    class Config:
        frozen = True


class CareReportItem(BaseModel):
    date: date
    shift: ShiftType
    pet_name: str
    medication: str
    dosage: str
    status: MedicationStatus
    administered_by: Optional[str] = None
    notes: Optional[str] = None
    has_change: bool = False
    change_info: Optional[str] = None


class CareReport(BaseModel):
    report_id: str
    order_id: str
    pet_id: str
    start_date: date
    end_date: date
    generated_at: datetime = Field(default_factory=datetime.now)
    items: List[CareReportItem] = Field(default_factory=list)
    alerts: List[str] = Field(default_factory=list)
    summary: Dict[str, int] = Field(default_factory=dict)
