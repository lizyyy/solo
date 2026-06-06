from datetime import datetime
from typing import List, Dict, Tuple, Optional
from ..models.photo import WorkingConditionPhoto
from ..models.batch import ImportBatch
from ..models.base import ChangeRecord
from ..models.enums import (
    ProcessingStatus,
    TemperatureUnit,
    UserRole,
    ChangeType,
)
from ..utils.temperature import parse_temperature
from ..utils.hash import generate_photo_id, generate_batch_id


class ImportService:
    def __init__(self):
        self.all_photos: Dict[str, WorkingConditionPhoto] = {}
        self.batches: Dict[str, ImportBatch] = {}

    def _check_duplicate(self, photo_id: str) -> Optional[WorkingConditionPhoto]:
        return self.all_photos.get(photo_id)

    def import_photos_from_rows(
        self,
        rows: List[Dict],
        source_file: str,
        operator: UserRole = UserRole.OPERATOR,
    ) -> Tuple[ImportBatch, List[str]]:
        timestamp_str = datetime.now().isoformat()
        batch_id = generate_batch_id(source_file, timestamp_str)
        batch = ImportBatch(batch_id=batch_id, source_file=source_file)
        skipped_duplicates: List[str] = []

        for idx, row in enumerate(rows, start=1):
            file_name = row.get("file_name", f"photo_{idx}")
            original_row = row.get("original_row", idx)
            photo_id = generate_photo_id(file_name, original_row, source_file)

            existing = self._check_duplicate(photo_id)
            if existing:
                skipped_duplicates.append(f"Row {original_row}: {file_name} (already exists)")
                continue

            temp_raw = row.get("temperature", "")
            temp_val, temp_unit, has_mixed = parse_temperature(temp_raw)

            photo = WorkingConditionPhoto(
                photo_id=photo_id,
                original_row_number=original_row,
                batch_id=batch_id,
                file_name=file_name,
                temperature_raw=temp_raw,
                temperature_value=temp_val,
                temperature_unit=temp_unit,
                has_mixed_units=has_mixed,
                balance_wheel_error=row.get("balance_wheel_error"),
            )

            if has_mixed:
                photo.error_status = ProcessingStatus.COACH_REVIEW_PENDING
            else:
                photo.error_status = ProcessingStatus.IMPORTED

            import_change = ChangeRecord(
                operator=operator,
                change_type=ChangeType.IMPORT,
                old_value=None,
                new_value=f"Imported from {source_file}, row {original_row}",
                remark=f"Temperature parsed: {temp_val} {temp_unit}, mixed={has_mixed}",
            )
            photo.add_change(import_change)

            batch.add_photo(photo)
            self.all_photos[photo_id] = photo

        self.batches[batch_id] = batch
        return batch, skipped_duplicates

    def reimport_same_batch(
        self,
        rows: List[Dict],
        source_file: str,
        existing_batch_id: str,
        operator: UserRole = UserRole.LIN_TEACHER,
    ) -> Tuple[ImportBatch, List[str], List[str]]:
        if existing_batch_id not in self.batches:
            raise ValueError(f"Batch {existing_batch_id} not found")

        existing_batch = self.batches[existing_batch_id]
        updated_photos: List[str] = []
        skipped_duplicates: List[str] = []
        added_as_new: List[str] = []

        for idx, row in enumerate(rows, start=1):
            file_name = row.get("file_name", f"photo_{idx}")
            original_row = row.get("original_row", idx)
            photo_id = generate_photo_id(file_name, original_row, source_file)

            if photo_id in existing_batch.photos:
                photo = existing_batch.photos[photo_id]
                changed = False

                new_remark = row.get("handwritten_remark")
                if new_remark and new_remark != photo.handwritten_remark:
                    old_remark = photo.handwritten_remark
                    photo.handwritten_remark = new_remark
                    change = ChangeRecord(
                        operator=operator,
                        change_type=ChangeType.REMARK_ADD,
                        field_name="handwritten_remark",
                        old_value=old_remark,
                        new_value=new_remark,
                        remark="Handwritten remark updated on reimport",
                    )
                    photo.add_change(change)
                    changed = True

                if changed:
                    updated_photos.append(f"Row {original_row}: {file_name} (updated)")
                else:
                    skipped_duplicates.append(f"Row {original_row}: {file_name} (no changes)")
            else:
                temp_raw = row.get("temperature", "")
                temp_val, temp_unit, has_mixed = parse_temperature(temp_raw)

                photo = WorkingConditionPhoto(
                    photo_id=photo_id,
                    original_row_number=original_row,
                    batch_id=existing_batch_id,
                    file_name=file_name,
                    temperature_raw=temp_raw,
                    temperature_value=temp_val,
                    temperature_unit=temp_unit,
                    has_mixed_units=has_mixed,
                    balance_wheel_error=row.get("balance_wheel_error"),
                    handwritten_remark=row.get("handwritten_remark"),
                )

                if has_mixed:
                    photo.error_status = ProcessingStatus.COACH_REVIEW_PENDING

                import_change = ChangeRecord(
                    operator=operator,
                    change_type=ChangeType.IMPORT,
                    old_value=None,
                    new_value=f"Added to batch {existing_batch_id} on reimport, row {original_row}",
                )
                photo.add_change(import_change)

                existing_batch.add_photo(photo)
                self.all_photos[photo_id] = photo
                added_as_new.append(f"Row {original_row}: {file_name} (new)")

        return existing_batch, updated_photos + added_as_new, skipped_duplicates

    def get_photo(self, photo_id: str) -> Optional[WorkingConditionPhoto]:
        return self.all_photos.get(photo_id)

    def get_photos_by_status(self, status: ProcessingStatus) -> List[WorkingConditionPhoto]:
        return [p for p in self.all_photos.values() if p.error_status == status]

    def get_batch(self, batch_id: str) -> Optional[ImportBatch]:
        return self.batches.get(batch_id)
