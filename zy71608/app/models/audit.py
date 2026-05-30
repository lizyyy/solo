from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import BaseModel


class AuditLog(Base, BaseModel):
    __tablename__ = "audit_logs"

    application_id = Column(Integer, ForeignKey("reduction_applications.id"))
    operation_type = Column(String(50), nullable=False)
    operator = Column(String(50), nullable=False)
    table_name = Column(String(50))
    record_id = Column(Integer)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    old_values = Column(JSON)
    new_values = Column(JSON)
    change_reason = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(200))
    remarks = Column(Text)

    application = relationship("ReductionApplication", back_populates="audit_logs")


class ImportRecord(Base, BaseModel):
    __tablename__ = "import_records"

    file_name = Column(String(200), nullable=False)
    document_type = Column(String(50))
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    error_rows = Column(Integer, default=0)
    warning_rows = Column(Integer, default=0)
    duplicate_rows = Column(Integer, default=0)
    empty_columns_removed = Column(Integer, default=0)
    errors_details = Column(Text)
    warnings_details = Column(Text)
    imported_by = Column(String(50))
    sheet_name = Column(String(100))
    encoding = Column(String(20))
