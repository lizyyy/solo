from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class MedicineBase(BaseModel):
    name: str
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = None
    dosage_form: Optional[str] = None
    concentration: Optional[str] = None
    min_dose_per_kg: float
    max_dose_per_kg: float
    dose_unit: str
    species: Optional[str] = None
    contraindications: Optional[str] = None


class MedicineCreate(MedicineBase):
    pass


class Medicine(MedicineBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class InventoryBase(BaseModel):
    medicine_id: int
    batch_number: str
    quantity: int
    unit: str
    expiry_date: datetime
    location: Optional[str] = None


class InventoryCreate(InventoryBase):
    pass


class Inventory(InventoryBase):
    id: int
    received_date: datetime
    created_at: datetime
    medicine: Optional[Medicine] = None
    
    class Config:
        from_attributes = True


class PrescriptionItemBase(BaseModel):
    medicine_name: str
    medicine_id: Optional[int] = None
    batch_number: Optional[str] = None
    dosage: float
    dosage_unit: str
    frequency: Optional[str] = None
    duration_days: Optional[int] = None
    quantity: int
    unit_price: Optional[float] = None


class PrescriptionItemCreate(PrescriptionItemBase):
    pass


class PrescriptionItem(PrescriptionItemBase):
    id: int
    prescription_id: int
    check_status: str
    check_reason: Optional[str] = None
    subtotal: Optional[float] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class PrescriptionBase(BaseModel):
    prescription_no: str
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    pet_id: Optional[str] = None
    pet_name: Optional[str] = None
    pet_species: Optional[str] = None
    pet_weight_kg: float
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_id_card: Optional[str] = None
    diagnosis: Optional[str] = None


class PrescriptionCreate(PrescriptionBase):
    items: List[PrescriptionItemCreate]


class Prescription(PrescriptionBase):
    id: int
    status: str
    total_amount: float
    created_at: datetime
    updated_at: datetime
    items: List[PrescriptionItem] = []
    
    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    item_details: Optional[str] = None
    check_result: Optional[str] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    prescription_id: Optional[int] = None


class AuditLog(AuditLogBase):
    id: int
    prescription_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class CheckResultItem(BaseModel):
    item_index: int
    medicine_name: str
    passed: bool
    check_status: str
    reason: str
    dosage_info: Optional[str] = None


class BatchProcessResult(BaseModel):
    total: int
    success_count: int
    failed_count: int
    passed_items: List[CheckResultItem] = []
    blocked_items: List[CheckResultItem] = []
    prescription_id: Optional[int] = None
    prescription_no: Optional[str] = None


class ContraindicationBase(BaseModel):
    medicine_a_id: int
    medicine_b_id: int
    description: str
    severity: str = "warning"


class ContraindicationCreate(ContraindicationBase):
    pass


class Contraindication(ContraindicationBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    prescription_ids: Optional[List[int]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_blocked: bool = True
