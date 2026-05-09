from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class OperationStatus(str, Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    SUCCESS = "已完成"
    FAILED = "失败"
    PARTIAL = "部分完成"
    NEEDS_CONFIRM = "待确认"
    CONFIRMED = "已确认"
    CANCELLED = "已取消"


class MaterialCategory(str, Enum):
    CHEMICAL = "化学试剂"
    EQUIPMENT = "实验器材"
    GLASSWARE = "玻璃仪器"
    CONSUMABLE = "易耗品"
    OTHER = "其他"


class BusinessResponse(BaseModel):
    success: bool = Field(..., description="操作是否成功")
    message: str = Field(..., description="业务提示信息")
    code: Optional[str] = Field(None, description="业务状态码")
    data: Optional[Dict[str, Any]] = Field(None, description="返回业务数据")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")

    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class MaterialBase(BaseModel):
    name: str
    category: MaterialCategory
    specification: Optional[str] = None
    unit: str
    safety_level: int = 1
    description: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(MaterialBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InventoryResponse(BaseModel):
    material_id: int
    material_name: Optional[str] = None
    total_qty: float
    available_qty: float
    reserved_qty: float
    min_stock: float
    location: Optional[str] = None
    is_low_stock: bool = False

    class Config:
        from_attributes = True


class TeacherBase(BaseModel):
    name: str
    employee_no: str
    phone: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None


class TeacherResponse(TeacherBase):
    id: int

    class Config:
        from_attributes = True


class ClassBase(BaseModel):
    class_no: str
    name: str
    student_count: int = 0
    department: Optional[str] = None


class ClassResponse(ClassBase):
    id: int

    class Config:
        from_attributes = True


class CoursePlanItemBase(BaseModel):
    material_id: int
    qty_per_group: float
    notes: Optional[str] = None


class CoursePlanItemCreate(CoursePlanItemBase):
    pass


class CoursePlanItemResponse(CoursePlanItemBase):
    id: int
    total_qty: float
    material_name: Optional[str] = None
    material_unit: Optional[str] = None

    class Config:
        from_attributes = True


class CoursePlanBase(BaseModel):
    teacher_id: int
    class_id: int
    course_name: str
    experiment_name: str
    experiment_date: datetime
    total_groups: int = 1
    remarks: Optional[str] = None


class CoursePlanCreate(CoursePlanBase):
    plan_items: List[CoursePlanItemCreate]


class CoursePlanResponse(CoursePlanBase):
    id: int
    plan_no: str
    status: OperationStatus
    teacher_name: Optional[str] = None
    class_name: Optional[str] = None
    items: List[CoursePlanItemResponse] = []

    class Config:
        from_attributes = True


class UsageItemCreate(BaseModel):
    material_id: int
    actual_qty: float
    plan_qty: Optional[float] = None
    returnable_qty: float = 0


class UsageRecordCreate(BaseModel):
    plan_id: int
    operator_name: str
    operator_id: Optional[int] = None
    items: List[UsageItemCreate]
    remarks: Optional[str] = None


class UsageItemResponse(BaseModel):
    id: int
    material_id: int
    material_name: Optional[str] = None
    material_unit: Optional[str] = None
    plan_qty: Optional[float] = None
    actual_qty: float
    returnable_qty: float
    status: OperationStatus

    class Config:
        from_attributes = True


class ReturnItemCreate(BaseModel):
    material_id: int
    returned_qty: float
    condition: str = "完好"
    notes: Optional[str] = None


class ReturnItemResponse(BaseModel):
    id: int
    material_id: int
    material_name: Optional[str] = None
    material_unit: Optional[str] = None
    returned_qty: float
    condition: str
    notes: Optional[str] = None
    status: OperationStatus

    class Config:
        from_attributes = True


class LossItemCreate(BaseModel):
    material_id: int
    loss_qty: float
    loss_reason: str
    notes: Optional[str] = None


class LossItemResponse(BaseModel):
    id: int
    material_id: int
    material_name: Optional[str] = None
    material_unit: Optional[str] = None
    loss_qty: float
    loss_reason: str
    notes: Optional[str] = None
    status: OperationStatus

    class Config:
        from_attributes = True


class UsageRecordDetailResponse(BaseModel):
    id: int
    record_no: str
    plan_id: int
    plan_no: Optional[str] = None
    class_name: Optional[str] = None
    teacher_name: Optional[str] = None
    experiment_name: Optional[str] = None
    operator_name: Optional[str] = None
    status: OperationStatus
    total_used_qty: float
    total_returned_qty: float
    total_loss_qty: float
    pickup_time: Optional[datetime] = None
    return_time: Optional[datetime] = None
    teacher_confirmed: int
    confirmed_at: Optional[datetime] = None
    usage_items: List[UsageItemResponse] = []
    return_items: List[ReturnItemResponse] = []
    loss_items: List[LossItemResponse] = []
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class ReturnProcessRequest(BaseModel):
    record_no: str
    operator_name: str
    operator_id: Optional[int] = None
    items: List[ReturnItemCreate]
    remarks: Optional[str] = None


class LossRegisterRequest(BaseModel):
    record_no: str
    operator_name: str
    operator_id: Optional[int] = None
    items: List[LossItemCreate]
    remarks: Optional[str] = None


class TeacherConfirmRequest(BaseModel):
    record_no: str
    teacher_id: int
    confirm_notes: Optional[str] = None


class CompensationRetryRequest(BaseModel):
    compensation_id: int
    operator_name: str


class InventoryReportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    material_id: Optional[int] = None
    category: Optional[MaterialCategory] = None


class InventoryReportItem(BaseModel):
    material_id: int
    material_name: str
    category: MaterialCategory
    specification: Optional[str] = None
    unit: str
    begin_qty: float = 0
    in_qty: float = 0
    out_qty: float = 0
    return_qty: float = 0
    loss_qty: float = 0
    end_qty: float = 0
    net_change: float = 0


class InventoryReportResponse(BaseModel):
    report_type: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    generated_at: datetime = Field(default_factory=datetime.now)
    total_materials: int = 0
    total_out_qty: float = 0
    total_return_qty: float = 0
    total_loss_qty: float = 0
    items: List[InventoryReportItem] = []


class CompensationRecordResponse(BaseModel):
    id: int
    usage_record_id: int
    record_no: Optional[str] = None
    operation_type: str
    step_name: str
    error_message: Optional[str] = None
    status: OperationStatus
    retry_count: int
    last_attempt_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
