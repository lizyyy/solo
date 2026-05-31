from __future__ import annotations

import difflib
import hashlib
import json
import os
from typing import Optional

from .models import ConfigChangeRecord


class ConfigAuditManager:
    def __init__(self, store_dir: str):
        self.store_dir = os.path.join(store_dir, "config_changes")
        self.baseline_dir = os.path.join(store_dir, "config_baselines")
        os.makedirs(self.store_dir, exist_ok=True)
        os.makedirs(self.baseline_dir, exist_ok=True)

    def record_change(
        self,
        file_path: str,
        before_content: str,
        after_content: str,
        operator: str = "manual",
        run_id: str = "",
        note: str = "",
    ) -> ConfigChangeRecord:
        before_hash = hashlib.sha256(before_content.encode()).hexdigest()[:16]
        after_hash = hashlib.sha256(after_content.encode()).hexdigest()[:16]

        diff_lines = list(
            difflib.unified_diff(
                before_content.splitlines(keepends=True),
                after_content.splitlines(keepends=True),
                fromfile=f"{file_path} (before)",
                tofile=f"{file_path} (after)",
            )
        )
        diff_text = "".join(diff_lines)

        record = ConfigChangeRecord(
            change_id="",
            file_path=file_path,
            before_hash=before_hash,
            after_hash=after_hash,
            before_content=before_content,
            after_content=after_content,
            diff=diff_text,
            operator=operator,
            run_id=run_id,
            note=note,
        )
        self._save_record(record)
        self._update_baseline(file_path, after_content)
        return record

    def detect_changes(self, file_path: str, current_content: str) -> Optional[ConfigChangeRecord]:
        baseline = self._get_baseline(file_path)
        if baseline is None:
            self._update_baseline(file_path, current_content)
            return None

        current_hash = hashlib.sha256(current_content.encode()).hexdigest()[:16]
        baseline_hash = hashlib.sha256(baseline.encode()).hexdigest()[:16]

        if current_hash == baseline_hash:
            return None

        return self.record_change(
            file_path=file_path,
            before_content=baseline,
            after_content=current_content,
            operator="detected",
            note="自动检测到配置文件变更",
        )

    def get_change(self, change_id: str) -> Optional[ConfigChangeRecord]:
        path = os.path.join(self.store_dir, f"{change_id}.json")
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ConfigChangeRecord.from_dict(data)

    def list_changes(
        self, file_filter: Optional[str] = None, run_id_filter: Optional[str] = None
    ) -> list[ConfigChangeRecord]:
        changes = []
        if not os.path.isdir(self.store_dir):
            return changes
        for fname in os.listdir(self.store_dir):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.store_dir, fname)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                record = ConfigChangeRecord.from_dict(data)
                if file_filter and record.file_path != file_filter:
                    continue
                if run_id_filter and record.run_id != run_id_filter:
                    continue
                changes.append(record)
            except Exception:
                continue
        return sorted(changes, key=lambda c: c.timestamp)

    def get_change_history(self, file_path: str) -> list[ConfigChangeRecord]:
        return self.list_changes(file_filter=file_path)

    def reconcile_with_run(self, run_id: str, run_summary: str) -> dict:
        changes = self.list_changes(run_id_filter=run_id)
        if not changes:
            return {
                "run_id": run_id,
                "status": "consistent",
                "message": "运行记录与配置变更审计一致",
                "changes": [],
            }

        discrepancies = []
        for change in changes:
            if change.operator == "manual" and not change.run_id:
                discrepancies.append(
                    {
                        "change_id": change.change_id,
                        "file_path": change.file_path,
                        "issue": "手动变更未关联运行记录",
                        "before_hash": change.before_hash,
                        "after_hash": change.after_hash,
                        "timestamp": change.timestamp,
                    }
                )

        return {
            "run_id": run_id,
            "status": "discrepancy_found" if discrepancies else "consistent",
            "message": (
                f"发现{len(discrepancies)}处运行账本与配置明细不一致"
                if discrepancies
                else "运行账本与配置变更明细一致"
            ),
            "changes": [c.to_dict() for c in changes],
            "discrepancies": discrepancies,
        }

    def _get_baseline(self, file_path: str) -> Optional[str]:
        safe_name = file_path.replace("/", "_").replace(".", "_")
        path = os.path.join(self.baseline_dir, f"{safe_name}.baseline")
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def _update_baseline(self, file_path: str, content: str) -> None:
        safe_name = file_path.replace("/", "_").replace(".", "_")
        path = os.path.join(self.baseline_dir, f"{safe_name}.baseline")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _save_record(self, record: ConfigChangeRecord) -> None:
        path = os.path.join(self.store_dir, f"{record.change_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
