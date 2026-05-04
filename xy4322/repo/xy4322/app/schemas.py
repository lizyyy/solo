from datetime import date, datetime, time
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class PlanStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    WITHDRAWN = "withdrawn"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class StudentBase(BaseModel):
    student_no: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    grade: str = Field(..., max_length=20)
    class_name: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, max_length=10)
    is_young_grade: bool = False
    needs_special_care: bool = False
    parent_phone: Optional[str] = Field(None, max_length=20)
    home_address: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    grade: Optional[str] = None
    class_name: Optional[str] = None
    gender: Optional[str] = None
    is_young_grade: Optional[bool] = None
    needs_special_care: Optional[bool] = None
    parent_phone: Optional[str] = None
    home_address: Optional[str] = None


class Student(StudentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StopBase(BaseModel):
    stop_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    is_active: bool = True


class StopCreate(StopBase):
    pass


class StopUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class Stop(StopBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RouteStopBase(BaseModel):
    stop_id: int
    sequence: int
    arrival_time: Optional[time] = None
    departure_time: Optional[time] = None
    time_window_start: Optional[time] = None
    time_window_end: Optional[time] = None


class RouteStopCreate(RouteStopBase):
    pass


class RouteStop(RouteStopBase):
    id: int
    stop: Optional[Stop] = None

    class Config:
        from_attributes = True


class RouteBase(BaseModel):
    route_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    direction: str = "morning"
    is_active: bool = True


class RouteCreate(RouteBase):
    route_stops: List[RouteStopCreate] = []


class RouteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    direction: Optional[str] = None
    is_active: Optional[bool] = None


class Route(RouteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    route_stops: List[RouteStop] = []

    class Config:
        from_attributes = True


class VehicleBase(BaseModel):
    vehicle_no: str = Field(..., max_length=50)
    plate_number: str = Field(..., max_length=20)
    capacity: int
    vehicle_type: str = Field(..., max_length=50)
    status: str = "active"
    last_inspection_date: Optional[date] = None
    description: Optional[str] = None


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate_number: Optional[str] = None
    capacity: Optional[int] = None
    vehicle_type: Optional[str] = None
    status: Optional[str] = None
    last_inspection_date: Optional[date] = None
    description: Optional[str] = None


class Vehicle(VehicleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DriverBase(BaseModel):
    driver_no: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    id_card: Optional[str] = Field(None, max_length=20)
    license_number: str = Field(..., max_length=50)
    license_type: str = Field(..., max_length=20)
    license_expiry_date: date
    phone: Optional[str] = Field(None, max_length=20)
    status: str = "active"
    qualification_expiry_date: Optional[date] = None
    description: Optional[str] = None


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    id_card: Optional[str] = None
    license_number: Optional[str] = None
    license_type: Optional[str] = None
    license_expiry_date: Optional[date] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    qualification_expiry_date: Optional[date] = None
    description: Optional[str] = None


class Driver(DriverBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuthorizationBase(BaseModel):
    student_id: int
    guardian_name: str = Field(..., max_length=100)
    guardian_phone: str = Field(..., max_length=20)
    guardian_relationship: str = Field(..., max_length=50)
    authorization_expiry_date: date
    is_authorized_for_pickup: bool = True
    is_authorized_for_dropoff: bool = True
    is_active: bool = True


class AuthorizationCreate(AuthorizationBase):
    pass


class AuthorizationUpdate(BaseModel):
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relationship: Optional[str] = None
    authorization_expiry_date: Optional[date] = None
    is_authorized_for_pickup: Optional[bool] = None
    is_authorized_for_dropoff: Optional[bool] = None
    is_active: Optional[bool] = None


class Authorization(AuthorizationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlanStudentAssignmentBase(BaseModel):
    student_id: int
    pickup_stop_id: Optional[int] = None
    dropoff_stop_id: Optional[int] = None
    authorized_guardian_name: Optional[str] = None
    needs_handover_record: bool = False
    has_handover_record: bool = True
    remarks: Optional[str] = None


class PlanStudentAssignmentCreate(PlanStudentAssignmentBase):
    pass


class PlanStudentAssignment(PlanStudentAssignmentBase):
    id: int
    student: Optional[Student] = None
    pickup_stop: Optional[Stop] = None
    dropoff_stop: Optional[Stop] = None

    class Config:
        from_attributes = True


class PlanStopAssignmentBase(BaseModel):
    stop_id: int
    sequence: int
    estimated_arrival_time: Optional[time] = None
    time_window_start: Optional[time] = None
    time_window_end: Optional[time] = None
    is_added: bool = False
    is_removed: bool = False
    remarks: Optional[str] = None


class PlanStopAssignmentCreate(PlanStopAssignmentBase):
    pass


class PlanStopAssignment(PlanStopAssignmentBase):
    id: int
    stop: Optional[Stop] = None

    class Config:
        from_attributes = True


class PlanVehicleAssignmentBase(BaseModel):
    vehicle_id: int
    driver_id: int
    attendant_teacher: Optional[str] = None
    attendant_teacher_phone: Optional[str] = None
    trip_direction: str = "morning"
    sequence: int = 0


class PlanVehicleAssignmentCreate(PlanVehicleAssignmentBase):
    stop_assignments: List[PlanStopAssignmentCreate] = []
    student_assignments: List[PlanStudentAssignmentCreate] = []


class PlanVehicleAssignment(PlanVehicleAssignmentBase):
    id: int
    vehicle: Optional[Vehicle] = None
    driver: Optional[Driver] = None
    stop_assignments: List[PlanStopAssignment] = []
    student_assignments: List[PlanStudentAssignment] = []

    class Config:
        from_attributes = True


class RouteChangePlanBase(BaseModel):
    title: str = Field(..., max_length=200)
    reason: str
    reason_category: str = "other"
    effective_date: date


class RouteChangePlanCreate(RouteChangePlanBase):
    created_by: Optional[str] = None
    vehicle_assignments: List[PlanVehicleAssignmentCreate] = []


class RouteChangePlanUpdate(BaseModel):
    title: Optional[str] = None
    reason: Optional[str] = None
    reason_category: Optional[str] = None
    effective_date: Optional[date] = None


class RouteChangePlan(RouteChangePlanBase):
    id: int
    plan_no: str
    status: PlanStatus
    created_by: Optional[str] = None
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    published_by: Optional[str] = None
    withdrawn_by: Optional[str] = None
    created_at: datetime
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    withdrawn_at: Optional[datetime] = None
    updated_at: datetime
    vehicle_assignments: List[PlanVehicleAssignment] = []

    class Config:
        from_attributes = True


class RiskReportBase(BaseModel):
    check_type: str
    risk_level: RiskLevel
    title: str
    description: str
    affected_entities: Optional[str] = None
    suggestion: Optional[str] = None


class RiskReport(RiskReportBase):
    id: Optional[int] = None
    plan_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ValidationResult(BaseModel):
    valid: bool
    risk_reports: List[RiskReport]
    summary: str


class AuditLogBase(BaseModel):
    action: str
    actor: str
    details: Optional[str] = None


class AuditLog(AuditLogBase):
    id: int
    plan_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    imported_count: int
    errors: List[str] = []
    message: str


class BatchImportData(BaseModel):
    students: List[StudentCreate] = []
    stops: List[StopCreate] = []
    routes: List[RouteCreate] = []
    vehicles: List[VehicleCreate] = []
    drivers: List[DriverCreate] = []
    authorizations: List[AuthorizationCreate] = []
