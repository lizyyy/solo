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


class DuplicateCategory:
    NEW = "new"
    DUPLICATE_IN_CURRENT_BATCH = "duplicate_in_batch"
    DUPLICATE_FROM_HISTORY = "duplicate_from_history"
    UNCHANGED = "unchanged"
    UPDATED = "updated"


class ImportService:
    def __init__(self):
        self.all_photos: Dict[str, WorkingConditionPhoto] = {}
        self.batches: Dict[str, ImportBatch] = {}
        self.import_audit_log: List[Dict] = []

    def _check_duplicate(self, photo_id: str) -> Optional[WorkingConditionPhoto]:
        return self.all_photos.get(photo_id)

    def _log_import_action(self, action: str, detail: Dict) -> None:
        self.import_audit_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            **detail,
        })

    def import_photos_from_rows(
        self,
        rows: List[Dict],
        source_file: str,
        operator: UserRole = UserRole.OPERATOR,
    ) -> Tuple[ImportBatch, Dict[str, List[Dict]]]:
        timestamp_str = datetime.now().isoformat()
        batch_id = generate_batch_id(source_file, timestamp_str)
        batch = ImportBatch(batch_id=batch_id, source_file=source_file)

        classified = {
            DuplicateCategory.NEW: [],
            DuplicateCategory.DUPLICATE_FROM_HISTORY: [],
            DuplicateCategory.DUPLICATE_IN_CURRENT_BATCH: [],
        }

        seen_in_this_batch = set()

        for idx, row in enumerate(rows, start=1):
            file_name = row.get("file_name", f"photo_{idx}")
            original_row = row.get("original_row", idx)
            photo_id = generate_photo_id(file_name, original_row, source_file)

            row_detail = {
                "photo_id": photo_id,
                "original_row": original_row,
                "file_name": file_name,
                "source_file": source_file,
            }

            if photo_id in seen_in_this_batch:
                classified[DuplicateCategory.DUPLICATE_IN_CURRENT_BATCH].append(row_detail)
                continue

            existing = self._check_duplicate(photo_id)
            if existing:
                classified[DuplicateCategory.DUPLICATE_FROM_HISTORY].append({
                    **row_detail,
                    "existing_batch_id": existing.batch_id,
                    "existing_version": existing.version,
                })
                continue

            seen_in_this_batch.add(photo_id)

            temp_raw = row.get("temperature", "")
            temp_val, temp_unit, has_mixed = parse_temperature(temp_raw)

            photo = WorkingConditionPhoto(
                photo_id=photo_id,
                original_row_number=original_row,
                batch_id=batch_id,
                file_name=file_name,
                source_file=source_file,
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
            classified[DuplicateCategory.NEW].append(row_detail)

        self.batches[batch_id] = batch

        self._log_import_action("import", {
            "batch_id": batch_id,
            "source_file": source_file,
            "operator": operator.value,
            "new_count": len(classified[DuplicateCategory.NEW]),
            "history_dup_count": len(classified[DuplicateCategory.DUPLICATE_FROM_HISTORY]),
            "batch_dup_count": len(classified[DuplicateCategory.DUPLICATE_IN_CURRENT_BATCH]),
        })

        return batch, classified

    def reimport_same_batch(
        self,
        rows: List[Dict],
        source_file: str,
        existing_batch_id: str,
        operator: UserRole = UserRole.LIN_TEACHER,
    ) -> Tuple[ImportBatch, Dict[str, List[Dict]]]:
        if existing_batch_id not in self.batches:
            raise ValueError(f"Batch {existing_batch_id} not found")

        existing_batch = self.batches[existing_batch_id]

        classified = {
            DuplicateCategory.NEW: [],
            DuplicateCategory.UNCHANGED: [],
            DuplicateCategory.UPDATED: [],
            DuplicateCategory.DUPLICATE_FROM_HISTORY: [],
        }

        for idx, row in enumerate(rows, start=1):
            file_name = row.get("file_name", f"photo_{idx}")
            original_row = row.get("original_row", idx)
            photo_id = generate_photo_id(file_name, original_row, source_file)

            row_detail = {
                "photo_id": photo_id,
                "original_row": original_row,
                "file_name": file_name,
                "source_file": source_file,
            }

            if photo_id in existing_batch.photos:
                photo = existing_batch.photos[photo_id]
                changed_fields = {}

                new_remark = row.get("handwritten_remark")
                if new_remark is not None and new_remark != photo.handwritten_remark:
                    old_remark = photo.handwritten_remark
                    photo.handwritten_remark = new_remark
                    changed_fields["handwritten_remark"] = {
                        "old": old_remark,
                        "new": new_remark,
                    }

                new_error = row.get("balance_wheel_error")
                if new_error is not None and new_error != photo.balance_wheel_error:
                    old_error = photo.balance_wheel_error
                    photo.balance_wheel_error = new_error
                    changed_fields["balance_wheel_error"] = {
                        "old": old_error,
                        "new": new_error,
                    }

                if changed_fields:
                    change = ChangeRecord(
                        operator=operator,
                        change_type=ChangeType.MANUAL_EDIT,
                        field_name=", ".join(changed_fields.keys()),
                        old_value="; ".join([f"{k}={v['old']}" for k, v in changed_fields.items()]),
                        new_value="; ".join([f"{k}={v['new']}" for k, v in changed_fields.items()]),
                        remark="Fields updated on reimport by Lin teacher",
                    )
                    photo.add_change(change)
                    classified[DuplicateCategory.UPDATED].append({
                        **row_detail,
                        "changed_fields": list(changed_fields.keys()),
                        "changes": changed_fields,
                    })
                else:
                    classified[DuplicateCategory.UNCHANGED].append(row_detail)
            else:
                global_existing = self._check_duplicate(photo_id)
                if global_existing:
                    classified[DuplicateCategory.DUPLICATE_FROM_HISTORY].append({
                        **row_detail,
                        "existing_batch_id": global_existing.batch_id,
                        "existing_version": global_existing.version,
                    })
                    continue

                temp_raw = row.get("temperature", "")
                temp_val, temp_unit, has_mixed = parse_temperature(temp_raw)

                photo = WorkingConditionPhoto(
                    photo_id=photo_id,
                    original_row_number=original_row,
                    batch_id=existing_batch_id,
                    file_name=file_name,
                    source_file=source_file,
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
                classified[DuplicateCategory.NEW].append(row_detail)

        self._log_import_action("reimport", {
            "batch_id": existing_batch_id,
            "source_file": source_file,
            "operator": operator.value,
            "new_count": len(classified[DuplicateCategory.NEW]),
            "updated_count": len(classified[DuplicateCategory.UPDATED]),
            "unchanged_count": len(classified[DuplicateCategory.UNCHANGED]),
            "history_dup_count": len(classified[DuplicateCategory.DUPLICATE_FROM_HISTORY]),
        })

        return existing_batch, classified

    def get_photo(self, photo_id: str) -> Optional[WorkingConditionPhoto]:
        return self.all_photos.get(photo_id)

    def get_photos_by_status(self, status: ProcessingStatus) -> List[WorkingConditionPhoto]:
        return [p for p in self.all_photos.values() if p.error_status == status]

    def get_batch(self, batch_id: str) -> Optional[ImportBatch]:
        return self.batches.get(batch_id)

    def get_import_audit_log(self) -> List[Dict]:
        return list(self.import_audit_log)
