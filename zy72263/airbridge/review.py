from datetime import datetime
from typing import Optional, Dict, List, Tuple
from .models import PreflightRecord, InspectionPhoto


class ReviewManager:
    def __init__(self, preflight_manager):
        self.preflight_manager = preflight_manager
        self._rollback_snapshots: Dict[str, Dict] = {}

    def detect_blocked_alert(self, photo: InspectionPhoto) -> Dict[str, any]:
        result = {
            "photo_id": photo.id,
            "has_mobile_screenshot": photo.has_mobile_screenshot,
            "alert_label_visible": photo.alert_label_visible,
            "is_blocked": photo.is_alert_label_blocked(),
            "recommended_action": "none",
            "needs_manager_review": False,
        }

        if photo.is_alert_label_blocked():
            result["recommended_action"] = "review_by_manager"
            result["needs_manager_review"] = True
            result["block_reason"] = "mobile_screenshot_covering_alert_label"

        return result

    def submit_for_manager_review(
        self,
        record_id: str,
        photo_id: str,
        submitter: str = "designer_ajing"
    ) -> Optional[PreflightRecord]:
        record = self.preflight_manager.get_preflight_record(record_id)
        if not record:
            return None

        photo = self.preflight_manager.get_inspection_photo(photo_id)
        if not photo:
            return None

        self._take_snapshot(record_id, photo_id)

        record.status = "manager_review"
        record.review_status = "pending"
        record.updated_at = datetime.now()
        record.add_history_entry(
            "submitted_for_review",
            submitter,
            {
                "photo_id": photo_id,
                "photo_number": photo.photo_number,
                "block_detected": photo.is_alert_label_blocked(),
            },
        )

        return record

    def manager_review(
        self,
        record_id: str,
        is_blocked: bool,
        reviewer: str = "construction_manager",
        comment: str = "",
        photo_id: Optional[str] = None,
    ) -> Tuple[Optional[PreflightRecord], str]:
        record = self.preflight_manager.get_preflight_record(record_id)
        if not record:
            return None, "record_not_found"

        if record.review_status != "pending" or record.status != "manager_review":
            return None, "not_in_review_state"

        if photo_id is None:
            photos = self.preflight_manager.get_photos_by_origin_id(record.coordinate_origin_id)
            for p in photos:
                if p.is_alert_label_blocked():
                    photo_id = p.id
                    break
            if photo_id is None and photos:
                photo_id = photos[0].id

        self._take_snapshot(record_id, photo_id)

        record.block_verified = is_blocked
        record.reviewer = reviewer
        record.reviewed_at = datetime.now()
        record.review_comment = comment
        record.review_status = "completed"
        record.updated_at = datetime.now()

        if is_blocked:
            record.status = "block_confirmed"
            action = "block_confirmed"
        else:
            record.status = "normal"
            record.block_detected = False
            action = "block_cleared"

        record.add_history_entry(
            action,
            reviewer,
            {
                "is_blocked": is_blocked,
                "comment": comment,
            },
        )

        return record, "success"

    def resolve_block(
        self,
        record_id: str,
        photo_id: str,
        resolution: str,
        actor: str = "designer_ajing",
    ) -> Optional[PreflightRecord]:
        record = self.preflight_manager.get_preflight_record(record_id)
        if not record:
            return None

        photo = self.preflight_manager.get_inspection_photo(photo_id)
        if not photo:
            return None

        self._take_snapshot(record_id, photo_id)

        photo_changes = {
            "photo_id": photo_id,
            "before": {
                "has_mobile_screenshot": photo.has_mobile_screenshot,
                "alert_label_visible": photo.alert_label_visible,
            },
        }

        if resolution == "rephoto":
            photo.has_mobile_screenshot = False
            photo.alert_label_visible = True
            photo.updated_at = datetime.now()
            record.block_detected = False
            record.status = "resolved"
            photo_changes["after"] = {
                "has_mobile_screenshot": False,
                "alert_label_visible": True,
            }
        elif resolution == "accept_as_is":
            record.status = "resolved_with_exceptions"
            photo_changes["after"] = photo_changes["before"]
        else:
            record.status = "resolved"
            photo_changes["after"] = photo_changes["before"]

        record.updated_at = datetime.now()
        record.add_history_entry(
            "block_resolved",
            actor,
            {
                "photo_id": photo_id,
                "resolution": resolution,
                "photo_changes": photo_changes,
            },
        )

        return record

    def rollback(self, record_id: str, actor: str = "system") -> Optional[PreflightRecord]:
        if record_id not in self._rollback_snapshots:
            return None

        snapshot = self._rollback_snapshots[record_id]
        record = self.preflight_manager.get_preflight_record(record_id)

        if not record:
            return None

        record.status = snapshot["status"]
        record.review_status = snapshot["review_status"]
        record.block_detected = snapshot["block_detected"]
        record.block_verified = snapshot["block_verified"]
        record.updated_at = datetime.now()

        rolled_back_photos = {}
        for pid, photo_snap in snapshot.get("photos", {}).items():
            photo = self.preflight_manager.get_inspection_photo(pid)
            if photo:
                before = {
                    "has_mobile_screenshot": photo.has_mobile_screenshot,
                    "alert_label_visible": photo.alert_label_visible,
                }
                photo.has_mobile_screenshot = photo_snap["has_mobile_screenshot"]
                photo.alert_label_visible = photo_snap["alert_label_visible"]
                photo.updated_at = datetime.now()
                rolled_back_photos[pid] = {
                    "before": before,
                    "after": {
                        "has_mobile_screenshot": photo_snap["has_mobile_screenshot"],
                        "alert_label_visible": photo_snap["alert_label_visible"],
                    },
                }

        record.add_history_entry(
            "rollback",
            actor,
            {
                "rolled_back_from": snapshot,
                "rolled_back_photos": rolled_back_photos,
            },
        )

        del self._rollback_snapshots[record_id]

        return record

    def _take_snapshot(self, record_id: str, photo_id: Optional[str] = None):
        record = self.preflight_manager.get_preflight_record(record_id)
        if not record:
            return

        snapshot_photos = {}
        if photo_id:
            photo = self.preflight_manager.get_inspection_photo(photo_id)
            if photo:
                snapshot_photos[photo_id] = {
                    "has_mobile_screenshot": photo.has_mobile_screenshot,
                    "alert_label_visible": photo.alert_label_visible,
                }

        self._rollback_snapshots[record_id] = {
            "status": record.status,
            "review_status": record.review_status,
            "block_detected": record.block_detected,
            "block_verified": record.block_verified,
            "target_photo_id": photo_id,
            "photos": snapshot_photos,
            "timestamp": datetime.now().isoformat(),
        }

    def get_rollback_history(self) -> List[str]:
        return list(self._rollback_snapshots.keys())

    def get_records_needing_review(self) -> List[PreflightRecord]:
        return [
            record
            for record in self.preflight_manager.get_all_preflight_records()
            if record.status == "needs_review" or record.status == "manager_review"
        ]
