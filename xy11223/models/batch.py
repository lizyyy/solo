from sqlalchemy import Column, String, DateTime, Integer, Text, JSON
from datetime import datetime
from database import Base
from models.enums import OperationStatus


class BatchOperation(Base):
    __tablename__ = "batch_operations"

    id = Column(String, primary_key=True, index=True)
    operation_type = Column(String, nullable=False, index=True)
    file_name = Column(String)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String, default=OperationStatus.PENDING)
    operator_id = Column(String, index=True)
    operator_name = Column(String)
    error_details = Column(JSON)
    success_ids = Column(JSON)
    failed_rows = Column(JSON)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def mark_success(self):
        self.status = OperationStatus.SUCCESS
        self.completed_at = datetime.utcnow()

    def mark_failed(self, error_details: dict = None):
        self.status = OperationStatus.FAILED
        self.completed_at = datetime.utcnow()
        if error_details:
            self.error_details = error_details

    def mark_partial(self):
        self.status = OperationStatus.PARTIAL
        self.completed_at = datetime.utcnow()

    def add_success(self, record_id: str):
        if not self.success_ids:
            self.success_ids = []
        self.success_ids.append(record_id)
        self.success_count = len(self.success_ids)

    def add_failed(self, row_number: int, error_message: str):
        if not self.failed_rows:
            self.failed_rows = []
        self.failed_rows.append({
            "row": row_number,
            "error": error_message
        })
        self.failed_count = len(self.failed_rows)

    def to_dict(self):
        return {
            "id": self.id,
            "operation_type": self.operation_type,
            "file_name": self.file_name,
            "total_count": self.total_count,
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "status": self.status,
            "operator_id": self.operator_id,
            "operator_name": self.operator_name,
            "success_ids": self.success_ids,
            "failed_rows": self.failed_rows,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }
