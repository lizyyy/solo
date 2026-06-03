import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import CoordinateOrigin, InspectionPhoto, PreflightRecord


class PreflightManager:
    def __init__(self):
        self._coordinate_origins: Dict[str, CoordinateOrigin] = {}
        self._inspection_photos: Dict[str, InspectionPhoto] = {}
        self._preflight_records: Dict[str, PreflightRecord] = {}
        self._origin_hash_index: Dict[str, str] = {}

    def import_coordinate_origins(
        self, origins: List[CoordinateOrigin], actor: str = "system"
    ) -> Tuple[List[PreflightRecord], Dict[str, str]]:
        created_records = []
        skipped_origins = {}

        for origin in origins:
            origin_hash = origin.get_hash()

            if origin_hash in self._origin_hash_index:
                existing_id = self._origin_hash_index[origin_hash]
                skipped_origins[origin.id] = f"duplicate_of_{existing_id}"
                continue

            self._coordinate_origins[origin.id] = origin
            self._origin_hash_index[origin_hash] = origin.id

            record = PreflightRecord(
                id=f"preflight_{uuid.uuid4().hex[:8]}",
                coordinate_origin_id=origin.id,
                status="imported",
            )
            record.add_history_entry(
                "import", actor, {"origin_id": origin.id, "origin_name": origin.name}
            )
            self._preflight_records[record.id] = record
            created_records.append(record)

        return created_records, skipped_origins

    def add_inspection_photo(
        self, photo: InspectionPhoto, actor: str = "designer_ajing"
    ) -> Optional[PreflightRecord]:
        if photo.coordinate_origin_id not in self._coordinate_origins:
            return None

        self._inspection_photos[photo.id] = photo

        record = self._get_preflight_by_origin(photo.coordinate_origin_id)
        if record:
            block_detected = photo.is_alert_label_blocked()
            record.block_detected = block_detected
            record.updated_at = datetime.now()

            if block_detected:
                record.status = "needs_review"
                record.review_status = "pending"
            else:
                record.status = "photo_attached"

            record.add_history_entry(
                "photo_added",
                actor,
                {
                    "photo_id": photo.id,
                    "photo_number": photo.photo_number,
                    "remark": photo.remark,
                    "block_detected": block_detected,
                },
            )

        return record

    def update_photo_remark(
        self, photo_id: str, new_remark: str, actor: str = "designer_ajing"
    ) -> Optional[Dict[str, str]]:
        photo = self._inspection_photos.get(photo_id)
        if not photo:
            return None

        old_remark = photo.remark
        if old_remark == new_remark:
            return {"old": old_remark, "new": new_remark, "changed": False}

        photo.remark = new_remark
        photo.updated_at = datetime.now()

        record = self._get_preflight_by_origin(photo.coordinate_origin_id)
        if record:
            record.add_history_entry(
                "remark_updated",
                actor,
                {
                    "photo_id": photo_id,
                    "old_remark": old_remark,
                    "new_remark": new_remark,
                },
            )
            record.updated_at = datetime.now()

        return {"old": old_remark, "new": new_remark, "changed": True}

    def _get_preflight_by_origin(self, origin_id: str) -> Optional[PreflightRecord]:
        for record in self._preflight_records.values():
            if record.coordinate_origin_id == origin_id:
                return record
        return None

    def get_preflight_record(self, record_id: str) -> Optional[PreflightRecord]:
        return self._preflight_records.get(record_id)

    def get_preflight_by_origin_id(self, origin_id: str) -> Optional[PreflightRecord]:
        return self._get_preflight_by_origin(origin_id)

    def get_all_preflight_records(self) -> List[PreflightRecord]:
        return list(self._preflight_records.values())

    def get_coordinate_origin(self, origin_id: str) -> Optional[CoordinateOrigin]:
        return self._coordinate_origins.get(origin_id)

    def get_inspection_photo(self, photo_id: str) -> Optional[InspectionPhoto]:
        return self._inspection_photos.get(photo_id)

    def get_photos_by_origin_id(self, origin_id: str) -> List[InspectionPhoto]:
        return [
            photo
            for photo in self._inspection_photos.values()
            if photo.coordinate_origin_id == origin_id
        ]

    def get_record_history(self, record_id: str) -> Optional[List[Dict]]:
        record = self._preflight_records.get(record_id)
        if not record:
            return None
        return record.history
