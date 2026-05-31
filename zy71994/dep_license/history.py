from __future__ import annotations

import hashlib
import json
import os
from typing import Optional

from .models import (
    DirectorySnapshot,
    LicenseEntry,
    RunRecord,
    RunStatus,
    DuplicateExecutionIssue,
    EvidenceRef,
    EvidenceType,
)


class HistoryManager:
    def __init__(self, store_dir: str):
        self.store_dir = os.path.join(store_dir, "history")
        self.index_path = os.path.join(self.store_dir, "_index.json")
        os.makedirs(self.store_dir, exist_ok=True)
        self._index: dict[str, dict] = self._load_index()

    def _load_index(self) -> dict[str, dict]:
        if os.path.isfile(self.index_path):
            with open(self.index_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _save_index(self) -> None:
        with open(self.index_path, "w", encoding="utf-8") as f:
            json.dump(self._index, f, ensure_ascii=False, indent=2)

    def _compute_material_fingerprint(self, snapshot_id: str, entries: list[LicenseEntry]) -> str:
        parts = []
        for entry in sorted(entries, key=lambda entry: entry.entry_id):
            parts.append(f"{entry.package_name}@{entry.version}")
        raw = "|".join(parts)
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    def record_run(
        self,
        entries: list[LicenseEntry],
        snapshot_id: str,
        rollback_ids: Optional[list[str]] = None,
        config_change_ids: Optional[list[str]] = None,
        operator: str = "",
    ) -> RunRecord:
        fingerprint = self._compute_material_fingerprint(snapshot_id, entries)
        existing_run_id = self._index.get(fingerprint, {}).get("run_id")

        if existing_run_id:
            existing_run = self.get_run(existing_run_id)
            if existing_run:
                issues = self._detect_duplicate_issues(
                    existing_run, entries, snapshot_id, rollback_ids or []
                )
                if issues:
                    run = RunRecord(
                        status=RunStatus.DUPLICATE_OVERRIDE,
                        entries=entries,
                        issues=issues,
                        snapshot_id=snapshot_id,
                        rollback_ids=rollback_ids or [],
                        config_change_ids=config_change_ids or [],
                        operator=operator,
                        summary=(
                            f"重复执行检测：同一批材料(fingerprint={fingerprint})已存在于"
                            f"run_id={existing_run_id}。本次运行记录为DUPLICATE_OVERRIDE，"
                            f"共{len(issues)}个冲突条目。"
                        ),
                    )
                    self._save_run(run)
                    return run

                existing_run.is_historical = True
                self._save_run(existing_run)
                return existing_run

        run = RunRecord(
            status=RunStatus.SUCCESS,
            entries=entries,
            snapshot_id=snapshot_id,
            rollback_ids=rollback_ids or [],
            config_change_ids=config_change_ids or [],
            operator=operator,
            summary=f"扫描完成，共{len(entries)}个依赖条目。fingerprint={fingerprint}",
        )
        self._save_run(run)
        self._index[fingerprint] = {
            "run_id": run.run_id,
            "snapshot_id": snapshot_id,
            "timestamp": run.timestamp,
        }
        self._save_index()
        return run

    def _detect_duplicate_issues(
        self,
        previous_run: RunRecord,
        new_entries: list[LicenseEntry],
        snapshot_id: str,
        rollback_ids: list[str],
    ) -> list[DuplicateExecutionIssue]:
        issues: list[DuplicateExecutionIssue] = []
        prev_map = {e.entry_id: e for e in previous_run.entries}
        new_map = {e.entry_id: e for e in new_entries}

        for eid, new_entry in new_map.items():
            if eid in prev_map:
                prev_entry = prev_map[eid]
                if prev_entry.license_type != new_entry.license_type:
                    if rollback_ids:
                        evidence_source = EvidenceType.ROLLBACK_RECORD
                        source_id = rollback_ids[0]
                        desc = (
                            f"依赖{new_entry.package_name}@{new_entry.version}许可证类型"
                            f"从'{prev_entry.license_type}'变为'{new_entry.license_type}'，"
                            f"可能来自回滚操作。"
                        )
                        action = "核实回滚记录，确认版本变更是否合规"
                        responsible = "回滚操作执行人"
                    else:
                        evidence_source = EvidenceType.DIRECTORY_SNAPSHOT
                        source_id = snapshot_id
                        desc = (
                            f"依赖{new_entry.package_name}@{new_entry.version}许可证类型"
                            f"从'{prev_entry.license_type}'变为'{new_entry.license_type}'，"
                            f"来源为目录快照变化。"
                        )
                        action = "比对目录快照差异，确认依赖变更原因"
                        responsible = "依赖维护负责人"

                    issue = DuplicateExecutionIssue(
                        issue_id=hashlib.sha256(
                            f"issue:{eid}:{new_entry.license_type}".encode()
                        ).hexdigest()[:16],
                        package_name=new_entry.package_name,
                        version=new_entry.version,
                        previous_entry_id=eid,
                        conflicting_entry_id=eid,
                        evidence_source=evidence_source,
                        source_record_id=source_id,
                        description=desc,
                        suggested_action=action,
                        responsible_hint=responsible,
                    )
                    issues.append(issue)

        return issues

    def get_run(self, run_id: str) -> Optional[RunRecord]:
        path = os.path.join(self.store_dir, f"{run_id}.json")
        if not os.path.isfile(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return RunRecord.from_dict(data)

    def list_runs(self, status_filter: Optional[RunStatus] = None) -> list[RunRecord]:
        runs = []
        if not os.path.isdir(self.store_dir):
            return runs
        for fname in os.listdir(self.store_dir):
            if fname.startswith("_") or not fname.endswith(".json"):
                continue
            path = os.path.join(self.store_dir, fname)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                run = RunRecord.from_dict(data)
                if status_filter and run.status != status_filter:
                    continue
                runs.append(run)
            except Exception:
                continue
        return sorted(runs, key=lambda r: r.timestamp)

    def get_latest_successful_run(self) -> Optional[RunRecord]:
        successful = self.list_runs(status_filter=RunStatus.SUCCESS)
        return successful[-1] if successful else None

    def trace_evidence(self, run_id: str) -> dict:
        run = self.get_run(run_id)
        if not run:
            return {"error": f"Run {run_id} not found"}

        evidence_chain: dict[str, list[dict]] = {
            "rollback_records": [],
            "directory_snapshot": [],
            "config_changes": [],
        }

        for rb_id in run.rollback_ids:
            evidence_chain["rollback_records"].append(
                {"record_id": rb_id, "type": "rollback"}
            )

        if run.snapshot_id:
            evidence_chain["directory_snapshot"].append(
                {"snapshot_id": run.snapshot_id, "type": "snapshot"}
            )

        for cc_id in run.config_change_ids:
            evidence_chain["config_changes"].append(
                {"change_id": cc_id, "type": "config_change"}
            )

        for entry in run.entries:
            for ref in entry.evidence_refs:
                key = ref.evidence_type.value
                if key not in evidence_chain:
                    evidence_chain[key] = []
                evidence_chain[key].append(
                    {
                        "record_id": ref.record_id,
                        "detail": ref.detail,
                        "linked_entry": entry.entry_id,
                        "package": f"{entry.package_name}@{entry.version}",
                    }
                )

        return {
            "run_id": run.run_id,
            "run_status": run.status.value,
            "evidence_chain": evidence_chain,
            "issues": [i.to_dict() for i in run.issues],
        }

    def _save_run(self, run: RunRecord) -> None:
        path = os.path.join(self.store_dir, f"{run.run_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(run.to_dict(), f, ensure_ascii=False, indent=2)
