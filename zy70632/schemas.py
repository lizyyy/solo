from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class BatchBase(BaseModel):
    batch_no: str = Field(..., description="批次号")
    dish_name: str = Field(..., description="菜品名称")
    production_date: datetime = Field(..., description="生产日期")
    quantity: float = Field(..., description="生产数量")
    operator: str = Field(..., description="操作人")
    remark: Optional[str] = None


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    dish_name: Optional[str] = None
    quantity: Optional[float] = None
    remark: Optional[str] = None
    status: Optional[str] = None


class Batch(BatchBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StorageLocationBase(BaseModel):
    location_code: str = Field(..., description="位置编码")
    location_name: str = Field(..., description="位置名称")
    refrigerator_no: str = Field(..., description="冰箱编号")
    shelf_no: str = Field(..., description="货架编号")
    temperature: Optional[float] = None
    remark: Optional[str] = None


class StorageLocationCreate(StorageLocationBase):
    pass


class StorageLocation(StorageLocationBase):
    id: int
    is_available: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SampleBoxBase(BaseModel):
    box_no: str = Field(..., description="留样盒编号")
    batch_id: int = Field(..., description="批次ID")
    storage_location_id: int = Field(..., description="冷藏位置ID")
    sample_date: datetime = Field(..., description="留样日期")
    retention_days: int = Field(default=48, description="留样天数")
    operator: str = Field(..., description="操作人")
    remark: Optional[str] = None


class SampleBoxCreate(SampleBoxBase):
    pass


class SampleBoxUpdate(BaseModel):
    storage_location_id: Optional[int] = None
    remark: Optional[str] = None
    status: Optional[str] = None


class SampleBox(SampleBoxBase):
    id: int
    expiry_date: datetime
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    inspection_no: str = Field(..., description="抽检编号")
    batch_id: int = Field(..., description="批次ID")
    sample_box_id: int = Field(..., description="留样盒ID")
    inspection_date: datetime = Field(..., description="抽检日期")
    inspector: str = Field(..., description="抽检人")
    appearance: Optional[str] = None
    smell: Optional[str] = None
    taste: Optional[str] = None
    microbiology: Optional[str] = None
    result: str = Field(..., description="抽检结果")
    conclusion: str = Field(..., description="抽检结论")
    remark: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class InspectionReview(BaseModel):
    reviewer: str = Field(..., description="复核人")
    review_result: str = Field(..., description="复核结果")
    review_remark: Optional[str] = None


class Inspection(InspectionBase):
    id: int
    reviewer: Optional[str] = None
    review_date: Optional[datetime] = None
    review_result: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DestructionBase(BaseModel):
    destruction_no: str = Field(..., description="销毁编号")
    sample_box_id: int = Field(..., description="留样盒ID")
    application_date: datetime = Field(..., description="申请日期")
    applicant: str = Field(..., description="申请人")
    reason: str = Field(..., description="销毁原因")
    remark: Optional[str] = None


class DestructionCreate(DestructionBase):
    pass


class DestructionReview(BaseModel):
    reviewer: str = Field(..., description="审核人")
    review_result: str = Field(..., description="审核结果")
    review_remark: Optional[str] = None


class DestructionExecute(BaseModel):
    destructor: str = Field(..., description="销毁人")
    destruction_method: str = Field(..., description="销毁方式")
    witness: str = Field(..., description="见证人")


class Destruction(DestructionBase):
    id: int
    reviewer: Optional[str] = None
    review_date: Optional[datetime] = None
    review_result: Optional[str] = None
    review_remark: Optional[str] = None
    destruction_date: Optional[datetime] = None
    destructor: Optional[str] = None
    destruction_method: Optional[str] = None
    witness: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    related_type: str = Field(..., description="关联类型")
    related_id: int = Field(..., description="关联ID")
    original_input: str = Field(..., description="原始输入")
    operator: str = Field(..., description="操作人")
    exception_type: str = Field(..., description="异常类型")
    description: str = Field(..., description="异常描述")


class ExceptionRecordCreate(ExceptionRecordBase):
    pass


class ExceptionRecordHandle(BaseModel):
    handler: str = Field(..., description="处理人")
    conclusion: str = Field(..., description="处理结论")


class ExceptionRecord(ExceptionRecordBase):
    id: int
    exception_no: str
    handler: Optional[str] = None
    handle_date: Optional[datetime] = None
    conclusion: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TraceReportRequest(BaseModel):
    batch_no: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[dict] = None


class BatchDetail(Batch):
    samples: List[SampleBox] = []
    inspections: List[Inspection] = []
