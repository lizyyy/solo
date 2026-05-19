from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    role = Column(String(20), default="operator")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    import_records = relationship("ImportRecord", back_populates="user")


class PrintBatch(Base):
    __tablename__ = "print_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, index=True, nullable=False)
    paper_batch = Column(String(100), nullable=False)
    product_name = Column(String(200))
    customer_info = Column(Text)
    operator_id = Column(String(50))
    cost_details = Column(Text)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    lab_records = relationship("LabRecord", back_populates="batch")
    orders = relationship("Order", back_populates="batch")
    rework_records = relationship("ReworkRecord", back_populates="batch")
    history = relationship("BatchHistory", back_populates="batch")


class LabRecord(Base):
    __tablename__ = "lab_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("print_batches.id"))
    l_value = Column(Float, nullable=False)
    a_value = Column(Float, nullable=False)
    b_value = Column(Float, nullable=False)
    delta_e = Column(Float)
    measurement_point = Column(String(100))
    measured_at = Column(DateTime(timezone=True))
    operator_id = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("PrintBatch", back_populates="lab_records")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("print_batches.id"))
    order_number = Column(String(100), unique=True, index=True)
    product_spec = Column(Text)
    quantity = Column(Integer)
    customer_info = Column(Text)
    cost_details = Column(Text)
    delivery_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("PrintBatch", back_populates="orders")


class ReworkRecord(Base):
    __tablename__ = "rework_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("print_batches.id"))
    reason = Column(Text, nullable=False)
    rework_type = Column(String(50))
    operator_id = Column(String(50))
    notes = Column(Text)
    reworked_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("PrintBatch", back_populates="rework_records")


class ErrorRecord(Base):
    __tablename__ = "error_records"

    id = Column(Integer, primary_key=True, index=True)
    import_session_id = Column(String(100), index=True)
    source_file = Column(String(255))
    row_number = Column(Integer)
    raw_data = Column(Text)
    error_type = Column(String(100))
    error_message = Column(Text)
    suggestion = Column(Text)
    status = Column(String(20), default="pending")
    resolved_by = Column(String(50))
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String(255))
    import_type = Column(String(50))
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    session_id = Column(String(100), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="import_records")


class BatchHistory(Base):
    __tablename__ = "batch_history"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("print_batches.id"))
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(String(50))
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("PrintBatch", back_populates="history")
