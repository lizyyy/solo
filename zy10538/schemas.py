from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class MaterialStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_SUPPLEMENT = "needs_supplement"
    COMPLETED = "completed"


class MaterialType(str, Enum):
    COMPLAINT_FORM = "complaint_form"
    IDENTITY_PROOF = "identity_proof"
    SERVICE_CONTRACT = "service_contract"
    PAYMENT_PROOF = "payment_proof"
    PURCHASE_PROOF = "purchase_proof"
    PRODUCT_PHOTO = "product_photo"
    QUALITY_REPORT = "quality_report"
    OTHER = "other"


class ComplaintMaterialCreate(BaseModel):
    complaint_no: str = Field(..., description="投诉编号")
    material_type: str = Field(..., description="材料类型")
    batch_no: Optional[int] = Field(1, description="补交批次")
    submitted_by: Optional[str] = Field(None, description="提交人")
    material_report: Optional[Dict[str, Any]] = Field(None, description="材料报告")
    raw_input: Optional[Dict[str, Any]] = Field(None, description="原始输入")


class ComplaintMaterialUpdate(BaseModel):
    status: Optional[str] = None
    missing_description: Optional[str] = None
    material_report: Optional[Dict[str, Any]] = None
    auditor: Optional[str] = None
    audit_comment: Optional[str] = None
    processing_basis: Optional[str] = None
    final_conclusion: Optional[str] = None


class ComplaintMaterialQuery(BaseModel):
    complaint_no: Optional[str] = None
    material_type: Optional[str] = None
    status: Optional[str] = None
    batch_no: Optional[int] = None
    page: int = 1
    page_size: int = 20


class ComplaintMaterialResponse(BaseModel):
    id: int
    complaint_no: str
    material_type: str
    batch_no: int
    status: str
    missing_description: Optional[str]
    material_report: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    submitted_by: Optional[str]
    auditor: Optional[str]
    audit_time: Optional[datetime]
    audit_comment: Optional[str]
    raw_input: Optional[Dict[str, Any]]
    processing_basis: Optional[str]
    final_conclusion: Optional[str]

    class Config:
        orm_mode = True


class CorrectionCreate(BaseModel):
    corrected_by: str
    correction_reason: str
    new_values: Dict[str, Any]


class CorrectionResponse(BaseModel):
    id: int
    material_id: int
    corrected_by: str
    correction_reason: str
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
    created_at: datetime

    class Config:
        orm_mode = True


class MaterialMissingItem(BaseModel):
    material_type: str
    material_name: str
    status: str
    batch_no: Optional[int]
    missing_description: Optional[str]


class ComplaintMissingResponse(BaseModel):
    complaint_no: str
    complaint_type: str
    missing_materials: List[MaterialMissingItem]
    total_required: int
    completed_count: int
    missing_count: int


class AuditRequest(BaseModel):
    auditor: str
    audit_comment: Optional[str] = None
    status: str
    processing_basis: Optional[str] = None
    final_conclusion: Optional[str] = None
