from typing import List, Optional
from datetime import datetime

from .config import Config
from .storage import Database
from .models import CallLog, MigrationReport, ProcessingResult
from .services import (
    IdempotencyService,
    PermissionReviewService,
    ManualConfirmationService,
    MigrationService,
)
from .utils import format_error_for_user


class PermissionReviewEngine:
    def __init__(self, config: Config = None):
        self.config = config or Config()
        self.db = Database(self.config)
        self.idempotency = IdempotencyService(self.db)
        self.review_service = PermissionReviewService(self.db, self.idempotency)
        self.confirmation_service = ManualConfirmationService(self.db)
        self.migration_service = MigrationService(
            self.db,
            self.idempotency,
            self.review_service,
            self.confirmation_service,
        )

    def process_single_log(self, call_log: CallLog) -> dict:
        try:
            self.db.save_call_log(call_log)
            result = self.review_service.process_permission_change(call_log)
            return {
                "success": result.success,
                "message": result.message,
                "details": result.details,
                "evidence_links": result.evidence_links,
            }
        except Exception as e:
            return format_error_for_user(e)

    def process_batch(
        self,
        tenant_id: str,
        batch_id: str,
        call_logs: List[CallLog],
        batch_cutoff_minutes: int = 60,
    ) -> MigrationReport:
        return self.migration_service.process_batch(
            tenant_id, batch_id, call_logs, batch_cutoff_minutes
        )

    def get_batch_report_text(self, batch_id: str) -> str:
        return self.migration_service.print_human_readable_report(batch_id)

    def get_evidence_timeline(self, record_id: str) -> Optional[dict]:
        return self.review_service.get_evidence_timeline(record_id)

    def apply_manual_correction(
        self,
        record_id: str,
        operator_id: str,
        operator_name: str,
        correction_details: dict,
        reason: str,
    ) -> dict:
        result = self.confirmation_service.apply_manual_correction(
            record_id, operator_id, operator_name, correction_details, reason
        )
        return {
            "success": result.success,
            "message": result.message,
            "details": result.details,
            "evidence_links": result.evidence_links,
        }

    def get_record_confirmations(self, record_id: str) -> list:
        return self.confirmation_service.get_confirmations_for_record(record_id)
