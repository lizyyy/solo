from datetime import datetime
from typing import List, Dict, Optional, Tuple
from models import (
    InspectionPhoto,
    ObstacleRecord,
    Coordinate3D,
    ObstacleType,
    RecordStatus,
    HistoryEntry,
    deterministic_id,
)


class PhotoMatcher:
    def __init__(self, existing_records: List[ObstacleRecord]):
        self.existing_records = existing_records
        self.history: List[HistoryEntry] = []
        self.new_records: List[ObstacleRecord] = []

    def match_photos(
        self,
        photos_data: List[Dict],
        building_id: str,
        actor: str = "xiaotao",
    ) -> Dict:
        photos = []
        for idx, photo_data in enumerate(photos_data):
            pos = photo_data["position"]
            photo = InspectionPhoto(
                photo_id=deterministic_id(
                    "photo",
                    building_id,
                    idx,
                    photo_data["photo_number"],
                    photo_data["obstacle_name"],
                    photo_data["type"],
                    pos.get("x"), pos.get("y"), pos.get("z"),
                ),
                photo_number=photo_data["photo_number"],
                building_id=building_id,
                obstacle_name=photo_data["obstacle_name"],
                obstacle_type=ObstacleType(photo_data["type"]),
                position=Coordinate3D(**photo_data["position"]),
                taken_at=datetime.fromisoformat(photo_data["taken_at"]),
                old_caliber=photo_data.get("old_caliber"),
            )
            photos.append(photo)

            self._add_history(
                action="LOAD_INSPECTION_PHOTO",
                actor=actor,
                details={
                    "photo_id": photo.photo_id,
                    "photo_number": photo.photo_number,
                    "obstacle_name": photo.obstacle_name,
                    "position": photo_data["position"],
                    "has_old_caliber": photo.old_caliber is not None,
                },
            )

        for photo in photos:
            match_result = self._find_matching_record(photo)

            if match_result:
                record, match_type = match_result
                self._process_match(record, photo, match_type, actor)
            else:
                self._create_supplemented_record(photo, building_id, actor)

        return {
            "photos": photos,
            "updated_records": self.existing_records,
            "new_records": self.new_records,
            "history": self.history.copy(),
        }

    def _find_matching_record(
        self, photo: InspectionPhoto
    ) -> Optional[Tuple[ObstacleRecord, str]]:
        for record in self.existing_records:
            if record.photo_number == photo.photo_number:
                return record, "photo_number"

            if self._positions_match(record.position, photo.position):
                if record.obstacle_name == photo.obstacle_name:
                    return record, "position_exact_name"
                else:
                    return record, "position_diff_name"

            if record.obstacle_name == photo.obstacle_name:
                return record, "name_only"

        return None

    def _positions_match(self, pos1: Coordinate3D, pos2: Coordinate3D, tolerance: float = 0.5) -> bool:
        return (
            abs(pos1.x - pos2.x) <= tolerance
            and abs(pos1.y - pos2.y) <= tolerance
            and abs(pos1.z - pos2.z) <= tolerance
        )

    def _process_match(
        self,
        record: ObstacleRecord,
        photo: InspectionPhoto,
        match_type: str,
        actor: str,
    ):
        if match_type == "position_diff_name":
            record.status = RecordStatus.DUPLICATE_NAME
            record.caliber_source = "photo_supplement"
            record.updated_at = datetime.now()

            self._add_history(
                action="DETECT_DUPLICATE_NAME",
                actor=actor,
                details={
                    "record_id": record.record_id,
                    "origin_name": record.obstacle_name,
                    "photo_name": photo.obstacle_name,
                    "photo_number": photo.photo_number,
                    "position": {"x": photo.position.x, "y": photo.position.y, "z": photo.position.z},
                    "match_type": match_type,
                },
                record_id=record.record_id,
            )
        else:
            if photo.old_caliber and record.caliber_source == "coordinate_origin_spec":
                record.status = RecordStatus.SUPPLEMENTED
                record.caliber_source = "photo_supplement"
                record.conflict_evidence = {
                    "old_caliber": photo.old_caliber,
                    "photo_number": photo.photo_number,
                }
                record.updated_at = datetime.now()

                self._add_history(
                    action="SUPPLEMENT_FROM_PHOTO",
                    actor=actor,
                    details={
                        "record_id": record.record_id,
                        "obstacle_name": record.obstacle_name,
                        "photo_number": photo.photo_number,
                        "old_caliber": photo.old_caliber,
                        "previous_status": RecordStatus.NORMAL.value,
                        "new_status": RecordStatus.SUPPLEMENTED.value,
                    },
                    record_id=record.record_id,
                )
            else:
                record.photo_number = photo.photo_number
                record.updated_at = datetime.now()

                self._add_history(
                    action="LINK_PHOTO_TO_RECORD",
                    actor=actor,
                    details={
                        "record_id": record.record_id,
                        "photo_number": photo.photo_number,
                        "match_type": match_type,
                    },
                    record_id=record.record_id,
                )

    def _create_supplemented_record(
        self, photo: InspectionPhoto, building_id: str, actor: str
    ):
        new_record = ObstacleRecord(
            record_id=deterministic_id(
                "rec",
                building_id,
                "photo_supplement",
                photo.photo_number,
                photo.obstacle_name,
                photo.obstacle_type.value,
                photo.position.x, photo.position.y, photo.position.z,
            ),
            building_id=building_id,
            obstacle_name=photo.obstacle_name,
            obstacle_type=photo.obstacle_type,
            position=photo.position,
            photo_number=photo.photo_number,
            status=RecordStatus.SUPPLEMENTED,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            caliber_source="photo_supplement",
            conflict_evidence={
                "old_caliber": photo.old_caliber,
                "supplemented_from": "inspection_photo",
            }
            if photo.old_caliber
            else None,
        )
        self.new_records.append(new_record)

        self._add_history(
            action="CREATE_SUPPLEMENTED_RECORD",
            actor=actor,
            details={
                "record_id": new_record.record_id,
                "obstacle_name": new_record.obstacle_name,
                "photo_number": photo.photo_number,
                "position": {"x": photo.position.x, "y": photo.position.y, "z": photo.position.z},
                "old_caliber": photo.old_caliber,
            },
            record_id=new_record.record_id,
        )

    def _add_history(
        self,
        action: str,
        actor: str,
        details: Dict,
        record_id: Optional[str] = None,
    ):
        entry = HistoryEntry(
            entry_id=deterministic_id("hist", action, actor, record_id,
                                       str(sorted(details.items())) if details else "", len(self.history)),
            timestamp=datetime.now(),
            action=action,
            actor=actor,
            details=details,
            record_id=record_id,
        )
        self.history.append(entry)
