from datetime import date, datetime, time
from enum import Enum as PyEnum
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanStatus(str, PyEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    WITHDRAWN = "withdrawn"


class RiskLevel(str, PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    grade: Mapped[str] = mapped_column(String(20))
    class_name: Mapped[Optional[str]] = mapped_column(String(50))
    gender: Mapped[Optional[str]] = mapped_column(String(10))
    is_young_grade: Mapped[bool] = mapped_column(Boolean, default=False)
    needs_special_care: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_phone: Mapped[Optional[str]] = mapped_column(String(20))
    home_address: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    authorizations: Mapped[List["Authorization"]] = relationship(
        "Authorization", back_populates="student"
    )
    default_stop_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stops.id"), nullable=True
    )
    default_stop: Mapped[Optional["Stop"]] = relationship(
        "Stop", foreign_keys=[default_stop_id]
    )


class Stop(Base):
    __tablename__ = "stops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    stop_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    direction: Mapped[str] = mapped_column(String(20), default="morning")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    route_stops: Mapped[List["RouteStop"]] = relationship(
        "RouteStop", back_populates="route"
    )


class RouteStop(Base):
    __tablename__ = "route_stops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"))
    stop_id: Mapped[int] = mapped_column(Integer, ForeignKey("stops.id"))
    sequence: Mapped[int] = mapped_column(Integer)
    arrival_time: Mapped[Optional[time]] = mapped_column(Time)
    departure_time: Mapped[Optional[time]] = mapped_column(Time)
    time_window_start: Mapped[Optional[time]] = mapped_column(Time)
    time_window_end: Mapped[Optional[time]] = mapped_column(Time)

    route: Mapped["Route"] = relationship("Route", back_populates="route_stops")
    stop: Mapped["Stop"] = relationship("Stop")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vehicle_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    plate_number: Mapped[str] = mapped_column(String(20))
    capacity: Mapped[int] = mapped_column(Integer)
    vehicle_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="active")
    last_inspection_date: Mapped[Optional[date]] = mapped_column(Date)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    driver_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    id_card: Mapped[Optional[str]] = mapped_column(String(20))
    license_number: Mapped[str] = mapped_column(String(50))
    license_type: Mapped[str] = mapped_column(String(20))
    license_expiry_date: Mapped[date] = mapped_column(Date)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="active")
    qualification_expiry_date: Mapped[Optional[date]] = mapped_column(Date)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Authorization(Base):
    __tablename__ = "authorizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id"))
    guardian_name: Mapped[str] = mapped_column(String(100))
    guardian_phone: Mapped[str] = mapped_column(String(20))
    guardian_relationship: Mapped[str] = mapped_column(String(50))
    authorization_expiry_date: Mapped[date] = mapped_column(Date)
    is_authorized_for_pickup: Mapped[bool] = mapped_column(Boolean, default=True)
    is_authorized_for_dropoff: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    student: Mapped["Student"] = relationship("Student", back_populates="authorizations")


class RouteChangePlan(Base):
    __tablename__ = "route_change_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(Text)
    reason_category: Mapped[str] = mapped_column(String(50), default="other")
    status: Mapped[PlanStatus] = mapped_column(Enum(PlanStatus), default=PlanStatus.DRAFT)
    effective_date: Mapped[date] = mapped_column(Date)
    created_by: Mapped[Optional[str]] = mapped_column(String(100))
    submitted_by: Mapped[Optional[str]] = mapped_column(String(100))
    approved_by: Mapped[Optional[str]] = mapped_column(String(100))
    published_by: Mapped[Optional[str]] = mapped_column(String(100))
    withdrawn_by: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    vehicle_assignments: Mapped[List["PlanVehicleAssignment"]] = relationship(
        "PlanVehicleAssignment", back_populates="plan"
    )
    risk_reports: Mapped[List["RiskReport"]] = relationship(
        "RiskReport", back_populates="plan"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog", back_populates="plan"
    )


class PlanVehicleAssignment(Base):
    __tablename__ = "plan_vehicle_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("route_change_plans.id"))
    vehicle_id: Mapped[int] = mapped_column(Integer, ForeignKey("vehicles.id"))
    driver_id: Mapped[int] = mapped_column(Integer, ForeignKey("drivers.id"))
    attendant_teacher: Mapped[Optional[str]] = mapped_column(String(100))
    attendant_teacher_phone: Mapped[Optional[str]] = mapped_column(String(20))
    trip_direction: Mapped[str] = mapped_column(String(20), default="morning")
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped["RouteChangePlan"] = relationship(
        "RouteChangePlan", back_populates="vehicle_assignments"
    )
    vehicle: Mapped["Vehicle"] = relationship("Vehicle")
    driver: Mapped["Driver"] = relationship("Driver")
    stop_assignments: Mapped[List["PlanStopAssignment"]] = relationship(
        "PlanStopAssignment", back_populates="vehicle_assignment"
    )
    student_assignments: Mapped[List["PlanStudentAssignment"]] = relationship(
        "PlanStudentAssignment", back_populates="vehicle_assignment"
    )


class PlanStopAssignment(Base):
    __tablename__ = "plan_stop_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vehicle_assignment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plan_vehicle_assignments.id")
    )
    stop_id: Mapped[int] = mapped_column(Integer, ForeignKey("stops.id"))
    sequence: Mapped[int] = mapped_column(Integer)
    estimated_arrival_time: Mapped[Optional[time]] = mapped_column(Time)
    time_window_start: Mapped[Optional[time]] = mapped_column(Time)
    time_window_end: Mapped[Optional[time]] = mapped_column(Time)
    is_added: Mapped[bool] = mapped_column(Boolean, default=False)
    is_removed: Mapped[bool] = mapped_column(Boolean, default=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text)

    vehicle_assignment: Mapped["PlanVehicleAssignment"] = relationship(
        "PlanVehicleAssignment", back_populates="stop_assignments"
    )
    stop: Mapped["Stop"] = relationship("Stop")


class PlanStudentAssignment(Base):
    __tablename__ = "plan_student_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vehicle_assignment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plan_vehicle_assignments.id")
    )
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id"))
    pickup_stop_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("stops.id"))
    dropoff_stop_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("stops.id"))
    authorized_guardian_name: Mapped[Optional[str]] = mapped_column(String(100))
    needs_handover_record: Mapped[bool] = mapped_column(Boolean, default=False)
    has_handover_record: Mapped[bool] = mapped_column(Boolean, default=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text)

    vehicle_assignment: Mapped["PlanVehicleAssignment"] = relationship(
        "PlanVehicleAssignment", back_populates="student_assignments"
    )
    student: Mapped["Student"] = relationship("Student")
    pickup_stop: Mapped[Optional["Stop"]] = relationship(
        "Stop", foreign_keys=[pickup_stop_id]
    )
    dropoff_stop: Mapped[Optional["Stop"]] = relationship(
        "Stop", foreign_keys=[dropoff_stop_id]
    )


class RiskReport(Base):
    __tablename__ = "risk_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("route_change_plans.id"))
    check_type: Mapped[str] = mapped_column(String(100))
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    affected_entities: Mapped[Optional[str]] = mapped_column(Text)
    suggestion: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plan: Mapped["RouteChangePlan"] = relationship(
        "RouteChangePlan", back_populates="risk_reports"
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("route_change_plans.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100))
    actor: Mapped[str] = mapped_column(String(100))
    details: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plan: Mapped[Optional["RouteChangePlan"]] = relationship(
        "RouteChangePlan", back_populates="audit_logs"
    )
