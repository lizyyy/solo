import json
import os
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    ConflictEntry,
    ConflictStatus,
    JudgmentChange,
    LookbackResult,
)


class PersistenceStore:
    def __init__(self, store_dir: str):
        self.store_dir = store_dir
        self.results_dir = os.path.join(store_dir, "results")
        self.changes_dir = os.path.join(store_dir, "judgment_changes")
        self.notes_dir = os.path.join(store_dir, "notes")
        os.makedirs(self.results_dir, exist_ok=True)
        os.makedirs(self.changes_dir, exist_ok=True)
        os.makedirs(self.notes_dir, exist_ok=True)

    def save_result(self, result: LookbackResult) -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"lookback_{result.run_id}_{ts}.json"
        path = os.path.join(self.results_dir, filename)
        data = self._result_to_dict(result)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def load_latest_result(self) -> Optional[Dict]:
        files = sorted(
            [f for f in os.listdir(self.results_dir) if f.endswith(".json")],
            reverse=True,
        )
        if not files:
            return None
        path = os.path.join(self.results_dir, files[0])
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_result(self, run_id: str) -> Optional[Dict]:
        files = [f for f in os.listdir(self.results_dir) if run_id in f and f.endswith(".json")]
        if not files:
            return None
        path = os.path.join(self.results_dir, sorted(files)[-1])
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_judgment_changes(self, changes: List[JudgmentChange], run_id: str) -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"judgment_changes_{run_id}_{ts}.json"
        path = os.path.join(self.changes_dir, filename)
        data = []
        for c in changes:
            data.append({
                "record_id": c.record_id,
                "old_judgment": c.old_judgment,
                "new_judgment": c.new_judgment,
                "change_reason": c.change_reason,
                "changed_at": c.changed_at,
                "changed_by": c.changed_by,
                "attachment_id": c.attachment_id,
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def load_all_judgment_changes(self) -> List[Dict]:
        all_changes = []
        if not os.path.exists(self.changes_dir):
            return all_changes
        files = sorted(f for f in os.listdir(self.changes_dir) if f.endswith(".json"))
        for fname in files:
            path = os.path.join(self.changes_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    all_changes.extend(data)
        return all_changes

    def save_note(self, record_id: str, note_content: str, author: str = "阿宁") -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"note_{record_id}_{ts}.json"
        path = os.path.join(self.notes_dir, filename)
        data = {
            "record_id": record_id,
            "note": note_content,
            "author": author,
            "written_at": datetime.now().isoformat(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def load_notes_for_record(self, record_id: str) -> List[Dict]:
        notes = []
        if not os.path.exists(self.notes_dir):
            return notes
        for fname in sorted(os.listdir(self.notes_dir)):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.notes_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("record_id") == record_id:
                    notes.append(data)
        return notes

    def load_all_notes(self) -> List[Dict]:
        notes = []
        if not os.path.exists(self.notes_dir):
            return notes
        for fname in sorted(os.listdir(self.notes_dir)):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.notes_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                notes.append(data)
        return notes

    def verify_integrity(self) -> Dict:
        results = self._list_results()
        notes = self._list_notes()
        changes = self._list_changes()

        note_record_ids = set()
        for n in notes:
            note_record_ids.add(n.get("record_id"))

        result_record_ids = set()
        for r in results:
            for c in r.get("conflicts", []):
                for rid in c.get("record_ids", []):
                    result_record_ids.add(rid)

        orphan_notes = note_record_ids - result_record_ids

        return {
            "result_count": len(results),
            "note_count": len(notes),
            "change_count": len(changes),
            "orphan_note_count": len(orphan_notes),
            "orphan_note_record_ids": sorted(orphan_notes),
            "latest_run": results[-1].get("run_id") if results else None,
        }

    def _list_results(self) -> List[Dict]:
        items = []
        if not os.path.exists(self.results_dir):
            return items
        for fname in sorted(os.listdir(self.results_dir)):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.results_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                items.append(json.load(f))
        return items

    def _list_notes(self) -> List[Dict]:
        items = []
        if not os.path.exists(self.notes_dir):
            return items
        for fname in sorted(os.listdir(self.notes_dir)):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.notes_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                items.append(json.load(f))
        return items

    def _list_changes(self) -> List[Dict]:
        items = []
        if not os.path.exists(self.changes_dir):
            return items
        for fname in sorted(os.listdir(self.changes_dir)):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.changes_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                items.append(json.load(f))
        return items

    def _result_to_dict(self, result: LookbackResult) -> Dict:
        return {
            "run_id": result.run_id,
            "run_at": result.run_at,
            "total_records": result.total_records,
            "conflict_count": result.conflict_count,
            "duplicate_claim_count": result.duplicate_claim_count,
            "late_attachment_count": result.late_attachment_count,
            "null_field_count": result.null_field_count,
            "boundary_count": result.boundary_count,
            "summary_amount": result.summary_amount,
            "exception_amount": result.exception_amount,
            "judgment_changes": [
                {
                    "record_id": c.record_id,
                    "old_judgment": c.old_judgment,
                    "new_judgment": c.new_judgment,
                    "change_reason": c.change_reason,
                    "changed_at": c.changed_at,
                    "changed_by": c.changed_by,
                    "attachment_id": c.attachment_id,
                }
                for c in result.judgment_changes
            ],
            "conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "conflict_type": c.conflict_type.value,
                    "record_ids": c.record_ids,
                    "evidence": c.evidence,
                    "suggested_action": c.suggested_action,
                    "resolved": c.resolved,
                    "resolution_note": c.resolution_note,
                }
                for c in result.conflicts
            ],
        }
