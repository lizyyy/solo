import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import uuid

from .models import (
    RehearsalSignUp, RepertoireRecord, ChangeHistory, ChangeEntry,
    ContractInfo, WorkflowStage, ReviewStatus, DiscrepancyType
)


class Storage:
    """本地文件存储 - 所有记录可审计、可回溯"""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.signups_dir = os.path.join(data_dir, "signups")
        self.records_dir = os.path.join(data_dir, "records")
        self.history_dir = os.path.join(data_dir, "history")
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [self.data_dir, self.signups_dir, self.records_dir, self.history_dir]:
            os.makedirs(d, exist_ok=True)

    def save_signup(self, signup: RehearsalSignUp) -> None:
        path = os.path.join(self.signups_dir, f"{signup.source_hash()}.json")
        with open(path, "w", encoding="utf-8") as f:
            data = {
                "batch_id": signup.batch_id,
                "original_line_number": signup.original_line_number,
                "student_name": signup.student_name,
                "song_name_raw": signup.song_name_raw,
                "raw_text": signup.raw_text,
                "imported_at": signup.imported_at.isoformat(),
                "import_note": signup.import_note,
            }
            json.dump(data, f, ensure_ascii=False, indent=2)

    def signup_exists(self, source_hash: str) -> bool:
        return os.path.exists(os.path.join(self.signups_dir, f"{source_hash}.json"))

    def load_signup(self, source_hash: str) -> Optional[RehearsalSignUp]:
        path = os.path.join(self.signups_dir, f"{source_hash}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return RehearsalSignUp(
            batch_id=data["batch_id"],
            original_line_number=data["original_line_number"],
            student_name=data["student_name"],
            song_name_raw=data["song_name_raw"],
            raw_text=data["raw_text"],
            imported_at=datetime.fromisoformat(data["imported_at"]),
            import_note=data.get("import_note"),
        )

    def list_signups(self, batch_id: Optional[str] = None) -> List[RehearsalSignUp]:
        signups = []
        for fname in os.listdir(self.signups_dir):
            if not fname.endswith(".json"):
                continue
            h = fname[:-5]
            signup = self.load_signup(h)
            if signup and (batch_id is None or signup.batch_id == batch_id):
                signups.append(signup)
        return sorted(signups, key=lambda s: (s.batch_id, s.original_line_number))

    def save_record(self, record: RepertoireRecord) -> None:
        path = os.path.join(self.records_dir, f"{record.record_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            data = record.to_dict()
            data["created_at"] = record.created_at.isoformat()
            data["updated_at"] = record.updated_at.isoformat()
            if record.confirmed_at:
                data["confirmed_at"] = record.confirmed_at.isoformat()
            if record.contract_info:
                data["contract_info"] = {
                    "contract_id": record.contract_info.contract_id,
                    "song_copyright_name": record.contract_info.song_copyright_name,
                    "screenshot_path": record.contract_info.screenshot_path,
                    "supplemented_by": record.contract_info.supplemented_by,
                    "supplemented_at": record.contract_info.supplemented_at.isoformat(),
                    "note": record.contract_info.note,
                }
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_record(self, record_id: str) -> Optional[RepertoireRecord]:
        path = os.path.join(self.records_dir, f"{record_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        contract = None
        if data.get("contract_info"):
            ci = data["contract_info"]
            contract = ContractInfo(
                contract_id=ci["contract_id"],
                song_copyright_name=ci["song_copyright_name"],
                screenshot_path=ci["screenshot_path"],
                supplemented_by=ci["supplemented_by"],
                supplemented_at=datetime.fromisoformat(ci["supplemented_at"]),
                note=ci.get("note"),
            )
        return RepertoireRecord(
            record_id=data["record_id"],
            student_name=data["student_name"],
            song_display_name=data["song_display_name"],
            workflow_stage=WorkflowStage(data["workflow_stage"]),
            review_status=ReviewStatus(data["review_status"]),
            discrepancy_type=DiscrepancyType(data["discrepancy_type"]) if data.get("discrepancy_type") else None,
            discrepancy_note=data.get("discrepancy_note"),
            source_signup_hashes=data.get("source_signup_hashes", []),
            contract_info=contract,
            confirmed_by=data.get("confirmed_by"),
            confirmed_at=datetime.fromisoformat(data["confirmed_at"]) if data.get("confirmed_at") else None,
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
        )

    def list_records(self, review_status: Optional[ReviewStatus] = None) -> List[RepertoireRecord]:
        records = []
        for fname in os.listdir(self.records_dir):
            if not fname.endswith(".json"):
                continue
            rid = fname[:-5]
            record = self.load_record(rid)
            if record and (review_status is None or record.review_status == review_status):
                records.append(record)
        return sorted(records, key=lambda r: r.created_at)

    def save_history(self, history: ChangeHistory) -> None:
        path = os.path.join(self.history_dir, f"{history.history_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            data = {
                "history_id": history.history_id,
                "record_id": history.record_id,
                "operator": history.operator,
                "operation": history.operation,
                "changes": [{"field_name": c.field_name, "old_value": c.old_value, "new_value": c.new_value} for c in history.changes],
                "timestamp": history.timestamp.isoformat(),
                "note": history.note,
            }
            json.dump(data, f, ensure_ascii=False, indent=2)

    def list_history(self, record_id: Optional[str] = None) -> List[ChangeHistory]:
        history_list = []
        for fname in sorted(os.listdir(self.history_dir)):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.history_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if record_id and data["record_id"] != record_id:
                continue
            history = ChangeHistory(
                history_id=data["history_id"],
                record_id=data["record_id"],
                operator=data["operator"],
                operation=data["operation"],
                changes=[ChangeEntry(**c) for c in data["changes"]],
                timestamp=datetime.fromisoformat(data["timestamp"]),
                note=data.get("note"),
            )
            history_list.append(history)
        return history_list


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"
