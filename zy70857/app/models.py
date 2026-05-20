from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    filename = Column(String(255))
    import_type = Column(String(50))
    import_time = Column(DateTime(timezone=True), server_default=func.now())
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    confirm_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    status = Column(String(50), default="completed")

    records = relationship("BorrowRecord", back_populates="batch")
    import_results = relationship("ImportResult", back_populates="batch")


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_no = Column(String(100), unique=True, index=True, nullable=False)
    case_name = Column(String(255))
    case_type = Column(String(100))
    is_secret = Column(Boolean, default=False)
    secret_level = Column(String(50))
    create_date = Column(DateTime(timezone=True))
    status = Column(String(50), default="active")


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    department = Column(String(255))
    position = Column(String(100))
    permission_level = Column(Integer, default=1)
    can_access_secret = Column(Boolean, default=False)
    status = Column(String(50), default="active")


class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(100), index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    case_no = Column(String(100), index=True)
    person_id = Column(String(100), index=True)
    person_name = Column(String(100))
    borrow_date = Column(DateTime(timezone=True))
    due_date = Column(DateTime(timezone=True))
    return_date = Column(DateTime(timezone=True))
    renew_count = Column(Integer, default=0)
    action_type = Column(String(50))
    status = Column(String(50), default="pending")
    is_overdue = Column(Boolean, default=False)
    create_time = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("ImportBatch", back_populates="records")
    import_results = relationship("ImportResult", back_populates="record")

    __table_args__ = (
        Index("idx_case_person_date", "case_no", "person_id", "borrow_date"),
    )


class ImportResult(Base):
    __tablename__ = "import_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    record_id = Column(Integer, ForeignKey("borrow_records.id"))
    result_type = Column(String(50), index=True)
    rule_code = Column(String(100))
    rule_name = Column(String(255))
    message = Column(Text)
    suggestion = Column(Text)
    original_data = Column(Text)
    create_time = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("ImportBatch", back_populates="import_results")
    record = relationship("BorrowRecord", back_populates="import_results")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), index=True)
    batch_id = Column(String(100), index=True)
    record_no = Column(String(100))
    operator = Column(String(100))
    details = Column(Text)
    create_time = Column(DateTime(timezone=True), server_default=func.now())