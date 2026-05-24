from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from .models import DrugType, HandoverStatus, PrescriptionStatus, DiscrepancyType

class DrugBase(BaseModel):
    drug_code: str
    drug_name: str
    drug_type: DrugType
    specification: Optional[str] = None
    manufacturer: Optional[str] = None

class DrugCreate(DrugBase):
    pass

class Drug(DrugBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DrugBatchBase(BaseModel):
    batch_no: str
    drug_id: int
    production_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    initial_quantity: float
    current_quantity: float
    unit: str = "支"

class DrugBatchCreate(DrugBatchBase):
    pass

class DrugBatch(DrugBatchBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PrescriptionBase(BaseModel):
    prescription_no: str
    drug_id: int
    batch_no: Optional[str] = None
    patient_name: Optional[str] = None
    quantity: float
    unit: str = "支"
    doctor_name: Optional[str] = None
    prescribed_at: Optional[datetime] = None

class PrescriptionCreate(PrescriptionBase):
    pass

class PrescriptionVerify(BaseModel):
    verified_by: str

class Prescription(PrescriptionBase):
    id: int
    status: PrescriptionStatus
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class InventoryRecordBase(BaseModel):
    record_no: str
    batch_id: int
    change_type: str
    change_quantity: float
    balance_quantity: float
    operator: Optional[str] = None
    remark: Optional[str] = None

class InventoryRecordCreate(InventoryRecordBase):
    pass

class InventoryRecord(InventoryRecordBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class HandoverItemBase(BaseModel):
    drug_id: Optional[int] = None
    batch_id: Optional[int] = None
    prescription_id: Optional[int] = None
    drug_name: str
    batch_no: str
    prescription_no: Optional[str] = None
    prescription_quantity: float = 0
    inventory_quantity: float = 0
    handover_quantity: float
    unit: str = "支"
    remark: Optional[str] = None

class HandoverItemCreate(HandoverItemBase):
    pass

class HandoverItem(HandoverItemBase):
    id: int
    handover_id: int
    is_consistent: bool
    
    class Config:
        from_attributes = True

class DiscrepancyReportBase(BaseModel):
    report_no: str
    handover_id: int
    discrepancy_type: DiscrepancyType
    description: str
    prescription_quantity: Optional[float] = None
    inventory_quantity: Optional[float] = None
    handover_quantity: Optional[float] = None
    difference: Optional[float] = None

class DiscrepancyReportCreate(DiscrepancyReportBase):
    pass

class DiscrepancyHandle(BaseModel):
    handled_by: str
    handle_result: str

class DiscrepancyReport(DiscrepancyReportBase):
    id: int
    status: str
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    handle_result: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class HandoverRecordBase(BaseModel):
    handover_no: str
    shift_type: str
    from_nurse: str
    to_nurse: str
    handover_time: Optional[datetime] = None

class HandoverRecordCreate(HandoverRecordBase):
    items: List[HandoverItemCreate]
    previous_handover_id: Optional[int] = None

class HandoverSubmit(BaseModel):
    pass

class HandoverFirstSign(BaseModel):
    signature: str
    sign_remark: Optional[str] = None
    is_late_sign: bool = False

class HandoverSecondSign(BaseModel):
    signature: str
    sign_remark: Optional[str] = None
    is_late_sign: bool = False

class HandoverVerify(BaseModel):
    reviewer: str

class HandoverReject(BaseModel):
    reviewer: str
    reject_reason: str

class HandoverWithdraw(BaseModel):
    operator: str
    reason: str

class HandoverManualFix(BaseModel):
    operator: str
    fix_description: str
    items: List[HandoverItemCreate]

class OperationLog(BaseModel):
    id: int
    handover_id: Optional[int] = None
    operation: str
    operator: Optional[str] = None
    remark: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class HandoverRecord(HandoverRecordBase):
    id: int
    status: HandoverStatus
    first_signature: Optional[str] = None
    first_signed_at: Optional[datetime] = None
    first_sign_remark: Optional[str] = None
    second_signature: Optional[str] = None
    second_signed_at: Optional[datetime] = None
    second_sign_remark: Optional[str] = None
    is_late_sign: Optional[bool] = None
    sign_time_abnormal: Optional[bool] = None
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    previous_handover_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[HandoverItem] = []
    discrepancies: List[DiscrepancyReport] = []
    
    class Config:
        from_attributes = True

class HandoverDetail(HandoverRecord):
    operation_logs: List[OperationLog] = []
    previous_reject_reason: Optional[str] = None

class ConsistencyCheckResult(BaseModel):
    is_consistent: bool
    issues: List[str]
    prescription_quantity: float
    inventory_quantity: float
    handover_quantity: float
