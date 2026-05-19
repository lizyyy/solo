from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import MaterialType, TransferStatus, ExceptionType


class MaterialBase(BaseModel):
    material_code: str
    name: str
    type: MaterialType
    specification: Optional[str] = None
    unit: str = "件"
    total_quantity: int = 0
    available_quantity: int = 0
    location: Optional[str] = None
    description: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class Material(MaterialBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BoothBase(BaseModel):
    booth_code: str
    name: str
    manager: str
    contact: Optional[str] = None


class BoothCreate(BoothBase):
    pass


class Booth(BoothBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TransferOrderBase(BaseModel):
    order_no: str
    quantity: int
    borrower: str
    operator: str
    transfer_time: datetime
    expected_return_time: Optional[datetime] = None
    remark: Optional[str] = None


class TransferOrderCreate(TransferOrderBase):
    material_code: str
    booth_code: str


class TransferOrder(TransferOrderBase):
    id: int
    material: Material
    booth: Booth
    status: TransferStatus
    exception_type: ExceptionType
    exception_note: Optional[str] = None
    returned_quantity: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReturnRecordBase(BaseModel):
    quantity: int
    return_time: datetime
    receiver: str
    condition: Optional[str] = None
    exception_type: ExceptionType = ExceptionType.NONE
    exception_note: Optional[str] = None
    remark: Optional[str] = None


class ReturnRecordCreate(ReturnRecordBase):
    order_no: str


class ReturnRecord(ReturnRecordBase):
    id: int
    transfer_order: TransferOrder
    created_at: datetime

    class Config:
        from_attributes = True


class ImportErrorLogBase(BaseModel):
    import_type: str
    file_name: str
    row_number: Optional[int] = None
    original_data: str
    error_message: str
    suggestion: Optional[str] = None


class ImportErrorLogCreate(ImportErrorLogBase):
    pass


class ImportErrorLog(ImportErrorLogBase):
    id: int
    resolved: int
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: int
    failed: int
    total: int
    errors: List[ImportErrorLog]


class TransferQuery(BaseModel):
    borrower: Optional[str] = None
    manager: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[TransferStatus] = None
    exception_type: Optional[ExceptionType] = None
    booth_code: Optional[str] = None


class PageInfo(BaseModel):
    page: int = 1
    page_size: int = 50


class TransferListResponse(BaseModel):
    total: int
    items: List[TransferOrder]
    summary: dict


class ExceptionSummary(BaseModel):
    exception_type: str
    count: int
    affected_quantity: int
