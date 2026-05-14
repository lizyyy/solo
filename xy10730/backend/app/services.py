from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from . import models, schemas
from .models import HealthStatus, CheckStatus


class HealthCheckService:
    @staticmethod
    def determine_health_status(probe_result: dict, dependency_result: dict) -> HealthStatus:
        probe_success = probe_result.get("success", False) if probe_result else True
        dep_success = dependency_result.get("success", False) if dependency_result else True

        if not probe_success or not dep_success:
            probe_errors = probe_result.get("errors", []) if probe_result else []
            dep_errors = dependency_result.get("errors", []) if dependency_result else []

            total_errors = len(probe_errors) + len(dep_errors)
            if total_errors >= 3:
                return HealthStatus.CRITICAL
            elif total_errors >= 1:
                return HealthStatus.ERROR
            else:
                return HealthStatus.WARNING
        return HealthStatus.HEALTHY

    @staticmethod
    def determine_check_status(health_status: HealthStatus, retry_count: int = 0) -> CheckStatus:
        if health_status == HealthStatus.HEALTHY:
            return CheckStatus.SUCCESS
        elif health_status in [HealthStatus.ERROR, HealthStatus.CRITICAL]:
            if retry_count < 3:
                return CheckStatus.RETRYABLE
            return CheckStatus.PENDING_REVIEW
        else:
            return CheckStatus.PENDING_REVIEW

    @staticmethod
    def determine_fault_level(probe_result: dict, dependency_result: dict) -> str:
        probe_errors = probe_result.get("errors", []) if probe_result else []
        dep_errors = dependency_result.get("errors", []) if dependency_result else []

        has_timeout = any("timeout" in str(e).lower() for e in probe_errors + dep_errors)
        has_connection = any("connection" in str(e).lower() for e in probe_errors + dep_errors)

        if has_timeout:
            return "timeout"
        elif has_connection:
            return "connection_error"
        elif probe_errors and dep_errors:
            return "multiple_faults"
        elif probe_errors:
            return "probe_fault"
        elif dep_errors:
            return "dependency_fault"
        return "unknown"


class IdempotencyService:
    @staticmethod
    def check_idempotent(db: Session, request_id: str) -> Optional[models.HealthRecord]:
        return db.query(models.HealthRecord).filter(
            models.HealthRecord.request_id == request_id
        ).first()

    @staticmethod
    def mark_idempotent(db: Session, record: models.HealthRecord) -> models.HealthRecord:
        record.is_idempotent = True
        db.commit()
        db.refresh(record)
        return record


class HealthRecordService:
    @staticmethod
    def create_health_record(
        db: Session,
        record_data: schemas.HealthCheckRequest
    ) -> models.HealthRecord:
        existing_record = IdempotencyService.check_idempotent(db, record_data.request_id)
        if existing_record:
            existing_record.retry_count += 1
            db.commit()
            db.refresh(existing_record)
            return existing_record

        health_status = HealthCheckService.determine_health_status(
            record_data.probe_result,
            record_data.dependency_check_result
        )

        fault_level = HealthCheckService.determine_fault_level(
            record_data.probe_result,
            record_data.dependency_check_result
        )

        check_status = HealthCheckService.determine_check_status(health_status)

        error_details = []
        if record_data.probe_result:
            probe_errors = record_data.probe_result.get("errors", [])
            if probe_errors:
                error_details.append(f"探活错误: {', '.join(map(str, probe_errors))}")
        
        if record_data.dependency_check_result:
            dep_errors = record_data.dependency_check_result.get("errors", [])
            if dep_errors:
                error_details.append(f"依赖错误: {', '.join(map(str, dep_errors))}")

        db_record = models.HealthRecord(
            service_id=record_data.service_id,
            request_id=record_data.request_id,
            health_status=health_status,
            check_status=check_status,
            probe_result=record_data.probe_result,
            dependency_check_result=record_data.dependency_check_result,
            error_details="\n".join(error_details) if error_details else None,
            fault_level=fault_level,
            is_idempotent=False,
            retry_count=0
        )

        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        return db_record

    @staticmethod
    def review_record(
        db: Session,
        record_id: int,
        review_data: schemas.HealthRecordReview
    ) -> models.HealthRecord:
        record = db.query(models.HealthRecord).filter(
            models.HealthRecord.id == record_id
        ).first()

        if not record:
            return None

        record.reviewed = True
        record.reviewed_by = review_data.reviewed_by
        record.reviewed_at = datetime.utcnow()
        record.review_comment = review_data.review_comment

        if review_data.check_status:
            record.check_status = review_data.check_status

        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def confirm_recovery(
        db: Session,
        record_id: int,
        confirm_data: schemas.HealthRecordConfirmRecovery
    ) -> models.HealthRecord:
        record = db.query(models.HealthRecord).filter(
            models.HealthRecord.id == record_id
        ).first()

        if not record:
            return None

        record.recovery_confirmed = True
        record.confirmed_by = confirm_data.confirmed_by
        record.confirmed_at = datetime.utcnow()
        record.review_comment = (record.review_comment or "") + \
            (f"\n恢复确认: {confirm_data.review_comment}" if confirm_data.review_comment else "")

        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_records(
        db: Session,
        filters: schemas.FilterParams
    ):
        query = db.query(models.HealthRecord).join(models.Service)

        if filters.service_id:
            query = query.filter(models.HealthRecord.service_id == filters.service_id)
        if filters.health_status:
            query = query.filter(models.HealthRecord.health_status == filters.health_status)
        if filters.check_status:
            query = query.filter(models.HealthRecord.check_status == filters.check_status)
        if filters.start_time:
            query = query.filter(models.HealthRecord.check_time >= filters.start_time)
        if filters.end_time:
            query = query.filter(models.HealthRecord.check_time <= filters.end_time)
        if filters.reviewed is not None:
            query = query.filter(models.HealthRecord.reviewed == filters.reviewed)

        total = query.count()

        records = query.order_by(models.HealthRecord.check_time.desc())\
            .offset((filters.page - 1) * filters.page_size)\
            .limit(filters.page_size)\
            .all()

        return records, total


class ServiceCRUD:
    @staticmethod
    def create_service(db: Session, service: schemas.ServiceCreate) -> models.Service:
        db_service = models.Service(**service.model_dump())
        db.add(db_service)
        db.commit()
        db.refresh(db_service)
        return db_service

    @staticmethod
    def get_services(db: Session, skip: int = 0, limit: int = 100):
        return db.query(models.Service).offset(skip).limit(limit).all()

    @staticmethod
    def get_service(db: Session, service_id: int):
        return db.query(models.Service).filter(models.Service.id == service_id).first()

    @staticmethod
    def update_service(db: Session, service_id: int, service_data: schemas.ServiceUpdate):
        service = db.query(models.Service).filter(models.Service.id == service_id).first()
        if service:
            for key, value in service_data.model_dump(exclude_unset=True).items():
                setattr(service, key, value)
            db.commit()
            db.refresh(service)
        return service


class DutyReportCRUD:
    @staticmethod
    def create_report(db: Session, report: schemas.DutyReportCreate):
        db_report = models.DutyReport(**report.model_dump())
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        return db_report

    @staticmethod
    def handle_report(db: Session, report_id: int, handle_data: schemas.DutyReportHandle):
        report = db.query(models.DutyReport).filter(models.DutyReport.id == report_id).first()
        if report:
            report.handler = handle_data.handler
            report.handle_status = handle_data.handle_status
            report.handle_time = datetime.utcnow()
            report.handle_comment = handle_data.handle_comment
            db.commit()
            db.refresh(report)
        return report
