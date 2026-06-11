from datetime import datetime
from typing import List, Dict, Optional
from ..models.photo import WorkingConditionPhoto
from ..models.batch import ImportBatch
from ..models.enums import ProcessingStatus
from .boundary_rules import BoundaryRuleService
from .import_service import ImportService


class ReportService:
    def __init__(self, boundary_service: BoundaryRuleService, import_service: ImportService):
        self.boundary_service = boundary_service
        self.import_service = import_service

    def generate_photo_evidence_report(self, photo: WorkingConditionPhoto) -> Dict:
        evidence = self.boundary_service.get_evidence_summary(photo)
        audit_trail = self.boundary_service.get_audit_trail(photo)

        notable_versions = []
        for entry in audit_trail:
            if entry["change_type"] in [
                "temperature_unit_fix",
                "rollback",
                "manual_edit",
                "remark_add",
                "status_change",
            ]:
                notable_versions.append({
                    "version": entry["version"],
                    "type": entry["change_type"],
                    "operator": entry["operator"],
                    "timestamp": entry["timestamp"],
                    "field": entry["field"],
                    "old_value": entry["old_value"],
                    "new_value": entry["new_value"],
                    "reason": entry["remark"],
                })

        return {
            "generated_at": datetime.now().isoformat(),
            "photo_evidence": evidence,
            "audit_trail": audit_trail,
            "notable_changes": notable_versions,
            "traceback_path": [
                f"原始行号: {photo.original_row_number} (来自 {photo.source_file})",
                f"原始温度文本: {photo.temperature_raw}",
                f"当前版本: {photo.version} (可追溯到版本0)",
                f"变更历史: {len(audit_trail)} 条记录",
                f"回滚标记: {photo.is_rollbacked} (回滚到版本 {photo.rollback_to_version})" if photo.is_rollbacked else "无回滚",
            ],
        }

    def generate_batch_summary_report(self, batch: ImportBatch) -> Dict:
        photos = list(batch.photos.values())
        workflow = self._get_workflow_stats(photos)

        mixed_photos = [p for p in photos if p.has_mixed_units]
        pending_coach = [p for p in photos if p.error_status == ProcessingStatus.COACH_REVIEW_PENDING]
        rollbacked = [p for p in photos if p.is_rollbacked]

        detail_list = []
        for p in photos:
            detail_list.append({
                "photo_id": p.photo_id,
                "original_row": p.original_row_number,
                "file_name": p.file_name,
                "temperature_raw": p.temperature_raw,
                "has_mixed_units": p.has_mixed_units,
                "status": p.error_status.value,
                "version_count": p.version,
                "is_rollbacked": p.is_rollbacked,
                "handwritten_remark": p.handwritten_remark,
                "traceback_hint": f"photo_id={p.photo_id}, original_row={p.original_row_number}, source={p.source_file}",
            })

        import_audit = self.import_service.get_import_audit_log()

        return {
            "generated_at": datetime.now().isoformat(),
            "batch_id": batch.batch_id,
            "source_file": batch.source_file,
            "imported_at": batch.imported_at.isoformat(),
            "total_count": batch.total_count,
            "workflow_breakdown": workflow,
            "mixed_units_count": len(mixed_photos),
            "pending_coach_count": len(pending_coach),
            "rollbacked_count": len(rollbacked),
            "pending_coach_photo_ids": [p.photo_id for p in pending_coach],
            "rollbacked_photo_ids": [p.photo_id for p in rollbacked],
            "photos": detail_list,
            "import_audit_log": import_audit,
            "traceback_instructions": [
                "1. 找到目标照片的 photo_id 或 original_row",
                "2. 调用 get_photo_evidence_report(photo_id) 获取完整证据链",
                "3. 使用 compare_versions 对比任意两个版本的差异",
                "4. 所有修改都有 old_value / new_value / remark 三元组",
                "5. temperature_raw 字段永不修改，永远是原始证据",
            ],
        }

    def generate_repeat_import_analysis(self, batch: ImportBatch, classified: Dict[str, List]) -> Dict:
        new_count = len(classified.get("new", []))
        updated_count = len(classified.get("updated", []))
        unchanged_count = len(classified.get("unchanged", []))
        history_dup_count = len(classified.get("duplicate_from_history", []))
        batch_dup_count = len(classified.get("duplicate_in_batch", []))

        updated_details = []
        for item in classified.get("updated", []):
            photo = self.import_service.get_photo(item["photo_id"])
            old_versions = photo.version - 1 if photo else None
            updated_details.append({
                "photo_id": item["photo_id"],
                "original_row": item["original_row"],
                "file_name": item["file_name"],
                "changed_fields": item.get("changed_fields", []),
                "changes": item.get("changes", {}),
                "version_before": old_versions - 1 if old_versions else None,
                "version_after": photo.version if photo else None,
                "traceback": f"可通过 photo_id={item['photo_id']} 查看改前改后快照对比",
            })

        return {
            "generated_at": datetime.now().isoformat(),
            "batch_id": batch.batch_id,
            "source_file": batch.source_file,
            "total_rows_input": sum(len(v) for v in classified.values()),
            "categories": {
                "new_records": {
                    "count": new_count,
                    "description": "本次导入的新记录",
                    "items": classified.get("new", []),
                },
                "updated_records": {
                    "count": updated_count,
                    "description": "同一批次内已存在但有字段更新的记录",
                    "items": updated_details,
                },
                "unchanged_records": {
                    "count": unchanged_count,
                    "description": "同一批次内已存在且无变化的记录",
                    "items": classified.get("unchanged", []),
                },
                "history_duplicates": {
                    "count": history_dup_count,
                    "description": "其他历史批次中已存在的记录（不在当前批次内）",
                    "items": classified.get("duplicate_from_history", []),
                },
                "batch_duplicates": {
                    "count": batch_dup_count,
                    "description": "本次导入文件内重复出现的记录",
                    "items": classified.get("duplicate_in_batch", []),
                },
            },
            "duplicate_detection_basis": "唯一键 = source_file + file_name + original_row_number",
            "no_double_counting_guarantee": "重复记录不会重复计数，总数量 = 新记录 + 原批次已存在记录",
        }

    def _get_workflow_stats(self, photos: List[WorkingConditionPhoto]) -> Dict:
        step1 = step2 = step3 = 0
        for p in photos:
            status = p.error_status
            if status in [ProcessingStatus.IMPORTED, ProcessingStatus.COACH_REVIEW_PENDING, ProcessingStatus.MANUAL_REVIEW_PENDING]:
                step1 += 1
            elif status == ProcessingStatus.LIN_TEACHER_REVIEWED:
                step2 += 1
            elif status in [ProcessingStatus.COACH_APPROVED, ProcessingStatus.REPORT_UPDATED]:
                step3 += 1

        return {
            "total": len(photos),
            "step_1_imported_or_pending_review": step1,
            "step_2_lin_teacher_reviewed": step2,
            "step_3_report_updated": step3,
        }

    def export_evidence_to_dict(self, photo_id: str) -> Optional[Dict]:
        photo = self.import_service.get_photo(photo_id)
        if not photo:
            return None
        return self.generate_photo_evidence_report(photo)
