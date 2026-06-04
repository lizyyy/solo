from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from models import (
    ManualInspectionNote,
    SolarTrackingBracketError,
    VersionHistory,
)
from boundary_rules import BoundaryRuleEngine
import hashlib
import json


@dataclass
class ImportResult:
    batch_id: str
    total_notes: int
    new_notes: int
    duplicate_notes: int
    updated_notes: int
    created_errors: int
    duplicate_errors_skipped: int
    errors: List[SolarTrackingBracketError] = field(default_factory=list)
    updated_original_notes: List[ManualInspectionNote] = field(default_factory=list)


class ImportService:
    def __init__(self, rule_engine: BoundaryRuleEngine):
        self.rule_engine = rule_engine
        self._note_store: Dict[str, ManualInspectionNote] = {}
        self._error_store: Dict[str, SolarTrackingBracketError] = {}
        self._error_by_note_hash: Dict[str, str] = {}
        self._history_store: Dict[str, List[VersionHistory]] = {}

    def _generate_batch_id(self) -> str:
        return f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def _calculate_file_hash(self, notes: List[ManualInspectionNote]) -> str:
        content = json.dumps(
            [n.content_hash() for n in notes], sort_keys=True
        )
        return hashlib.sha256(content.encode()).hexdigest()

    def import_notes(
        self,
        notes: List[ManualInspectionNote],
    ) -> ImportResult:
        batch_id = self._generate_batch_id()
        file_hash = self._calculate_file_hash(notes)

        result = ImportResult(
            batch_id=batch_id,
            total_notes=len(notes),
            new_notes=0,
            duplicate_notes=0,
            updated_notes=0,
            created_errors=0,
            duplicate_errors_skipped=0,
        )

        for note in notes:
            note.import_batch_id = batch_id
            note.source_file_hash = file_hash
            note.calculate_sampling_duration()

            note_hash = note.content_hash()

            if note.note_id in self._note_store:
                existing_note = self._note_store[note.note_id]
                existing_hash = existing_note.content_hash()

                if note_hash == existing_hash:
                    result.duplicate_notes += 1

                    if note_hash in self._error_by_note_hash:
                        result.duplicate_errors_skipped += 1
                    continue
                else:
                    note.version = existing_note.version + 1
                    result.updated_notes += 1
                    result.updated_original_notes.append(existing_note)
            else:
                result.new_notes += 1

            self._note_store[note.note_id] = note

            error = self.rule_engine.create_error_from_note(note, batch_id)
            error.source_note_hash = note_hash

            self._error_store[error.error_id] = error
            self._error_by_note_hash[note_hash] = error.error_id
            self._history_store[error.error_id] = []

            result.errors.append(error)
            result.created_errors += 1

        return result

    def update_single_note(
        self,
        note_id: str,
        updated_note: ManualInspectionNote,
        modified_by: str,
        modification_reason: str,
    ) -> Tuple[SolarTrackingBracketError, VersionHistory, Optional[SolarTrackingBracketError]]:
        if note_id not in self._note_store:
            raise ValueError(f"找不到备注 {note_id}")

        old_note = self._note_store[note_id]
        old_hash = old_note.content_hash()

        updated_note.version = old_note.version + 1
        updated_note.import_batch_id = old_note.import_batch_id
        updated_note.source_file_hash = old_note.source_file_hash
        updated_note.calculate_sampling_duration()

        self._note_store[note_id] = updated_note

        old_error_id = self._error_by_note_hash.get(old_hash)
        old_error: Optional[SolarTrackingBracketError] = None
        if old_error_id and old_error_id in self._error_store:
            old_error = self._error_store[old_error_id]

        batch_id = old_note.import_batch_id
        new_error = self.rule_engine.create_error_from_note(updated_note, batch_id)
        new_error.source_note_hash = updated_note.content_hash()

        if old_error:
            new_error.error_id = old_error.error_id
            new_error.created_at = old_error.created_at
            new_error.version = old_error.version + 1

            before_data = old_error.to_dict()
            after_data = new_error.to_dict()

            fields_changed = self._find_changed_fields(before_data, after_data)

            history = VersionHistory(
                error_id=new_error.error_id,
                version=new_error.version,
                before_data=before_data,
                after_data=after_data,
                modified_by=modified_by,
                modification_reason=modification_reason,
                fields_changed=fields_changed,
            )

            if new_error.error_id not in self._history_store:
                self._history_store[new_error.error_id] = []
            self._history_store[new_error.error_id].append(history)

            del self._error_by_note_hash[old_hash]
        else:
            history = VersionHistory(
                error_id=new_error.error_id,
                version=new_error.version,
                before_data={},
                after_data=new_error.to_dict(),
                modified_by=modified_by,
                modification_reason=modification_reason,
                fields_changed=["all"],
            )
            self._history_store[new_error.error_id] = [history]

        self._error_store[new_error.error_id] = new_error
        self._error_by_note_hash[new_error.source_note_hash] = new_error.error_id

        return new_error, history, old_error

    def _find_changed_fields(
        self, before: Dict[str, Any], after: Dict[str, Any]
    ) -> List[str]:
        changed: List[str] = []
        for key in set(before.keys()) | set(after.keys()):
            if key in ["updated_at", "version"]:
                continue
            if before.get(key) != after.get(key):
                changed.append(key)
        return changed

    def get_error_history(self, error_id: str) -> List[VersionHistory]:
        return self._history_store.get(error_id, [])

    def get_error(self, error_id: str) -> Optional[SolarTrackingBracketError]:
        return self._error_store.get(error_id)

    def get_note(self, note_id: str) -> Optional[ManualInspectionNote]:
        return self._note_store.get(note_id)

    def get_all_errors(self) -> List[SolarTrackingBracketError]:
        return list(self._error_store.values())

    def get_pending_review_errors(self) -> List[SolarTrackingBracketError]:
        from models import ErrorStatus
        return [
            e for e in self._error_store.values()
            if e.status == ErrorStatus.PENDING_REVIEW
        ]

    def compare_versions(
        self, error_id: str, version_a: int, version_b: int
    ) -> Optional[Dict[str, Any]]:
        history = self._history_store.get(error_id, [])
        if not history:
            return None

        all_versions: Dict[int, Dict[str, Any]] = {}

        error = self._error_store.get(error_id)
        if error:
            all_versions[error.version] = error.to_dict()

        for h in history:
            all_versions[h.version] = h.after_data
            all_versions[h.version - 1] = h.before_data

        if version_a not in all_versions or version_b not in all_versions:
            return None

        data_a = all_versions[version_a]
        data_b = all_versions[version_b]

        changes: Dict[str, Dict[str, Any]] = {}
        all_keys = set(data_a.keys()) | set(data_b.keys())

        for key in all_keys:
            val_a = data_a.get(key)
            val_b = data_b.get(key)
            if val_a != val_b:
                changes[key] = {
                    "before": val_a,
                    "after": val_b,
                }

        return {
            "error_id": error_id,
            "version_a": version_a,
            "version_b": version_b,
            "changes": changes,
        }

    def get_version_diff_for_humans(
        self, error_id: str, version_a: int, version_b: int
    ) -> List[str]:
        diff = self.compare_versions(error_id, version_a, version_b)
        if not diff:
            return ["找不到版本对比数据"]

        human_messages: List[str] = []
        changes = diff["changes"]

        field_names = {
            "azimuth_error": "方位角误差",
            "elevation_error": "俯仰角误差",
            "tracking_accuracy": "跟踪准确率",
            "sampling_start_time": "采样开始时间",
            "sampling_end_time": "采样结束时间",
            "sampling_duration_minutes": "采样时长",
            "status": "状态",
            "human_readable_issues": "问题描述",
        }

        for field, change in changes.items():
            name = field_names.get(field, field)
            before = change["before"]
            after = change["after"]

            if field == "sampling_start_time" or field == "sampling_end_time":
                if before:
                    before = datetime.fromisoformat(before).strftime("%H:%M")
                if after:
                    after = datetime.fromisoformat(after).strftime("%H:%M")

            human_messages.append(
                f"[{name}] 改前: {before} → 改后: {after}"
            )

        return human_messages
