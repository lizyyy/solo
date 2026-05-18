from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator


class MedicineBase(BaseModel):
    medicine_code: str = Field(..., description="药品编码")
    medicine_name: str = Field(..., description="药品名称")
    generic_name: Optional[str] = Field(None, description="通用名")
    specification: Optional[str] = Field(None, description="规格")
    dosage_form: Optional[str] = Field(None, description="剂型")
    manufacturer: Optional[str] = Field(None, description="生产厂家")
    batch_number: Optional[str] = Field(None, description="批号")
    expiry_date: Optional[datetime] = Field(None, description="有效期")
    storage_condition: Optional[str] = Field(None, description="储存条件")
    category: Optional[str] = Field(None, description="药品分类")


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    specification: Optional[str] = None
    dosage_form: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    storage_condition: Optional[str] = None
    category: Optional[str] = None


class MedicineResponse(MedicineBase):
    id: int
    created_at: datetime
    updated_at: datetime
    version: int

    class Config:
        orm_mode = True


class InventoryBase(BaseModel):
    medicine_id: int = Field(..., description="药品ID")
    quantity: int = Field(..., description="库存数量")
    unit: Optional[str] = Field(None, description="单位")
    location: Optional[str] = Field(None, description="存放位置")


class InventoryCreate(InventoryBase):
    pass


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = None
    unit: Optional[str] = None
    location: Optional[str] = None


class InventoryResponse(InventoryBase):
    id: int
    last_counted_at: Optional[datetime] = None
    last_counted_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    version: int
    medicine: Optional[MedicineResponse] = None

    class Config:
        orm_mode = True


class DoctorOrderBase(BaseModel):
    order_no: str = Field(..., description="医嘱单号")
    elderly_name: str = Field(..., description="老人姓名")
    elderly_id_card: Optional[str] = Field(None, description="老人身份证号")
    room_number: Optional[str] = Field(None, description="房间号")
    medicine_id: int = Field(..., description="药品ID")
    medicine_name: str = Field(..., description="药品名称")
    dosage: Optional[str] = Field(None, description="剂量")
    frequency: Optional[str] = Field(None, description="频次")
    start_date: datetime = Field(..., description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    is_stopped: bool = Field(False, description="是否停药")
    stopped_at: Optional[datetime] = Field(None, description="停药时间")
    stopped_by: Optional[str] = Field(None, description="停医嘱人")
    stop_reason: Optional[str] = Field(None, description="停药原因")
    inventory_synced: bool = Field(False, description="库存是否已同步")
    created_by: Optional[str] = Field(None, description="创建人")


class DoctorOrderCreate(DoctorOrderBase):
    pass


class DoctorOrderUpdate(BaseModel):
    elderly_name: Optional[str] = None
    elderly_id_card: Optional[str] = None
    room_number: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_stopped: Optional[bool] = None
    stopped_at: Optional[datetime] = None
    stopped_by: Optional[str] = None
    stop_reason: Optional[str] = None
    inventory_synced: Optional[bool] = None


class DoctorOrderResponse(DoctorOrderBase):
    id: int
    created_at: datetime
    updated_at: datetime
    version: int

    class Config:
        orm_mode = True


class InventoryCheckDetailBase(BaseModel):
    medicine_id: int = Field(..., description="药品ID")
    medicine_code: Optional[str] = Field(None, description="药品编码")
    medicine_name: str = Field(..., description="药品名称")
    specification: Optional[str] = Field(None, description="规格")
    batch_number: Optional[str] = Field(None, description="批号")
    system_quantity: int = Field(..., description="系统库存数量")
    actual_quantity: Optional[int] = Field(None, description="实际盘点数量")
    difference_quantity: Optional[int] = Field(None, description="差异数量")
    difference_reason: Optional[str] = Field(None, description="差异原因")
    unit: Optional[str] = Field(None, description="单位")
    is_match: Optional[bool] = Field(None, description="是否账实相符")
    checked_by: Optional[str] = Field(None, description="盘点人")
    checked_at: Optional[datetime] = Field(None, description="盘点时间")


class InventoryCheckDetailCreate(InventoryCheckDetailBase):
    pass


class InventoryCheckDetailUpdate(BaseModel):
    actual_quantity: Optional[int] = None
    difference_quantity: Optional[int] = None
    difference_reason: Optional[str] = None
    is_match: Optional[bool] = None
    checked_by: Optional[str] = None
    checked_at: Optional[datetime] = None


class InventoryCheckDetailResponse(InventoryCheckDetailBase):
    id: int
    check_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class InventoryCheckBase(BaseModel):
    check_no: str = Field(..., description="盘点单号")
    check_type: str = Field(..., description="盘点类型")
    check_date: datetime = Field(..., description="盘点日期")
    checker: str = Field(..., description="盘点人")
    supervisor: Optional[str] = Field(None, description="监盘人")
    check_area: Optional[str] = Field(None, description="盘点区域")
    status: str = Field("draft", description="状态")
    remarks: Optional[str] = Field(None, description="备注")
    confirmed_by: Optional[str] = Field(None, description="确认人")
    confirmed_at: Optional[datetime] = Field(None, description="确认时间")
    created_by: Optional[str] = Field(None, description="创建人")


class InventoryCheckCreate(InventoryCheckBase):
    details: List[InventoryCheckDetailCreate] = Field(default_factory=list)


class InventoryCheckUpdate(BaseModel):
    check_type: Optional[str] = None
    check_date: Optional[datetime] = None
    checker: Optional[str] = None
    supervisor: Optional[str] = None
    check_area: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None


class InventoryCheckResponse(InventoryCheckBase):
    id: int
    total_items: int
    matched_items: int
    mismatched_items: int
    created_at: datetime
    updated_at: datetime
    version: int
    details: List[InventoryCheckDetailResponse] = Field(default_factory=list)

    class Config:
        orm_mode = True


class OperationLogResponse(BaseModel):
    id: int
    operation_type: str
    business_type: str
    business_id: int
    business_no: Optional[str]
    operator: str
    operation_time: datetime
    original_data: Optional[str]
    new_data: Optional[str]
    changed_fields: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class ErrorResponse(BaseModel):
    success: bool = False
    error_code: str
    error_message: str
    error_details: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
