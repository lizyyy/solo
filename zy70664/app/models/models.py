from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    contact = Column(String(100))
    phone = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    employees = relationship("Employee", back_populates="department")
    order_records = relationship("OrderRecord", back_populates="department")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    name = Column(String(100), nullable=False)
    employee_no = Column(String(50), unique=True, nullable=False)
    default_diet_restriction = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    department = relationship("Department", back_populates="employees")
    order_records = relationship("OrderRecord", back_populates="employee")


class MealType(Base):
    __tablename__ = "meal_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    start_time = Column(String(20))
    end_time = Column(String(20))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class OrderRecord(Base):
    __tablename__ = "order_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    meal_date = Column(Date, nullable=False, index=True)
    meal_type_id = Column(Integer, ForeignKey("meal_types.id"))
    quantity = Column(Integer, default=1)
    diet_restriction = Column(Text)
    remarks = Column(Text)
    source_file = Column(String(255))
    row_number = Column(Integer)
    raw_data = Column(Text)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department", back_populates="order_records")
    employee = relationship("Employee", back_populates="order_records")
    cancellations = relationship("CancellationRecord", back_populates="order_record")
    exceptions = relationship("OrderException", back_populates="order_record")


class CancellationRecord(Base):
    __tablename__ = "cancellation_records"

    id = Column(Integer, primary_key=True, index=True)
    order_record_id = Column(Integer, ForeignKey("order_records.id"))
    batch_id = Column(String(100), index=True)
    cancel_date = Column(Date, nullable=False)
    cancel_quantity = Column(Integer, default=1)
    reason = Column(Text)
    source_file = Column(String(255))
    row_number = Column(Integer)
    raw_data = Column(Text)
    matched = Column(Boolean, default=False)
    matched_order_id = Column(Integer)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order_record = relationship("OrderRecord", back_populates="cancellations")


class OrderException(Base):
    __tablename__ = "order_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    order_record_id = Column(Integer, ForeignKey("order_records.id"))
    batch_id = Column(String(100), index=True)
    exception_type = Column(String(100))
    description = Column(Text)
    raw_data = Column(Text)
    handler = Column(String(100))
    handle_result = Column(String(50))
    handle_notes = Column(Text)
    handled_at = Column(DateTime(timezone=True))
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order_record = relationship("OrderRecord", back_populates="exceptions")


class MealReport(Base):
    __tablename__ = "meal_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(Date, nullable=False, index=True)
    meal_type_id = Column(Integer, ForeignKey("meal_types.id"))
    department_id = Column(Integer, ForeignKey("departments.id"))
    total_orders = Column(Integer, default=0)
    total_cancelled = Column(Integer, default=0)
    net_quantity = Column(Integer, default=0)
    diet_restrictions = Column(Text)
    restriction_count = Column(Integer, default=0)
    remarks = Column(Text)
    status = Column(String(50), default="draft")
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(String(100))
    confirmed_at = Column(DateTime(timezone=True))
    confirmed_by = Column(String(100))


class ProcessBatch(Base):
    __tablename__ = "process_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, nullable=False, index=True)
    batch_type = Column(String(50))
    source_file = Column(String(255))
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    exception_count = Column(Integer, default=0)
    status = Column(String(50), default="processing")
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    remarks = Column(Text)
