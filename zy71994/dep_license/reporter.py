from __future__ import annotations

import json
import os
from typing import Optional

from .models import (
    RunRecord,
    RunStatus,
    LicenseEntry,
    RollbackRecord,
    DirectorySnapshot,
    ConfigChangeRecord,
    DuplicateExecutionIssue,
    EvidenceType,
)
from .history import HistoryManager
from .rollback import RollbackTracker
from .snapshot import SnapshotManager
from .config_audit import ConfigAuditManager


class Reporter:
    def __init__(
        self,
        history: HistoryManager,
        rollback: RollbackTracker,
        snapshot: SnapshotManager,
        config_audit: ConfigAuditManager,
    ):
        self.history = history
        self.rollback = rollback
        self.snapshot = snapshot
        self.config_audit = config_audit

    def generate_inventory_report(self, run_id: str) -> dict:
        run = self.history.get_run(run_id)
        if not run:
            return {"error": f"Run {run_id} not found"}

        inventory = []
        for entry in run.entries:
            item = {
                "package": f"{entry.package_name}@{entry.version}",
                "license_type": entry.license_type,
                "entry_id": entry.entry_id,
                "source_file": entry.source_file,
                "evidence_trace": [],
            }

            for ref in entry.evidence_refs:
                evidence_detail = self._resolve_evidence(ref.evidence_type, ref.record_id, ref.detail)
                evidence_detail["ref_detail"] = ref.detail
                item["evidence_trace"].append(evidence_detail)

            inventory.append(item)

        return {
            "report_type": "dependency_license_inventory",
            "run_id": run.run_id,
            "run_status": run.status.value,
            "timestamp": run.timestamp,
            "operator": run.operator,
            "total_entries": len(inventory),
            "inventory": inventory,
            "snapshot_id": run.snapshot_id,
            "rollback_ids": run.rollback_ids,
            "config_change_ids": run.config_change_ids,
            "issues": [i.to_dict() for i in run.issues],
        }

    def generate_evidence_chain_report(self, run_id: str) -> dict:
        trace = self.history.trace_evidence(run_id)
        if "error" in trace:
            return trace

        enriched: dict[str, list[dict]] = {}
        for category, items in trace.get("evidence_chain", {}).items():
            enriched[category] = []
            for item in items:
                if category == "rollback_records":
                    record = self.rollback.get_record(item["record_id"])
                    if record:
                        enriched[category].append(
                            {
                                **item,
                                "target_package": record.target_package,
                                "version_change": f"{record.previous_version} → {record.target_version}",
                                "reason": record.reason,
                                "operator": record.operator,
                                "timestamp": record.timestamp,
                            }
                        )
                    else:
                        enriched[category].append(
                            {**item, "warning": "回滚记录未找到，可能已被删除"}
                        )
                elif category == "directory_snapshot":
                    snap = self.snapshot.get_snapshot(item.get("snapshot_id", item.get("record_id", "")))
                    if snap:
                        enriched[category].append(
                            {
                                **item,
                                "base_path": snap.base_path,
                                "file_count": len(snap.files),
                                "timestamp": snap.timestamp,
                                "label": snap.label,
                            }
                        )
                    else:
                        enriched[category].append(
                            {**item, "warning": "目录快照未找到"}
                        )
                elif category == "config_changes":
                    change = self.config_audit.get_change(item.get("change_id", item.get("record_id", "")))
                    if change:
                        enriched[category].append(
                            {
                                **item,
                                "file_path": change.file_path,
                                "before_hash": change.before_hash,
                                "after_hash": change.after_hash,
                                "diff_preview": change.diff[:500] if change.diff else "",
                                "operator": change.operator,
                                "timestamp": change.timestamp,
                            }
                        )
                    else:
                        enriched[category].append(
                            {**item, "warning": "配置变更记录未找到"}
                        )
                else:
                    enriched[category] = items

        return {
            "report_type": "evidence_chain",
            "run_id": trace["run_id"],
            "run_status": trace["run_status"],
            "evidence_chain": enriched,
            "issues": trace.get("issues", []),
        }

    def generate_duplicate_issue_report(self, run_id: str) -> dict:
        run = self.history.get_run(run_id)
        if not run:
            return {"error": f"Run {run_id} not found"}

        if not run.issues:
            return {
                "report_type": "duplicate_issue",
                "run_id": run.run_id,
                "status": "no_issues",
                "message": "本次运行无重复执行冲突",
            }

        issue_details = []
        for issue in run.issues:
            source_detail = self._resolve_evidence(
                issue.evidence_source, issue.source_record_id, ""
            )
            issue_details.append(
                {
                    "issue_id": issue.issue_id,
                    "package": f"{issue.package_name}@{issue.version}",
                    "conflict_type": "license_type_changed",
                    "evidence_source": issue.evidence_source.value,
                    "source_record_id": issue.source_record_id,
                    "source_detail": source_detail,
                    "description": issue.description,
                    "suggested_action": issue.suggested_action,
                    "responsible": issue.responsible_hint,
                    "previous_entry_id": issue.previous_entry_id,
                    "conflicting_entry_id": issue.conflicting_entry_id,
                }
            )

        return {
            "report_type": "duplicate_issue",
            "run_id": run.run_id,
            "status": "issues_found",
            "total_issues": len(issue_details),
            "issues": issue_details,
        }

    def generate_config_reconciliation_report(self, run_id: str) -> dict:
        return self.config_audit.reconcile_with_run(run_id, "")

    def generate_full_report(self, run_id: str) -> dict:
        inventory = self.generate_inventory_report(run_id)
        evidence = self.generate_evidence_chain_report(run_id)
        duplicates = self.generate_duplicate_issue_report(run_id)
        reconciliation = self.generate_config_reconciliation_report(run_id)

        return {
            "report_type": "full",
            "inventory": inventory,
            "evidence_chain": evidence,
            "duplicate_issues": duplicates,
            "config_reconciliation": reconciliation,
        }

    def export_report(self, report: dict, output_path: str) -> None:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    def _resolve_evidence(
        self, evidence_type: EvidenceType, record_id: str, detail: str
    ) -> dict:
        result: dict = {"evidence_type": evidence_type.value, "record_id": record_id}

        if evidence_type == EvidenceType.ROLLBACK_RECORD:
            record = self.rollback.get_record(record_id)
            if record:
                result.update(
                    {
                        "resolved": True,
                        "target_package": record.target_package,
                        "version_change": f"{record.previous_version} → {record.target_version}",
                        "reason": record.reason,
                        "operator": record.operator,
                    }
                )
            else:
                result.update(
                    {
                        "resolved": False,
                        "warning": "回滚记录未找到",
                        "suggestion": "联系运维确认回滚记录是否已归档",
                    }
                )

        elif evidence_type == EvidenceType.DIRECTORY_SNAPSHOT:
            snap = self.snapshot.get_snapshot(record_id)
            if snap:
                result.update(
                    {
                        "resolved": True,
                        "base_path": snap.base_path,
                        "file_count": len(snap.files),
                        "label": snap.label,
                        "timestamp": snap.timestamp,
                    }
                )
            else:
                result.update(
                    {
                        "resolved": False,
                        "warning": "目录快照未找到",
                        "suggestion": "检查快照存储目录是否完整",
                    }
                )

        elif evidence_type == EvidenceType.CONFIG_CHANGE:
            change = self.config_audit.get_change(record_id)
            if change:
                result.update(
                    {
                        "resolved": True,
                        "file_path": change.file_path,
                        "diff_preview": change.diff[:300] if change.diff else "",
                        "operator": change.operator,
                    }
                )
            else:
                result.update(
                    {
                        "resolved": False,
                        "warning": "配置变更记录未找到",
                        "suggestion": "检查变更审计日志是否完整",
                    }
                )

        elif evidence_type == EvidenceType.SCAN_RESULT:
            result.update({"resolved": True, "detail": detail})

        return result
