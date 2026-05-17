from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict, Any


class DepartmentBase(BaseModel):
    name: str
    code: str
    contact: Optional[str] = None
    phone: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class EmployeeBase(BaseModel):
    department_id: int
    name: str
    employee_no: str
    default_diet_restriction: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class Employee(EmployeeBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class MealTypeBase(BaseModel):
    name: str
    code: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    sort_order: int = 0


class MealTypeCreate(MealTypeBase):
    pass


class MealType(MealTypeBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class OrderRecordBase(BaseModel):
    batch_id: Optional[str] = None
    department_id: int
    employee_id: Optional[int] = None
    meal_date: date
    meal_type_id: int
    quantity: int = 1
    diet_restriction: Optional[str] = None
    remarks: Optional[str] = None
    source_file: Optional[str] = None
    row_number: Optional[int] = None
    raw_data: Optional[str] = None


class OrderRecordCreate(OrderRecordBase):
    pass


class OrderRecord(OrderRecordBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CancellationRecordBase(BaseModel):
    batch_id: Optional[str] = None
    order_record_id: Optional[int] = None
    cancel_date: date
    cancel_quantity: int = 1
    reason: Optional[str] = None
    source_file: Optional[str] = None
    row_number: Optional[int] = None
    raw_data: Optional[str] = None


class CancellationRecordCreate(CancellationRecordBase):
    employee_no: Optional[str] = None
    department_code: Optional[str] = None
    meal_type_code: Optional[str] = None


class CancellationRecord(CancellationRecordBase):
    id: int
    matched: bool
    matched_order_id: Optional[int]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrderExceptionBase(BaseModel):
    order_record_id: Optional[int] = None
    batch_id: Optional[str] = None
    exception_type: str
    description: str
    raw_data: Optional[str] = None


class OrderExceptionCreate(OrderExceptionBase):
    pass


class OrderExceptionHandle(BaseModel):
    handler: str
    handle_result: str
    handle_notes: Optional[str] = None


class OrderException(OrderExceptionBase):
    id: int
    handler: Optional[str]
    handle_result: Optional[str]
    handle_notes: Optional[str]
    handled_at: Optional[datetime]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MealReportBase(BaseModel):
    report_date: date
    meal_type_id: int
    department_id: int


class MealReportGenerate(BaseModel):
    report_date: date
    meal_type_id: Optional[int] = None
    department_id: Optional[int] = None


class MealReport(MealReportBase):
    id: int
    total_orders: int
    total_cancelled: int
    net_quantity: int
    diet_restrictions: Optional[str]
    restriction_count: int
    remarks: Optional[str]
    status: str
    generated_at: datetime
    generated_by: Optional[str]
    confirmed_at: Optional[datetime]
    confirmed_by: Optional[str]

    class Config:
        from_attributes = True


class ProcessBatchBase(BaseModel):
    batch_id: str
    batch_type: str
    source_file: Optional[str] = None
    created_by: Optional[str] = None


class ProcessBatch(ProcessBatchBase):
    id: int
    total_records: int
    success_count: int
    exception_count: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    remarks: Optional[str]

    class Config:
        from_attributes = True


class BatchImportResult(BaseModel):
    batch_id: str
    total_records: int
    success_count: int
    exception_count: int
    exceptions: List[Dict[str, Any]]


class CancelOffsetResult(BaseModel):
    batch_id: str
    total_cancellations: int
    matched_count: int
    unmatched_count: int
    offset_quantity: int


class DietRestrictionSummary(BaseModel):
    restriction: str
    count: int
    departments: List[str]


class ReportSummary(BaseModel):
    report_date: date
    meal_type: str
    total_orders: int
    total_cancelled: int
    net_quantity: int
    restriction_count: int
    restrictions: List[DietRestrictionSummary]
