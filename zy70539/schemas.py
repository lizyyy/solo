from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import EvidenceStatus


class MaterialBase(BaseModel):
    material_name: str
    material_type: Optional[str] = None
    file_hash: str
    file_path: Optional[str] = None
    is_supplement: bool = False
    supplement_reason: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class Material(MaterialBase):
    id: int
    package_id: int
    version: int
    created_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class SignatureBase(BaseModel):
    version: int
    signature_value: str
    signed_by: Optional[str] = None


class SignatureCreate(SignatureBase):
    materials_hash: str


class Signature(SignatureBase):
    id: int
    package_id: int
    signed_at: datetime
    previous_signature_id: Optional[int] = None
    verification_status: str
    verification_details: Optional[str] = None
    materials_hash: str

    class Config:
        from_attributes = True


class SupplementNoteBase(BaseModel):
    note_content: str
    version: int
    related_material_ids: Optional[List[int]] = None


class SupplementNoteCreate(SupplementNoteBase):
    pass


class SupplementNote(SupplementNoteBase):
    id: int
    package_id: int
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: str
    operation_status: str
    operator: Optional[str] = None
    original_input: Optional[str] = None
    processing_basis: Optional[str] = None
    final_conclusion: Optional[str] = None
    error_message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    package_id: int
    operation_at: datetime

    class Config:
        from_attributes = True


class EvidencePackageBase(BaseModel):
    case_number: str
    created_by: Optional[str] = None


class EvidencePackageCreate(EvidencePackageBase):
    materials: List[MaterialCreate]


class EvidencePackageUpdate(BaseModel):
    status: Optional[EvidenceStatus] = None
    verification_result: Optional[str] = None
    chain_report: Optional[str] = None


class EvidencePackageSupplement(BaseModel):
    materials: List[MaterialCreate]
    note_content: str
    operator: Optional[str] = None


class ManualCorrection(BaseModel):
    correction_reason: str
    corrected_fields: Dict[str, Any]
    operator: str


class EvidencePackage(EvidencePackageBase):
    id: int
    current_version: int
    status: EvidenceStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    latest_signature: Optional[str] = None
    verification_result: Optional[str] = None
    chain_report: Optional[str] = None
    materials: List[Material] = []
    signatures: List[Signature] = []
    operation_logs: List[OperationLog] = []
    supplement_notes: List[SupplementNote] = []

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    operator: str
    include_fields: Optional[List[str]] = None


class ExportRecordResponse(BaseModel):
    id: int
    package_id: int
    case_number: str
    export_version: int
    export_at: datetime
    exported_by: str
    download_token: str
    download_expires_at: datetime
    is_downloaded: bool

    class Config:
        from_attributes = True


class VerificationResult(BaseModel):
    is_valid: bool
    message: str
    details: Dict[str, Any]


class ChainReport(BaseModel):
    package_id: int
    case_number: str
    current_version: int
    version_chain: List[Dict[str, Any]]
    is_complete: bool
    generated_at: datetime
