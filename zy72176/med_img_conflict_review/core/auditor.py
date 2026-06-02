from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import AuditNote, ConflictRecord


class Auditor:
    def __init__(self, store_path: str | Path):
        self.store_path = Path(store_path)
        self.notes: list[AuditNote] = []
        self._load()

    def _load(self) -> None:
        if self.store_path.exists():
            with open(self.store_path, encoding="utf-8") as f:
                data = json.load(f)
            self.notes = [AuditNote(**n) for n in data]

    def _save(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(
                [self._note_to_dict(n) for n in self.notes],
                f,
                ensure_ascii=False,
                indent=2,
            )

    @staticmethod
    def _note_to_dict(n: AuditNote) -> dict:
        return {
            "note_id": n.note_id,
            "target_id": n.target_id,
            "target_type": n.target_type,
            "operator": n.operator,
            "note_content": n.note_content,
            "prev_value": n.prev_value,
            "new_value": n.new_value,
            "diff_description": n.diff_description,
            "source": n.source,
            "created_at": n.created_at,
        }

    def add_note(
        self,
        target_id: str,
        operator: str,
        note_content: str,
        prev_value: str = "",
        new_value: str = "",
        target_type: str = "conflict",
        source: str = "manual_note",
    ) -> AuditNote:
        diff_description = ""
        if prev_value and new_value:
            diff_description = f"变更: '{prev_value}' → '{new_value}'"
        elif new_value:
            diff_description = f"新增: '{new_value}'"

        note = AuditNote(
            target_id=target_id,
            target_type=target_type,
            operator=operator,
            note_content=note_content,
            prev_value=prev_value,
            new_value=new_value,
            diff_description=diff_description,
            source=source,
        )
        self.notes.append(note)
        self._save()
        return note

    def resolve_conflict(
        self,
        conflict: ConflictRecord,
        resolution: str,
        operator: str,
    ) -> AuditNote:
        prev = "unresolved"
        conflict.resolved = True
        conflict.resolution = resolution
        diff = f"冲突状态变更: '{prev}' → 'resolved'; 处理结论: {resolution}"
        note = AuditNote(
            target_id=conflict.conflict_id,
            target_type="conflict",
            operator=operator,
            note_content=f"解决冲突: {resolution}",
            prev_value=prev,
            new_value="resolved",
            diff_description=diff,
            source="conflict_resolution",
        )
        self.notes.append(note)
        self._save()
        return note

    def get_notes_for(self, target_id: str) -> list[AuditNote]:
        return [n for n in self.notes if n.target_id == target_id]

    def get_all_notes(self) -> list[AuditNote]:
        return list(self.notes)

    def export_notes(self) -> list[dict]:
        return [self._note_to_dict(n) for n in self.notes]
