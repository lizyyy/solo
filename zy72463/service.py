from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
import copy

from models import (
    TreePoolInspection, ResidentComplaint, IntersectionPhoto,
    ChangeRecord, RampSupplement, InspectionStatus, ChangeType,
    generate_id
)
from storage import InspectionStorage


class InspectionService:
    def __init__(self, storage: Optional[InspectionStorage] = None):
        self.storage = storage or InspectionStorage()

    def _add_history(
        self,
        inspection: TreePoolInspection,
        change_type: ChangeType,
        field_name: Optional[str],
        old_value: Optional[Any],
        new_value: Optional[Any],
        changed_by: str,
        remark: Optional[str] = None,
        command_replay: Optional[str] = None,
        import_batch: Optional[str] = None
    ) -> ChangeRecord:
        record = ChangeRecord(
            change_id=generate_id("chg_"),
            inspection_id=inspection.inspection_id,
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=datetime.now(),
            remark=remark,
            command_replay=command_replay,
            old_status=None,
            new_status=inspection.status.value if inspection.status else None,
            old_score=None,
            new_score=inspection.score,
            import_batch=import_batch
        )
        inspection.history.append(record)
        inspection.updated_at = datetime.now()
        return record

    def _add_history_with_status(
        self,
        inspection: TreePoolInspection,
        change_type: ChangeType,
        field_name: Optional[str],
        old_value: Optional[Any],
        new_value: Optional[Any],
        changed_by: str,
        old_status: InspectionStatus,
        new_status: InspectionStatus,
        old_score: Optional[float],
        new_score: Optional[float],
        remark: Optional[str] = None,
        command_replay: Optional[str] = None,
        import_batch: Optional[str] = None
    ) -> ChangeRecord:
        record = ChangeRecord(
            change_id=generate_id("chg_"),
            inspection_id=inspection.inspection_id,
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=datetime.now(),
            remark=remark,
            command_replay=command_replay,
            old_status=old_status.value,
            new_status=new_status.value,
            old_score=old_score,
            new_score=new_score,
            import_batch=import_batch
        )
        inspection.history.append(record)
        inspection.updated_at = datetime.now()
        return record

    def import_complaints(
        self,
        complaints: List[Dict[str, Any]],
        imported_by: str,
        batch_id: Optional[str] = None
    ) -> Tuple[List[TreePoolInspection], List[Tuple[str, TreePoolInspection]]]:
        existing = self.storage.load_all()
        created = []
        skipped_with_existing = []

        if not batch_id:
            batch_id = generate_id("batch_")

        for comp_data in complaints:
            complaint_id = comp_data["complaint_id"]
            if complaint_id in existing:
                existing_insp = existing[complaint_id]
                changes_since_import = [
                    h for h in existing_insp.history
                    if h.change_type not in (ChangeType.CREATED, ChangeType.REIMPORT_SKIPPED)
                ]
                self._add_history(
                    existing_insp,
                    ChangeType.REIMPORT_SKIPPED,
                    None,
                    None,
                    {
                        "complaint_id": complaint_id,
                        "intersection": comp_data.get("intersection", ""),
                        "description": comp_data.get("description", ""),
                        "changes_since_import": len(changes_since_import),
                        "who_changed": list({h.changed_by for h in changes_since_import}),
                        "current_status": existing_insp.status.value,
                        "current_score": existing_insp.score
                    },
                    imported_by,
                    remark=f"重复导入跳过 {complaint_id} | 历史批次: {existing_insp.import_batch} | 本次批次: {batch_id} | 其间有 {len(changes_since_import)} 条变更 by {list({h.changed_by for h in changes_since_import})}",
                    command_replay=f"import-complaints --ids {complaint_id} --batch {batch_id}",
                    import_batch=batch_id
                )
                self.storage.save(existing_insp)
                skipped_with_existing.append((complaint_id, existing_insp))
                continue

            complaint = ResidentComplaint(
                complaint_id=complaint_id,
                intersection=comp_data["intersection"],
                description=comp_data["description"],
                reported_at=datetime.fromisoformat(comp_data["reported_at"]) if isinstance(comp_data["reported_at"], str) else comp_data["reported_at"],
                source=comp_data.get("source", "resident")
            )

            inspection = TreePoolInspection(
                inspection_id=generate_id("insp_"),
                complaint_id=complaint_id,
                complaint=complaint,
                status=InspectionStatus.PENDING,
                assigned_to=comp_data.get("assigned_to"),
                import_batch=batch_id
            )

            self._add_history_with_status(
                inspection,
                ChangeType.CREATED,
                None,
                None,
                complaint.to_dict(),
                imported_by,
                InspectionStatus.PENDING,
                InspectionStatus.PENDING,
                None,
                None,
                remark=f"导入居民投诉 {complaint_id} (批次: {batch_id})",
                command_replay=f"import-complaints --ids {complaint_id} --batch {batch_id}",
                import_batch=batch_id
            )

            self.storage.save(inspection)
            created.append(inspection)

        return created, skipped_with_existing

    def add_photo(
        self,
        complaint_id: str,
        file_path: str,
        taken_at: datetime,
        uploaded_by: str,
        remark: Optional[str] = None
    ) -> Optional[TreePoolInspection]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        old_status = inspection.status
        old_score = inspection.score

        photo = IntersectionPhoto(
            photo_id=generate_id("photo_"),
            complaint_id=complaint_id,
            file_path=file_path,
            taken_at=taken_at,
            uploaded_by=uploaded_by,
            remark=remark
        )
        inspection.photos.append(photo)

        if inspection.status == InspectionStatus.PENDING:
            inspection.status = InspectionStatus.PHOTO_REVIEWED

        self._add_history_with_status(
            inspection,
            ChangeType.PHOTO_ADDED,
            "photos",
            len(inspection.photos) - 1,
            photo.to_dict(),
            uploaded_by,
            old_status,
            inspection.status,
            old_score,
            inspection.score,
            remark=remark,
            command_replay=f"add-photo --complaint {complaint_id} --file {file_path}"
        )

        self.storage.save(inspection)
        return inspection

    def update_remark(
        self,
        complaint_id: str,
        new_remark: str,
        updated_by: str
    ) -> Optional[TreePoolInspection]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        old_remark = inspection.remark
        old_status = inspection.status
        old_score = inspection.score
        inspection.remark = new_remark

        self._add_history_with_status(
            inspection,
            ChangeType.REMARK_UPDATED,
            "remark",
            old_remark,
            new_remark,
            updated_by,
            old_status,
            inspection.status,
            old_score,
            inspection.score,
            remark=f"备注更新: {old_remark} → {new_remark}",
            command_replay=f"update-remark --complaint {complaint_id} --remark '{new_remark}'"
        )

        self.storage.save(inspection)
        return inspection

    def update_score(
        self,
        complaint_id: str,
        new_score: float,
        updated_by: str
    ) -> Optional[TreePoolInspection]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        old_score = inspection.score
        old_status = inspection.status
        inspection.score = new_score

        self._add_history_with_status(
            inspection,
            ChangeType.SCORE_UPDATED,
            "score",
            old_score,
            new_score,
            updated_by,
            old_status,
            inspection.status,
            old_score,
            new_score,
            remark=f"评分更新: {old_score} → {new_score}",
            command_replay=f"update-score --complaint {complaint_id} --score {new_score}"
        )

        self.storage.save(inspection)
        return inspection

    def add_ramp_supplement(
        self,
        complaint_id: str,
        location: str,
        description: str,
        new_score: Optional[float],
        supplemented_by: str
    ) -> Optional[TreePoolInspection]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        old_status = inspection.status
        old_score = inspection.score

        ramp = RampSupplement(
            ramp_id=generate_id("ramp_"),
            inspection_id=inspection.inspection_id,
            location=location,
            description=description,
            supplemented_by=supplemented_by,
            supplemented_at=datetime.now(),
            old_score=old_score,
            new_score=new_score
        )
        inspection.ramp_supplements.append(ramp)

        if new_score is not None:
            inspection.score = new_score

        score_changed = (old_score is None and new_score is not None) or \
                        (old_score is not None and new_score is None) or \
                        (old_score is not None and new_score is not None and abs(old_score - new_score) >= 0.001)

        if not score_changed and old_score is not None and new_score is not None:
            inspection.status = InspectionStatus.NEEDS_REVIEW

        self._add_history_with_status(
            inspection,
            ChangeType.RAMP_SUPPLEMENTED,
            "ramp_supplements",
            None,
            ramp.to_dict(),
            supplemented_by,
            old_status,
            inspection.status,
            old_score,
            inspection.score,
            remark=f"坡道补录: {location} | 评分: {old_score} → {new_score}" + (" [评分未变化，需复核]" if not score_changed and old_score is not None else ""),
            command_replay=f"add-ramp --complaint {complaint_id} --location '{location}' --score {new_score if new_score else 'null'}"
        )

        self.storage.save(inspection)
        return inspection

    def update_suggestion(
        self,
        complaint_id: str,
        suggestion: str,
        updated_by: str
    ) -> Optional[TreePoolInspection]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        old_suggestion = inspection.suggestion
        old_status = inspection.status
        old_score = inspection.score
        inspection.suggestion = suggestion

        if inspection.status == InspectionStatus.PHOTO_REVIEWED:
            inspection.status = InspectionStatus.SUGGESTION_UPDATED

        self._add_history_with_status(
            inspection,
            ChangeType.SUGGESTION_UPDATED,
            "suggestion",
            old_suggestion,
            suggestion,
            updated_by,
            old_status,
            inspection.status,
            old_score,
            inspection.score,
            remark=f"整改建议更新",
            command_replay=f"update-suggestion --complaint {complaint_id} --suggestion '{suggestion}'"
        )

        self.storage.save(inspection)
        return inspection

    def review_by_traffic_assistant(
        self,
        complaint_id: str,
        reviewed_by: str,
        review_result: str,
        adjusted_score: Optional[float] = None
    ) -> Optional[TreePoolInspection]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        old_status = inspection.status
        old_score = inspection.score

        if adjusted_score is not None:
            inspection.score = adjusted_score

        inspection.status = InspectionStatus.REVIEWED
        inspection.reviewed_by = reviewed_by

        self._add_history_with_status(
            inspection,
            ChangeType.REVIEWED,
            "status",
            old_status.value,
            InspectionStatus.REVIEWED.value,
            reviewed_by,
            old_status,
            InspectionStatus.REVIEWED,
            old_score,
            inspection.score,
            remark=f"交通协管复核: {review_result}" + (f" | 评分调整: {old_score} → {adjusted_score}" if adjusted_score is not None else ""),
            command_replay=f"review --complaint {complaint_id} --result '{review_result}'" + (f" --score {adjusted_score}" if adjusted_score is not None else "")
        )

        self.storage.save(inspection)
        return inspection

    def rollback(
        self,
        complaint_id: str,
        change_id: str,
        rolled_back_by: str
    ) -> Optional[TreePoolInspection]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        target_change = None
        for h in inspection.history:
            if h.change_id == change_id:
                target_change = h
                break

        if not target_change:
            return None

        pre_rollback_status = inspection.status
        pre_rollback_score = inspection.score

        if target_change.field_name == "remark":
            inspection.remark = target_change.old_value
        elif target_change.field_name == "score":
            inspection.score = target_change.old_value
        elif target_change.field_name == "suggestion":
            inspection.suggestion = target_change.old_value
        elif target_change.field_name == "photos":
            if inspection.photos:
                inspection.photos.pop()
        elif target_change.field_name == "ramp_supplements":
            if inspection.ramp_supplements:
                inspection.ramp_supplements.pop()
            if target_change.old_status is not None:
                try:
                    inspection.status = InspectionStatus(target_change.old_status)
                except ValueError:
                    pass
            if target_change.old_score is not None:
                inspection.score = target_change.old_score
            elif target_change.old_score is None and target_change.new_score is not None:
                ramp_old_score = None
                if target_change.new_value and isinstance(target_change.new_value, dict):
                    ramp_old_score = target_change.new_value.get("old_score")
                if ramp_old_score is not None:
                    inspection.score = ramp_old_score
                else:
                    inspection.score = None

        if target_change.old_status is not None and target_change.field_name != "ramp_supplements":
            try:
                inspection.status = InspectionStatus(target_change.old_status)
            except ValueError:
                pass

        self._add_history_with_status(
            inspection,
            ChangeType.ROLLED_BACK,
            target_change.field_name,
            target_change.new_value,
            target_change.old_value,
            rolled_back_by,
            pre_rollback_status,
            inspection.status,
            pre_rollback_score,
            inspection.score,
            remark=f"回滚变更 {change_id}: {target_change.change_type.value} | 状态: {pre_rollback_status.value} → {inspection.status.value} | 评分: {pre_rollback_score} → {inspection.score}",
            command_replay=f"rollback --complaint {complaint_id} --change {change_id}"
        )

        self.storage.save(inspection)
        return inspection

    def get_history_diff(self, complaint_id: str) -> List[Dict[str, Any]]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return []

        diffs = []
        for h in sorted(inspection.history, key=lambda x: x.changed_at):
            diffs.append({
                "change_id": h.change_id,
                "change_type": h.change_type.value,
                "field": h.field_name,
                "old": h.old_value,
                "new": h.new_value,
                "by": h.changed_by,
                "at": h.changed_at.isoformat(),
                "remark": h.remark,
                "replay": h.command_replay,
                "old_status": h.old_status,
                "new_status": h.new_status,
                "old_score": h.old_score,
                "new_score": h.new_score,
                "import_batch": h.import_batch
            })
        return diffs

    def trace_from_complaint(self, complaint_id: str) -> Optional[Dict[str, Any]]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return None

        photo_remarks = []
        for p in inspection.photos:
            photo_remarks.append({
                "photo_id": p.photo_id,
                "file_path": p.file_path,
                "remark": p.remark,
                "uploaded_by": p.uploaded_by
            })

        ramp_info = []
        for r in inspection.ramp_supplements:
            ramp_info.append({
                "ramp_id": r.ramp_id,
                "location": r.location,
                "description": r.description,
                "old_score": r.old_score,
                "new_score": r.new_score,
                "supplemented_by": r.supplemented_by,
                "score_unchanged": r.old_score is not None and r.new_score is not None and abs(r.old_score - r.new_score) < 0.001
            })

        timeline = []
        for h in sorted(inspection.history, key=lambda x: x.changed_at):
            entry = {
                "change_id": h.change_id,
                "change_type": h.change_type.value,
                "by": h.changed_by,
                "at": h.changed_at.isoformat(),
                "old_status": h.old_status,
                "new_status": h.new_status,
                "old_score": h.old_score,
                "new_score": h.new_score,
            }
            if h.field_name == "remark":
                entry["detail"] = f"备注: {h.old_value} → {h.new_value}"
            elif h.field_name == "score":
                entry["detail"] = f"评分: {h.old_value} → {h.new_value}"
            elif h.field_name == "suggestion":
                entry["detail"] = f"建议: {h.old_value} → {h.new_value}"
            elif h.field_name == "photos":
                entry["detail"] = "添加照片" + (f" (备注: {h.new_value.get('remark')})" if isinstance(h.new_value, dict) and h.new_value.get('remark') else "")
            elif h.field_name == "ramp_supplements":
                entry["detail"] = "坡道补录" + (f" (评分: {h.old_score} → {h.new_score})" if h.old_score is not None or h.new_score is not None else "")
            elif h.change_type == ChangeType.REIMPORT_SKIPPED.value:
                entry["detail"] = h.remark or "重复导入跳过"
            elif h.change_type == ChangeType.ROLLED_BACK.value:
                entry["detail"] = h.remark or "回滚"
            elif h.change_type == ChangeType.CREATED.value:
                entry["detail"] = "创建巡检记录"
            elif h.change_type == ChangeType.REVIEWED.value:
                entry["detail"] = h.remark or "复核"
            else:
                entry["detail"] = h.remark or ""
            timeline.append(entry)

        return {
            "complaint_id": complaint_id,
            "intersection": inspection.complaint.intersection,
            "description": inspection.complaint.description,
            "current_status": inspection.status.value,
            "current_score": inspection.score,
            "current_remark": inspection.remark,
            "current_suggestion": inspection.suggestion,
            "import_batch": inspection.import_batch,
            "photo_remarks": photo_remarks,
            "ramp_supplements": ramp_info,
            "has_ramp_score_unchanged": inspection.has_ramp_score_unchanged(),
            "timeline": timeline
        }

    def get_replay_commands(self, complaint_id: str) -> List[str]:
        inspection = self.storage.get_by_complaint_id(complaint_id)
        if not inspection:
            return []
        return [h.command_replay for h in sorted(inspection.history, key=lambda x: x.changed_at) if h.command_replay]

    def get_all_inspections(self) -> List[TreePoolInspection]:
        return self.storage.get_all_list()

    def get_inspection(self, complaint_id: str) -> Optional[TreePoolInspection]:
        return self.storage.get_by_complaint_id(complaint_id)

    def get_needs_review_list(self) -> List[TreePoolInspection]:
        return self.storage.get_needs_review()
