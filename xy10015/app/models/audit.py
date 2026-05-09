from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.models.base import BaseModel


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    user_id = Column(Integer, nullable=True, index=True)
    username = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    module = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    method = Column(String(20), nullable=True)
    path = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    request_data = Column(JSON, nullable=True)
    response_data = Column(JSON, nullable=True)
    status = Column(String(20), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)


class FailedTask(BaseModel):
    __tablename__ = "failed_tasks"

    task_name = Column(String(100), nullable=False, index=True)
    task_type = Column(String(50), nullable=False, index=True)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="failed", index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    last_error = Column(Text, nullable=True)
    last_failed_at = Column(DateTime, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)
    payload = Column(JSON, nullable=True)
    traceback = Column(Text, nullable=True)


class ImportExportLog(BaseModel):
    __tablename__ = "import_export_logs"

    log_type = Column(String(20), nullable=False, index=True)
    module = Column(String(50), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    total_rows = Column(Integer, nullable=True)
    success_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    skipped_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, index=True)
    error_details = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
