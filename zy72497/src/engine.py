import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

from .models import (
    ClearanceRecord,
    ResidentComplaint,
    IntersectionPhoto,
    ProcessingStatus,
    EvidenceSource,
    AbnormalType,
)


class BoundaryRules:
    @staticmethod
    def detect_temporary_detour_issue(
        complaint_content: str,
        scene_description: str,
    ) -> bool:
        keywords = [
            "施工临时改道",
            "临时改道",
            "道路施工",
            "改道",
            "绕行",
            "地图未更新",
            "地图不对",
            "导航错误",
        ]
        complaint_lower = complaint_content.lower()
        scene_lower = scene_description.lower()
        return any(k in complaint_lower or k in scene_lower for k in keywords)

    @staticmethod
    def should_hold_for_review(
        complaint_content: str,
        scene_description: str,
    ) -> bool:
        return BoundaryRules.detect_temporary_detour_issue(
            complaint_content, scene_description
        )

    @staticmethod
    def classify_abnormal(
        complaint_content: str,
        scene_description: str,
    ) -> Optional[AbnormalType]:
        if BoundaryRules.detect_temporary_detour_issue(complaint_content, scene_description):
            return AbnormalType.TEMPORARY_DETOUR_NOT_SYNCED
        if "堵" in complaint_content or "占用" in complaint_content or "障碍" in scene_description:
            return AbnormalType.OBSTRUCTION_FOUND
        return None

    @staticmethod
    def get_rollback_eligibility(status: ProcessingStatus) -> bool:
        return status in [
            ProcessingStatus.CONFIRMED_NORMAL,
            ProcessingStatus.CONFIRMED_ABNORMAL,
            ProcessingStatus.UPDATED,
        ]


class ClearanceEngine:
    def __init__(self, storage_path: str = "data/clearance_records.json"):
        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.records: Dict[str, ClearanceRecord] = {}
        self._load_records()

    def _load_records(self) -> None:
        if self.storage_path.exists() and self.storage_path.stat().st_size > 0:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    raw_data = json.loads(content)
                    for record_data in raw_data:
                        self._reconstruct_record(record_data)

    def _reconstruct_record(self, data: Dict[str, Any]) -> None:
        complaint_data = data["complaint"]
        complaint = ResidentComplaint(
            complaint_id=complaint_data["complaint_id"],
            original_row_number=complaint_data["original_row_number"],
            raw_data=complaint_data["raw_data"],
            location=complaint_data["location"],
            complaint_content=complaint_data["complaint_content"],
            imported_at=datetime.fromisoformat(complaint_data["imported_at"]),
            imported_by=complaint_data["imported_by"],
            manual_changes=complaint_data.get("manual_changes", []),
        )

        photos = []
        for photo_data in data.get("photos", []):
            photo = IntersectionPhoto(
                photo_id=photo_data["photo_id"],
                complaint_id=photo_data["complaint_id"],
                photo_url=photo_data["photo_url"],
                location=photo_data["location"],
                scene_description=photo_data["scene_description"],
                reviewed_by=photo_data["reviewed_by"],
                reviewed_at=datetime.fromisoformat(photo_data["reviewed_at"]),
                raw_data=photo_data["raw_data"],
            )
            photos.append(photo)

        record = ClearanceRecord(
            record_id=data["record_id"],
            complaint_id=data["complaint_id"],
            complaint=complaint,
            photos=photos,
            current_status=ProcessingStatus(data["current_status"]),
            abnormal_type=AbnormalType(data["abnormal_type"]) if data.get("abnormal_type") else None,
            abnormal_note=data.get("abnormal_note"),
            confirmed_by=data.get("confirmed_by"),
            confirmed_at=datetime.fromisoformat(data["confirmed_at"]) if data.get("confirmed_at") else None,
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
        )

        from .models import AuditLog
        for log_data in data.get("audit_logs", []):
            log = AuditLog(
                log_id=log_data["log_id"],
                complaint_id=log_data["complaint_id"],
                source=EvidenceSource(log_data["source"]),
                action=log_data["action"],
                previous_status=ProcessingStatus(log_data["previous_status"]) if log_data.get("previous_status") else None,
                new_status=ProcessingStatus(log_data["new_status"]),
                operator=log_data["operator"],
                timestamp=datetime.fromisoformat(log_data["timestamp"]),
                details=log_data.get("details", {}),
            )
            record.audit_logs.append(log)

        self.records[record.complaint_id] = record

    def _save_records(self) -> None:
        records_list = [r.to_dict() for r in self.records.values()]
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(records_list, f, ensure_ascii=False, indent=2)

    def step1_import_complaints(
        self,
        complaints_data: List[Dict[str, Any]],
        imported_by: str,
    ) -> List[ClearanceRecord]:
        new_records = []
        for idx, comp_data in enumerate(complaints_data):
            complaint_id = comp_data.get("complaint_id") or f"COMP-{uuid.uuid4().hex[:8].upper()}"
            complaint = ResidentComplaint(
                complaint_id=complaint_id,
                original_row_number=idx + 1,
                raw_data=comp_data,
                location=comp_data.get("location", ""),
                complaint_content=comp_data.get("content", ""),
                imported_at=datetime.now(),
                imported_by=imported_by,
            )
            record = ClearanceRecord(
                record_id=str(uuid.uuid4()),
                complaint_id=complaint_id,
                complaint=complaint,
            )
            record.update_status(
                new_status=ProcessingStatus.IMPORTED,
                operator=imported_by,
                source=EvidenceSource.RESIDENT_COMPLAINT,
                details={"step": 1, "action": "import", "original_row": idx + 1},
            )
            self.records[complaint_id] = record
            new_records.append(record)
        self._save_records()
        return new_records

    def step2_review_photos(
        self,
        complaint_id: str,
        photo_data: Dict[str, Any],
        reviewed_by: str,
    ) -> Optional[ClearanceRecord]:
        record = self.records.get(complaint_id)
        if not record:
            return None

        photo = IntersectionPhoto(
            photo_id=photo_data.get("photo_id") or f"PHOTO-{uuid.uuid4().hex[:8].upper()}",
            complaint_id=complaint_id,
            photo_url=photo_data.get("photo_url", ""),
            location=photo_data.get("location", record.complaint.location),
            scene_description=photo_data.get("scene_description", ""),
            reviewed_by=reviewed_by,
            reviewed_at=datetime.now(),
            raw_data=photo_data,
        )
        record.add_photo(photo)

        if BoundaryRules.should_hold_for_review(
            record.complaint.complaint_content,
            photo.scene_description,
        ):
            abnormal_type = BoundaryRules.classify_abnormal(
                record.complaint.complaint_content,
                photo.scene_description,
            )
            record.update_status(
                new_status=ProcessingStatus.PENDING_REVIEW,
                operator=reviewed_by,
                source=EvidenceSource.INTERSECTION_PHOTO,
                details={
                    "step": 2,
                    "action": "photo_review_hold",
                    "reason": "施工临时改道未同步地图或其他需复核情况",
                    "photo_id": photo.photo_id,
                },
                abnormal_type=abnormal_type,
                abnormal_note="需居民代表复核，暂不归为正常",
            )
        else:
            record.update_status(
                new_status=ProcessingStatus.PHOTO_REVIEWED,
                operator=reviewed_by,
                source=EvidenceSource.INTERSECTION_PHOTO,
                details={"step": 2, "action": "photo_review_ok", "photo_id": photo.photo_id},
            )

        self._save_records()
        return record

    def step3_confirm_and_update(
        self,
        complaint_id: str,
        confirmed_by: str,
        is_normal: bool,
        note: str = "",
    ) -> Optional[ClearanceRecord]:
        record = self.records.get(complaint_id)
        if not record:
            return None

        if is_normal:
            record.update_status(
                new_status=ProcessingStatus.CONFIRMED_NORMAL,
                operator=confirmed_by,
                source=EvidenceSource.MANUAL_CONFIRMATION,
                details={"step": 3, "action": "confirm_normal", "note": note},
                abnormal_note=note or None,
            )
        else:
            abnormal_type = record.abnormal_type or AbnormalType.OTHER
            record.update_status(
                new_status=ProcessingStatus.CONFIRMED_ABNORMAL,
                operator=confirmed_by,
                source=EvidenceSource.MANUAL_CONFIRMATION,
                details={"step": 3, "action": "confirm_abnormal", "note": note},
                abnormal_type=abnormal_type,
                abnormal_note=note or None,
            )

        self._save_records()
        return record

    def rollback_status(
        self,
        complaint_id: str,
        operator: str,
        reason: str = "",
    ) -> Optional[ClearanceRecord]:
        record = self.records.get(complaint_id)
        if not record:
            return None

        if not BoundaryRules.get_rollback_eligibility(record.current_status):
            return None

        logs = record.audit_logs
        if len(logs) < 2:
            target_status = ProcessingStatus.IMPORTED
        else:
            target_status = logs[-2].new_status

        record.update_status(
            new_status=target_status,
            operator=operator,
            source=EvidenceSource.MANUAL_CONFIRMATION,
            details={"action": "rollback", "reason": reason},
        )
        self._save_records()
        return record

    def update_complaint_manual(
        self,
        complaint_id: str,
        field: str,
        old_value: Any,
        new_value: Any,
        operator: str,
    ) -> Optional[ClearanceRecord]:
        record = self.records.get(complaint_id)
        if not record:
            return None

        change = {
            "field": field,
            "old_value": old_value,
            "new_value": new_value,
            "operator": operator,
            "timestamp": datetime.now().isoformat(),
        }
        record.complaint.manual_changes.append(change)
        setattr(record.complaint, field, new_value)

        record.update_status(
            new_status=record.current_status,
            operator=operator,
            source=EvidenceSource.MANUAL_CONFIRMATION,
            details={"action": "manual_edit", "change": change},
        )
        self._save_records()
        return record

    def get_record(self, complaint_id: str) -> Optional[ClearanceRecord]:
        return self.records.get(complaint_id)

    def get_all_records(self) -> List[ClearanceRecord]:
        return list(self.records.values())

    def get_records_by_status(self, status: ProcessingStatus) -> List[ClearanceRecord]:
        return [r for r in self.records.values() if r.current_status == status]

    def get_trace_by_source(self, complaint_id: str) -> Dict[str, Any]:
        record = self.records.get(complaint_id)
        if not record:
            return {}

        return {
            "complaint_id": complaint_id,
            "resident_complaint_source": {
                "original_row_number": record.complaint.original_row_number,
                "raw_data": record.complaint.raw_data,
                "imported_at": record.complaint.imported_at,
                "imported_by": record.complaint.imported_by,
                "manual_changes": record.complaint.manual_changes,
            },
            "photo_supplements": [
                {
                    "photo_id": p.photo_id,
                    "reviewed_by": p.reviewed_by,
                    "reviewed_at": p.reviewed_at,
                    "scene_description": p.scene_description,
                }
                for p in record.photos
            ],
            "manual_confirmations": [
                {
                    "timestamp": l.timestamp,
                    "operator": l.operator,
                    "action": l.action,
                    "details": l.details,
                }
                for l in record.audit_logs
                if l.source == EvidenceSource.MANUAL_CONFIRMATION
            ],
            "full_audit_trail": [l.to_dict() for l in record.audit_logs],
        }

    def export_consolidated(self) -> List[Dict[str, Any]]:
        return [r.to_dict() for r in self.records.values()]
