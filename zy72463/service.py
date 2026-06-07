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
        command_replay: Optional[str] = None
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
            command_replay=command_replay
        )
        inspection.history.append(record)
        inspection.updated_at = datetime.now()
        return record

    def import_complaints(
        self,
        complaints: List[Dict[str, Any]],
        imported_by: str
    ) -> Tuple[List[TreePoolInspection], List[str]]:
        existing = self.storage.load_all()
        created = []
        skipped = []

        for comp_data in complaints:
            complaint_id = comp_data["complaint_id"]
            if complaint_id in existing:
                skipped.append(complaint_id)
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
                assigned_to=comp_data.get("assigned_to")
            )

            self._add_history(
                inspection,
                ChangeType.CREATED,
                None,
                None,
                complaint.to_dict(),
                imported_by,
                remark=f"导入居民投诉 {complaint_id}",
                command_replay=f"import-complaints --ids {complaint_id}"
            )

            self.storage.save(inspection)
            created.append(inspection)

        return created, skipped

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

        self._add_history(
            inspection,
            ChangeType.PHOTO_ADDED,
            "photos",
            len(inspection.photos) - 1,
            photo.to_dict(),
            uploaded_by,
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
        inspection.remark = new_remark

        self._add_history(
            inspection,
            ChangeType.REMARK_UPDATED,
            "remark",
            old_remark,
            new_remark,
            updated_by,
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
        inspection.score = new_score

        self._add_history(
            inspection,
            ChangeType.SCORE_UPDATED,
            "score",
            old_score,
            new_score,
            updated_by,
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

        self._add_history(
            inspection,
            ChangeType.RAMP_SUPPLEMENTED,
            "ramp_supplements",
            None,
            ramp.to_dict(),
            supplemented_by,
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
        inspection.suggestion = suggestion

        if inspection.status == InspectionStatus.PHOTO_REVIEWED:
            inspection.status = InspectionStatus.SUGGESTION_UPDATED

        self._add_history(
            inspection,
            ChangeType.SUGGESTION_UPDATED,
            "suggestion",
            old_suggestion,
            suggestion,
            updated_by,
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

        self._add_history(
            inspection,
            ChangeType.REVIEWED,
            "status",
            old_status.value,
            InspectionStatus.REVIEWED.value,
            reviewed_by,
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

        self._add_history(
            inspection,
            ChangeType.ROLLED_BACK,
            target_change.field_name,
            target_change.new_value,
            target_change.old_value,
            rolled_back_by,
            remark=f"回滚变更 {change_id}: {target_change.change_type.value}",
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
                "replay": h.command_replay
            })
        return diffs

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
