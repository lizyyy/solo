from typing import List, Dict, Tuple, Optional
from .services.import_service import ImportService
from .services.boundary_rules import BoundaryRuleService
from .services.workflow import WorkflowService
from .models.enums import UserRole, TemperatureUnit, ProcessingStatus
from .models.photo import WorkingConditionPhoto
from .services.boundary_rules import BOUNDARY_RULES_DOC


class BalanceWheelErrorApp:
    def __init__(self):
        self.import_service = ImportService()
        self.boundary_service = BoundaryRuleService()
        self.workflow_service = WorkflowService(self.boundary_service)

    def import_photos(
        self, rows: List[Dict], source_file: str, operator: UserRole = UserRole.OPERATOR
    ) -> Dict:
        batch, skipped = self.import_service.import_photos_from_rows(
            rows, source_file, operator
        )
        photos = list(batch.photos.values())
        for p in photos:
            self.workflow_service.step1_import_complete(p, operator)

        summary = self.workflow_service.get_batch_workflow_summary(photos)
        return {
            "batch_id": batch.batch_id,
            "imported_count": batch.total_count,
            "skipped_duplicates": skipped,
            "workflow_summary": summary,
        }

    def reimport_photos(
        self,
        rows: List[Dict],
        source_file: str,
        existing_batch_id: str,
        operator: UserRole = UserRole.LIN_TEACHER,
    ) -> Dict:
        batch, updated, skipped = self.import_service.reimport_same_batch(
            rows, source_file, existing_batch_id, operator
        )
        photos = list(batch.photos.values())
        summary = self.workflow_service.get_batch_workflow_summary(photos)
        return {
            "batch_id": batch.batch_id,
            "total_count": batch.total_count,
            "updated_photos": updated,
            "skipped_duplicates": skipped,
            "workflow_summary": summary,
        }

    def lin_teacher_add_remark(
        self, photo_id: str, remark: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        ok, msg = self.workflow_service.step2_lin_teacher_add_remark(
            photo, remark, UserRole.LIN_TEACHER
        )
        if ok:
            summary = self.workflow_service.get_workflow_summary(photo)
            return True, msg, summary
        return False, msg, None

    def coach_fix_mixed_units(
        self, photo_id: str, final_unit: TemperatureUnit, remark: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        ok, msg = self.boundary_service.coach_fix_mixed_units(
            photo, final_unit, remark, UserRole.COACH
        )
        if ok:
            summary = self.workflow_service.get_workflow_summary(photo)
            return True, msg, summary
        return False, msg, None

    def coach_update_report(
        self, photo_id: str, report_content: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        ok, msg = self.workflow_service.step3_update_report(
            photo, report_content, UserRole.COACH
        )
        if ok:
            summary = self.workflow_service.get_workflow_summary(photo)
            return True, msg, summary
        return False, msg, None

    def coach_rollback(
        self, photo_id: str, target_version: int, remark: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        ok, msg = self.boundary_service.rollback_to_version(
            photo, target_version, UserRole.COACH, remark
        )
        if ok:
            summary = self.workflow_service.get_workflow_summary(photo)
            return True, msg, summary
        return False, msg, None

    def get_photo_audit_trail(self, photo_id: str) -> Tuple[bool, str, Optional[List[Dict]]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        trail = self.boundary_service.get_audit_trail(photo)
        return True, "OK", trail

    def compare_photo_versions(
        self, photo_id: str, v1: int, v2: int
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        result = self.boundary_service.compare_versions(photo, v1, v2)
        if result:
            return True, "OK", result
        return False, "Invalid version numbers", None

    def get_photo_details(self, photo_id: str) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        summary = self.workflow_service.get_workflow_summary(photo)
        details = {
            **summary,
            "original_row_number": photo.original_row_number,
            "temperature_raw": photo.temperature_raw,
            "temperature_value": photo.temperature_value,
            "temperature_unit": photo.temperature_unit.value,
            "has_mixed_units": photo.has_mixed_units,
            "balance_wheel_error": photo.balance_wheel_error,
            "handwritten_remark": photo.handwritten_remark,
            "report_content": photo.report_content,
            "version_count": photo.version,
            "change_history": self.boundary_service.get_audit_trail(photo),
        }
        return True, "OK", details

    def get_pending_coach_review(self) -> List[Dict]:
        photos = self.import_service.get_photos_by_status(
            ProcessingStatus.COACH_REVIEW_PENDING
        )
        return [self.workflow_service.get_workflow_summary(p) for p in photos]

    def get_boundary_rules_doc(self) -> str:
        return BOUNDARY_RULES_DOC

    def get_batch_summary(self, batch_id: str) -> Tuple[bool, str, Optional[Dict]]:
        batch = self.import_service.get_batch(batch_id)
        if not batch:
            return False, f"Batch {batch_id} not found", None

        photos = list(batch.photos.values())
        workflow = self.workflow_service.get_batch_workflow_summary(photos)
        return True, "OK", {
            "batch_id": batch.batch_id,
            "source_file": batch.source_file,
            "imported_at": batch.imported_at.isoformat(),
            "total_count": batch.total_count,
            "workflow_summary": workflow,
        }
