from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class StudentBase(BaseModel):
    student_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class Student(StudentBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class CourseSessionBase(BaseModel):
    session_code: str
    course_name: str
    session_date: datetime
    total_hours: float = 4.0
    required_attendance_rate: float = 0.8


class CourseSessionCreate(CourseSessionBase):
    pass


class CourseSession(CourseSessionBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class AttendanceRecordBase(BaseModel):
    session_code: str
    student_id: str
    sign_in_time: datetime
    sign_out_time: Optional[datetime] = None
    status: str = "present"
    source: str = "machine"


class AttendanceRecordCreate(AttendanceRecordBase):
    pass


class AttendanceRecord(AttendanceRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class MakeUpSignBase(BaseModel):
    session_code: str
    student_id: str
    teacher_id: str
    teacher_name: str
    reason: str
    sign_date: datetime
    status: str = "pending"


class MakeUpSignCreate(MakeUpSignBase):
    pass


class MakeUpSign(MakeUpSignBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ConflictRecordBase(BaseModel):
    session_id: int
    student_id: int
    conflict_type: str
    conflict_reason: str


class ConflictResolve(BaseModel):
    resolved_by: str
    resolution: str
    choose_makeup: bool = True


class ConflictRecord(ConflictRecordBase):
    id: int
    attendance_record_id: Optional[int] = None
    make_up_sign_id: Optional[int] = None
    status: str
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    original_attendance_data: Optional[str] = None
    original_makeup_data: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class GraduationReportBase(BaseModel):
    session_code: str
    student_id: str


class GraduationReportGenerate(BaseModel):
    session_code: Optional[str] = None
    student_id: Optional[str] = None
    generated_by: Optional[str] = None


class GraduationReport(GraduationReportBase):
    id: int
    total_sessions: int
    attended_sessions: int
    attendance_rate: float
    make_up_count: int
    conflict_count: int
    is_eligible: bool
    eligibility_reason: str
    generated_at: datetime
    generated_by: Optional[str] = None

    class Config:
        orm_mode = True


class ExceptionLogBase(BaseModel):
    operation_type: str
    original_input: str
    handler: str
    conclusion: str
    error_message: Optional[str] = None


class ExceptionLogCreate(ExceptionLogBase):
    pass


class AttendanceStats(BaseModel):
    student_id: str
    student_name: str
    total_sessions: int
    machine_attended: int
    makeup_attended: int
    total_attended: int
    attendance_rate: float
    conflict_count: int
    is_eligible: bool


class MergeResult(BaseModel):
    student_id: str
    session_code: str
    final_status: str
    conflict_detected: bool
    conflict_id: Optional[int] = None
    message: str


class ExportRequest(BaseModel):
    session_code: Optional[str] = None
    student_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    export_format: str = "json"
