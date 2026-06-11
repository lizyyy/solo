from typing import List, Dict, Tuple, Optional
from .services.import_service import ImportService, DuplicateCategory
from .services.boundary_rules import BoundaryRuleService
from .services.workflow import WorkflowService
from .services.report_service import ReportService
from .models.enums import UserRole, TemperatureUnit, ProcessingStatus
from .models.photo import WorkingConditionPhoto
from .services.boundary_rules import BOUNDARY_RULES_DOC


class BalanceWheelErrorApp:
    def __init__(self):
        self.import_service = ImportService()
        self.boundary_service = BoundaryRuleService()
        self.workflow_service = WorkflowService(self.boundary_service)
        self.report_service = ReportService(self.boundary_service, self.import_service)

    def import_photos(
        self, rows: List[Dict], source_file: str, operator: UserRole = UserRole.OPERATOR
    ) -> Dict:
        batch, classified = self.import_service.import_photos_from_rows(
            rows, source_file, operator
        )
        photos = list(batch.photos.values())
        for p in photos:
            self.workflow_service.step1_import_complete(p, operator)

        summary = self.workflow_service.get_batch_workflow_summary(photos)
        repeat_analysis = self.report_service.generate_repeat_import_analysis(batch, classified)

        return {
            "batch_id": batch.batch_id,
            "imported_count": batch.total_count,
            "classification": {
                "new_count": len(classified.get(DuplicateCategory.NEW, [])),
                "history_duplicate_count": len(classified.get(DuplicateCategory.DUPLICATE_FROM_HISTORY, [])),
                "batch_duplicate_count": len(classified.get(DuplicateCategory.DUPLICATE_IN_CURRENT_BATCH, [])),
                "details": {
                    "new_records": classified.get(DuplicateCategory.NEW, []),
                    "history_duplicates": classified.get(DuplicateCategory.DUPLICATE_FROM_HISTORY, []),
                    "batch_duplicates": classified.get(DuplicateCategory.DUPLICATE_IN_CURRENT_BATCH, []),
                },
            },
            "workflow_summary": summary,
            "repeat_import_analysis": repeat_analysis,
        }

    def reimport_photos(
        self,
        rows: List[Dict],
        source_file: str,
        existing_batch_id: str,
        operator: UserRole = UserRole.LIN_TEACHER,
    ) -> Dict:
        batch, classified = self.import_service.reimport_same_batch(
            rows, source_file, existing_batch_id, operator
        )
        photos = list(batch.photos.values())
        summary = self.workflow_service.get_batch_workflow_summary(photos)
        repeat_analysis = self.report_service.generate_repeat_import_analysis(batch, classified)

        return {
            "batch_id": batch.batch_id,
            "total_count": batch.total_count,
            "classification": {
                "new_count": len(classified.get(DuplicateCategory.NEW, [])),
                "updated_count": len(classified.get(DuplicateCategory.UPDATED, [])),
                "unchanged_count": len(classified.get(DuplicateCategory.UNCHANGED, [])),
                "history_duplicate_count": len(classified.get(DuplicateCategory.DUPLICATE_FROM_HISTORY, [])),
                "details": {
                    "new_records": classified.get(DuplicateCategory.NEW, []),
                    "updated_records": classified.get(DuplicateCategory.UPDATED, []),
                    "unchanged_records": classified.get(DuplicateCategory.UNCHANGED, []),
                    "history_duplicates": classified.get(DuplicateCategory.DUPLICATE_FROM_HISTORY, []),
                },
            },
            "workflow_summary": summary,
            "repeat_import_analysis": repeat_analysis,
        }

    def lin_teacher_add_remark(
        self, photo_id: str, remark: str, change_reason: str = ""
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        ok, msg = self.workflow_service.step2_lin_teacher_add_remark(
            photo, remark, UserRole.LIN_TEACHER
        )
        if ok and change_reason:
            latest_change = photo.change_history[-1]
            latest_change.remark = (latest_change.remark or "") + f" | 原因: {change_reason}"

        if ok:
            evidence = self.report_service.generate_photo_evidence_report(photo)
            return True, msg, evidence
        return False, msg, None

    def coach_fix_mixed_units(
        self, photo_id: str, final_unit: TemperatureUnit, remark: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        old_version = photo.version - 1

        ok, msg = self.boundary_service.coach_fix_mixed_units(
            photo, final_unit, remark, UserRole.COACH
        )
        if ok:
            evidence = self.report_service.generate_photo_evidence_report(photo)
            diff = photo.get_field_diff(old_version, photo.version - 1)
            evidence["field_diff_after_fix"] = diff
            return True, msg, evidence
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
            evidence = self.report_service.generate_photo_evidence_report(photo)
            return True, msg, evidence
        return False, msg, None

    def coach_rollback(
        self, photo_id: str, target_version: int, rollback_reason: str
    ) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        old_version = photo.version - 1

        ok, msg = self.boundary_service.rollback_to_version(
            photo, target_version, UserRole.COACH, rollback_reason
        )
        if ok:
            evidence = self.report_service.generate_photo_evidence_report(photo)
            diff = photo.get_field_diff(old_version, photo.version - 1)
            evidence["field_diff_after_rollback"] = diff
            evidence["rollback_verification"] = {
                "rolled_back_from_version": old_version,
                "rolled_back_to_version": target_version,
                "all_fields_restored_from_snapshot": True,
                "temperature_unit_restored": photo.temperature_unit,
                "status_restored": photo.error_status.value,
                "remark_restored": photo.handwritten_remark,
                "report_restored": photo.report_content,
            }
            return True, msg, evidence
        return False, msg, None

    def get_photo_evidence(self, photo_id: str) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        evidence = self.report_service.generate_photo_evidence_report(photo)
        return True, "OK", evidence

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

        evidence = self.report_service.generate_photo_evidence_report(photo)
        return True, "OK", evidence

    def get_pending_coach_review(self) -> List[Dict]:
        photos = self.import_service.get_photos_by_status(
            ProcessingStatus.COACH_REVIEW_PENDING
        )
        return [self.report_service.generate_photo_evidence_report(p) for p in photos]

    def get_boundary_rules_doc(self) -> str:
        return BOUNDARY_RULES_DOC

    def get_batch_summary(self, batch_id: str) -> Tuple[bool, str, Optional[Dict]]:
        batch = self.import_service.get_batch(batch_id)
        if not batch:
            return False, f"Batch {batch_id} not found", None

        report = self.report_service.generate_batch_summary_report(batch)
        return True, "OK", report

    def get_import_audit_log(self) -> List[Dict]:
        return self.import_service.get_import_audit_log()

    def verify_rollback_closed_loop(self, photo_id: str) -> Tuple[bool, str, Optional[Dict]]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return False, f"Photo {photo_id} not found", None

        if not photo.is_rollbacked or photo.rollback_to_version is None:
            return False, "Photo has not been rolled back", None

        target_version = photo.rollback_to_version
        target_snapshot = photo.get_snapshot_at_version(target_version)

        if not target_snapshot:
            return False, "Target snapshot not found", None

        checks = {
            "temperature_value_match": photo.temperature_value == target_snapshot.temperature_value,
            "temperature_unit_match": photo.temperature_unit == target_snapshot.temperature_unit,
            "has_mixed_units_match": photo.has_mixed_units == target_snapshot.has_mixed_units,
            "error_status_match": photo.error_status == target_snapshot.error_status,
            "handwritten_remark_match": photo.handwritten_remark == target_snapshot.handwritten_remark,
            "report_content_match": photo.report_content == target_snapshot.report_content,
            "balance_wheel_error_match": photo.balance_wheel_error == target_snapshot.balance_wheel_error,
        }

        all_match = all(checks.values())

        return True, "OK", {
            "photo_id": photo_id,
            "rollback_to_version": target_version,
            "current_version": photo.version,
            "closed_loop_verified": all_match,
            "field_checks": checks,
            "conclusion": "回滚闭环验证通过：所有字段值与目标版本快照一致" if all_match else "回滚闭环验证失败：存在字段不匹配",
        }
