from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ErrorResponse(BaseModel):
    error_code: str
    error_type: str
    message: str
    details: Optional[dict] = None


class CourseBase(BaseModel):
    name: str
    description: Optional[str] = None
    course_date: datetime
    max_students: int


class CourseCreate(CourseBase):
    pass


class Course(CourseBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StudentBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class Student(StudentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialKitBase(BaseModel):
    name: str
    description: Optional[str] = None
    unit: str
    total_quantity: int = 0
    warning_threshold: int = 10


class MaterialKitCreate(MaterialKitBase):
    pass


class MaterialKitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    total_quantity: Optional[int] = None
    warning_threshold: Optional[int] = None


class MaterialKit(MaterialKitBase):
    id: int
    reserved_quantity: int
    available_quantity: int
    created_at: datetime

    class Config:
        from_attributes = True


class CourseMaterialKitBase(BaseModel):
    course_id: int
    material_kit_id: int
    quantity_per_student: int = 1


class CourseMaterialKitCreate(CourseMaterialKitBase):
    pass


class CourseMaterialKit(CourseMaterialKitBase):
    id: int
    material_kit: Optional[MaterialKit] = None

    class Config:
        from_attributes = True


class RegistrationBase(BaseModel):
    course_id: int
    student_id: int
    notes: Optional[str] = None


class RegistrationCreate(RegistrationBase):
    pass


class Registration(RegistrationBase):
    id: int
    status: str
    registered_at: datetime
    cancelled_at: Optional[datetime] = None
    student: Optional[Student] = None
    course: Optional[Course] = None

    class Config:
        from_attributes = True


class DropRecordBase(BaseModel):
    registration_id: int
    drop_type: str
    reason: Optional[str] = None
    transferred_to_course_id: Optional[int] = None
    needs_review: bool = False


class DropRecordCreate(DropRecordBase):
    pass


class DropRecord(DropRecordBase):
    id: int
    course_id: int
    student_id: int
    reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StockRecordBase(BaseModel):
    material_kit_id: int
    change_type: str
    change_quantity: int
    notes: Optional[str] = None


class StockRecordCreate(StockRecordBase):
    pass


class StockRecord(StockRecordBase):
    id: int
    previous_quantity: int
    new_quantity: int
    related_registration_id: Optional[int] = None
    related_drop_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PreparationReportBase(BaseModel):
    course_id: int
    generated_by: str


class PreparationReportCreate(PreparationReportBase):
    pass


class PreparationReport(PreparationReportBase):
    id: int
    report_date: datetime
    total_registered: int
    total_dropped: int
    net_registered: int
    materials_summary: str
    has_warnings: bool
    warning_details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransferCourseRequest(BaseModel):
    registration_id: int
    target_course_id: int
    reason: Optional[str] = None


class MaterialWarning(BaseModel):
    material_kit_id: int
    material_name: str
    available_quantity: int
    required_quantity: int
    shortage: int
    warning_level: str


class PreparationReportExport(BaseModel):
    report: PreparationReport
    material_warnings: List[MaterialWarning]


class ApiResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None
