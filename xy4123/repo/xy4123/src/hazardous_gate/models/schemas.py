from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from hazardous_gate.models.database import HazardLevel, StorageGroup, UsageStatus


class ReagentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="试剂名称")
    cas_number: str = Field(..., min_length=5, max_length=20, description="CAS号")
    english_name: Optional[str] = Field(None, max_length=200, description="英文名称")
    molecular_formula: Optional[str] = Field(None, max_length=100, description="分子式")
    molecular_weight: Optional[Decimal] = Field(None, ge=0, description="分子量")
    hazard_level: HazardLevel = Field(..., description="危险等级")
    storage_group: StorageGroup = Field(..., description="储存分组")
    cabinet_type: str = Field(..., min_length=1, max_length=50, description="储柜分类")
    min_authorization_level: int = Field(default=1, ge=1, le=5, description="最低授权等级")
    safety_info: Optional[str] = Field(None, description="安全信息")

    @field_validator("cas_number")
    @classmethod
    def validate_cas_number(cls, v: str) -> str:
        v = v.strip()
        parts = v.split("-")
        if len(parts) != 3:
            raise ValueError("CAS号格式错误，应为 数字-数字-数字 格式")
        if not all(part.isdigit() for part in parts):
            raise ValueError("CAS号各部分必须为数字")
        return v


class ReagentCreate(ReagentBase):
    pass


class ReagentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    english_name: Optional[str] = Field(None, max_length=200)
    molecular_formula: Optional[str] = Field(None, max_length=100)
    molecular_weight: Optional[Decimal] = Field(None, ge=0)
    hazard_level: Optional[HazardLevel] = None
    storage_group: Optional[StorageGroup] = None
    cabinet_type: Optional[str] = Field(None, min_length=1, max_length=50)
    min_authorization_level: Optional[int] = Field(None, ge=1, le=5)
    safety_info: Optional[str] = None


class ReagentRead(ReagentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    reagent_id: int = Field(..., gt=0, description="试剂ID")
    batch_number: str = Field(..., min_length=1, max_length=100, description="批号")
    manufacturer: Optional[str] = Field(None, max_length=200, description="生产厂家")
    purity: Optional[str] = Field(None, max_length=50, description="纯度")
    concentration: Optional[Decimal] = Field(None, ge=0, description="浓度值")
    concentration_unit: str = Field(..., min_length=1, max_length=20, description="浓度单位")
    package_unit: str = Field(default="ml", min_length=1, max_length=20, description="包装单位")
    initial_quantity: Decimal = Field(..., gt=0, description="初始数量")
    current_quantity: Decimal = Field(..., ge=0, description="当前库存")
    expiry_date: date = Field(..., description="有效期")
    production_date: Optional[date] = Field(None, description="生产日期")
    storage_location: Optional[str] = Field(None, max_length=100, description="存放位置")
    cabinet_number: Optional[str] = Field(None, max_length=50, description="储柜编号")


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    manufacturer: Optional[str] = Field(None, max_length=200)
    purity: Optional[str] = Field(None, max_length=50)
    concentration: Optional[Decimal] = Field(None, ge=0)
    concentration_unit: Optional[str] = Field(None, min_length=1, max_length=20)
    package_unit: Optional[str] = Field(None, min_length=1, max_length=20)
    current_quantity: Optional[Decimal] = Field(None, ge=0)
    expiry_date: Optional[date] = None
    production_date: Optional[date] = None
    storage_location: Optional[str] = Field(None, max_length=100)
    cabinet_number: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class BatchRead(BatchBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    reagent: Optional[ReagentRead] = None

    class Config:
        from_attributes = True


class UsageItemBase(BaseModel):
    batch_id: int = Field(..., gt=0, description="批次ID")
    requested_quantity: Decimal = Field(..., gt=0, description="申请数量")
    unit: str = Field(default="ml", min_length=1, max_length=20, description="单位")
    remarks: Optional[str] = Field(None, description="备注")


class UsageItemCreate(UsageItemBase):
    pass


class UsageItemRead(UsageItemBase):
    id: int
    course_usage_id: int
    approved_quantity: Optional[Decimal] = None
    issued_quantity: Optional[Decimal] = None
    returned_quantity: Decimal
    waste_quantity: Decimal
    created_at: datetime
    updated_at: datetime
    batch: Optional[BatchRead] = None

    class Config:
        from_attributes = True


class CourseUsageBase(BaseModel):
    course_name: str = Field(..., min_length=1, max_length=200, description="课程名称")
    teacher_name: str = Field(..., min_length=1, max_length=100, description="教师姓名")
    teacher_id: str = Field(..., min_length=1, max_length=50, description="教师工号")
    class_name: Optional[str] = Field(None, max_length=100, description="班级")
    student_count: int = Field(default=0, ge=0, description="学生人数")
    experiment_date: date = Field(..., description="实验日期")
    waste_destination: Optional[str] = Field(None, max_length=100, description="废液去向")
    remarks: Optional[str] = Field(None, description="备注")


class CourseUsageCreate(CourseUsageBase):
    items: list[UsageItemCreate] = Field(..., min_length=1, description="领用明细")


class CourseUsageUpdate(BaseModel):
    course_name: Optional[str] = Field(None, min_length=1, max_length=200)
    class_name: Optional[str] = Field(None, max_length=100)
    student_count: Optional[int] = Field(None, ge=0)
    experiment_date: Optional[date] = None
    waste_destination: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = None


class CourseUsageRead(CourseUsageBase):
    id: int
    usage_number: str
    status: UsageStatus
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: list[UsageItemRead] = []

    class Config:
        from_attributes = True


class UsageApproval(BaseModel):
    approved: bool = Field(..., description="是否批准")
    approved_by: str = Field(..., min_length=1, max_length=100, description="审批人")
    remarks: Optional[str] = Field(None, description="审批备注")


class ReturnItemCreate(BaseModel):
    usage_item_id: int = Field(..., gt=0, description="领用明细ID")
    returned_quantity: Decimal = Field(default=0, ge=0, description="归还数量")
    waste_quantity: Decimal = Field(default=0, ge=0, description="废弃数量")
    unit: str = Field(default="ml", min_length=1, max_length=20, description="单位")
    condition: Optional[str] = Field(None, max_length=100, description="状况")
    remarks: Optional[str] = Field(None, description="备注")


class ReturnRecordCreate(BaseModel):
    course_usage_id: int = Field(..., gt=0, description="领用单ID")
    return_type: str = Field(default="归还", min_length=1, max_length=20, description="类型")
    handler: str = Field(..., min_length=1, max_length=100, description="处理人")
    waste_destination: Optional[str] = Field(None, max_length=100, description="废液去向")
    container_status: Optional[str] = Field(None, max_length=200, description="容器状态")
    remarks: Optional[str] = Field(None, description="备注")
    items: list[ReturnItemCreate] = Field(..., min_length=1, description="归还明细")


class ReturnItemRead(ReturnItemCreate):
    id: int
    return_record_id: int
    batch_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReturnRecordRead(BaseModel):
    id: int
    course_usage_id: int
    return_number: str
    return_type: str
    handler: str
    total_returned_quantity: Decimal
    total_waste_quantity: Decimal
    waste_destination: Optional[str] = None
    container_status: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime
    items: list[ReturnItemRead] = []

    class Config:
        from_attributes = True


class AuditLogRead(BaseModel):
    id: int
    action: str
    resource_type: str
    resource_id: Optional[int] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ValidationErrorItem(BaseModel):
    field: Optional[str] = None
    message: str
    code: Optional[str] = None


class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationErrorItem] = []
    warnings: list[ValidationErrorItem] = []


class ImportResult(BaseModel):
    success: bool
    total_rows: int
    valid_rows: int
    invalid_rows: int
    errors: list[ValidationErrorItem] = []
    imported_ids: list[int] = []


class RuleViolation(BaseModel):
    rule_name: str
    severity: str
    message: str
    details: dict = {}


class ApprovalCheckResult(BaseModel):
    approved: bool
    violations: list[RuleViolation] = []
    warnings: list[RuleViolation] = []


class RiskItem(BaseModel):
    reagent_name: str
    cas_number: str
    batch_number: str
    risk_type: str
    risk_level: str
    description: str
    current_quantity: Decimal
    unit: str
    expiry_date: Optional[date] = None


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    errors: Optional[list[ValidationErrorItem]] = None
