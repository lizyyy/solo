from datetime import datetime
from typing import Optional, Any
from sqlalchemy.orm import Session

from app.models.audit import AuditLog, ImportExportLog


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        user_id: Optional[int],
        username: Optional[str],
        action: str,
        module: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        method: Optional[str] = None,
        path: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_data: Optional[dict] = None,
        response_data: Optional[dict] = None,
        status: str = "success",
        duration_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> AuditLog:
        log = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            module=module,
            resource_type=resource_type,
            resource_id=resource_id,
            method=method,
            path=path,
            ip_address=ip_address,
            user_agent=user_agent,
            request_data=request_data,
            response_data=response_data,
            status=status,
            duration_ms=duration_ms,
            error_message=error_message,
            created_by=user_id
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def log_import(
        db: Session,
        module: str,
        file_name: str,
        file_size: Optional[int] = None,
        total_rows: Optional[int] = None,
        success_count: int = 0,
        failed_count: int = 0,
        skipped_count: int = 0,
        status: str = "processing",
        error_details: Optional[list] = None,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None
    ) -> ImportExportLog:
        log = ImportExportLog(
            log_type="import",
            module=module,
            file_name=file_name,
            file_size=file_size,
            total_rows=total_rows,
            success_count=success_count,
            failed_count=failed_count,
            skipped_count=skipped_count,
            status=status,
            error_details=error_details,
            started_at=started_at,
            completed_at=completed_at
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def log_export(
        db: Session,
        module: str,
        file_name: str,
        file_size: Optional[int] = None,
        total_rows: Optional[int] = None,
        success_count: int = 0,
        failed_count: int = 0,
        status: str = "processing",
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None
    ) -> ImportExportLog:
        log = ImportExportLog(
            log_type="export",
            module=module,
            file_name=file_name,
            file_size=file_size,
            total_rows=total_rows,
            success_count=success_count,
            failed_count=failed_count,
            status=status,
            started_at=started_at,
            completed_at=completed_at
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def update_import_export_log(
        db: Session,
        log_id: int,
        success_count: Optional[int] = None,
        failed_count: Optional[int] = None,
        skipped_count: Optional[int] = None,
        status: Optional[str] = None,
        error_details: Optional[list] = None,
        completed_at: Optional[datetime] = None
    ) -> bool:
        log = db.query(ImportExportLog).filter(ImportExportLog.id == log_id).first()
        if not log:
            return False

        if success_count is not None:
            log.success_count = success_count
        if failed_count is not None:
            log.failed_count = failed_count
        if skipped_count is not None:
            log.skipped_count = skipped_count
        if status is not None:
            log.status = status
        if error_details is not None:
            log.error_details = error_details
        if completed_at is not None:
            log.completed_at = completed_at

        db.commit()
        return True
