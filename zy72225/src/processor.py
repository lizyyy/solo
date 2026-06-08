import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path
from collections import defaultdict

from .models import ReleaseRecord, ProcessStatus, ChangeLog, ChangeType
from .importer import DataImporter
from .boundary_rules import BoundaryRuleEngine


class ReleaseScheduleProcessor:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.records_file = self.data_dir / "release_records.json"
        self.summary_file = self.data_dir / "processing_summary.json"
        self.audit_log_file = self.data_dir / "audit_log.json"

        self.importer = DataImporter(data_dir)
        self.rule_engine = BoundaryRuleEngine()
        self.records: Dict[str, ReleaseRecord] = {}
        self._load_records()

    def _load_records(self) -> None:
        if not self.records_file.exists():
            return
        try:
            with open(self.records_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            return

        for record_data in data.get("records", []):
            try:
                record = ReleaseRecord.model_validate(record_data)
                self.records[record.record_id] = record
            except Exception:
                continue

    def _save_records(self) -> None:
        records_list = [record.model_dump(mode="json") for record in self.records.values()]
        with open(self.records_file, "w", encoding="utf-8") as f:
            json.dump({"records": records_list}, f, ensure_ascii=False, indent=2, default=str)

    def _add_audit_log(self, action: str, operator: str, details: Dict[str, Any]) -> None:
        audit_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "operator": operator,
            "details": details,
        }

        existing_logs = []
        if self.audit_log_file.exists():
            with open(self.audit_log_file, "r", encoding="utf-8") as f:
                existing_logs = json.load(f).get("audit_logs", [])

        existing_logs.append(audit_entry)

        with open(self.audit_log_file, "w", encoding="utf-8") as f:
            json.dump({"audit_logs": existing_logs}, f, ensure_ascii=False, indent=2)

    def step1_import_ex_dividend_screenshot(
        self,
        excel_file_path: str,
        operator: str,
    ) -> Dict[str, Any]:
        records, import_summary = self.importer.import_excel(excel_file_path, operator)

        new_records: List[ReleaseRecord] = []
        for record in records:
            if record.record_id not in self.records:
                self.records[record.record_id] = record
                new_records.append(record)

        for record in new_records:
            self.rule_engine.check_and_apply(record, operator="system")

        self._save_records()

        boundary_stats = self._get_boundary_stats()

        summary = {
            "step": "step1_import",
            "batch_id": import_summary["batch_id"],
            "total_records": import_summary["total_records"],
            "imported_by": operator,
            "timestamp": import_summary["import_timestamp"],
            "boundary_stats": boundary_stats,
        }

        self._add_audit_log("import_ex_dividend_screenshot", operator, summary)

        return summary

    def step2_risk_review_tax_rate_remark(
        self,
        record_id: str,
        operator: str,
        tax_rate: Optional[float] = None,
        remark: Optional[str] = None,
        review_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]

        old_tax_rate = record.tax_rate
        old_remark = record.remark

        if tax_rate is not None:
            record.tax_rate = tax_rate
            change_log = ChangeLog(
                change_type=ChangeType.MANUAL_EDIT,
                operator=operator,
                field_name="tax_rate",
                old_value=old_tax_rate,
                new_value=tax_rate,
                reason=review_note or "风控补看税费率",
            )
            record.add_change_log(change_log)

        if remark is not None:
            record.remark = remark
            change_log = ChangeLog(
                change_type=ChangeType.MANUAL_EDIT,
                operator=operator,
                field_name="remark",
                old_value=old_remark,
                new_value=remark,
                reason=review_note or "风控补充备注",
            )
            record.add_change_log(change_log)

        self._save_records()

        self._add_audit_log("risk_review_tax_rate_remark", operator, {
            "record_id": record_id,
            "changes": {
                "tax_rate": {"old": old_tax_rate, "new": tax_rate},
                "remark": {"old": old_remark, "new": remark},
            }
        })

        return {
            "step": "step2_risk_review",
            "record_id": record_id,
            "reviewed_by": operator,
            "timestamp": datetime.now().isoformat(),
        }

    def step3_update_summary_for_manager(
        self,
        operator: str,
    ) -> Dict[str, Any]:
        normal_count = 0
        boundary_count = 0
        risk_review_count = 0
        pending_count = 0

        for record in self.records.values():
            if record.status == ProcessStatus.NORMAL:
                normal_count += 1
            elif record.status == ProcessStatus.BOUNDARY_CASE:
                boundary_count += 1
            elif record.status == ProcessStatus.RISK_REVIEW_REQUIRED:
                risk_review_count += 1
            else:
                pending_count += 1

        summary_data = {
            "step": "step3_summary",
            "generated_by": operator,
            "timestamp": datetime.now().isoformat(),
            "total_records": len(self.records),
            "normal_count": normal_count,
            "boundary_count": boundary_count,
            "risk_review_required_count": risk_review_count,
            "pending_count": pending_count,
            "boundary_rules": self.rule_engine.get_rule_documentation(),
            "records_summary": self._get_records_summary(),
        }

        with open(self.summary_file, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, ensure_ascii=False, indent=2, default=str)

        self._add_audit_log("update_summary_for_manager", operator, summary_data)

        return summary_data

    def _get_boundary_stats(self) -> Dict[str, int]:
        stats = defaultdict(int)
        for record in self.records.values():
            if record.boundary_type:
                stats[record.boundary_type.value] += 1
            else:
                stats["no_boundary"] += 1
        return dict(stats)

    def _get_records_summary(self) -> List[Dict[str, Any]]:
        return [record.to_dict() for record in self.records.values()]

    def approve_boundary_case(
        self,
        record_id: str,
        operator: str,
        approve_note: str,
    ) -> Dict[str, Any]:
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]
        old_status = record.status

        record.status = ProcessStatus.NORMAL
        record.boundary_note = f"已复核通过: {approve_note}"

        change_log = ChangeLog(
            change_type=ChangeType.STATUS_CHANGE,
            operator=operator,
            field_name="status",
            old_value=old_status.value,
            new_value=ProcessStatus.NORMAL.value,
            reason=f"风控复核通过: {approve_note}",
        )
        record.add_change_log(change_log)

        self._save_records()

        return {
            "action": "approve_boundary_case",
            "record_id": record_id,
            "approved_by": operator,
            "timestamp": datetime.now().isoformat(),
        }

    def reject_boundary_case(
        self,
        record_id: str,
        operator: str,
        reject_reason: str,
    ) -> Dict[str, Any]:
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]
        old_status = record.status

        record.status = ProcessStatus.REVERSED

        change_log = ChangeLog(
            change_type=ChangeType.STATUS_CHANGE,
            operator=operator,
            field_name="status",
            old_value=old_status.value,
            new_value=ProcessStatus.REVERSED.value,
            reason=f"风控复核驳回: {reject_reason}",
        )
        record.add_change_log(change_log)

        self._save_records()

        return {
            "action": "reject_boundary_case",
            "rejected_by": operator,
            "timestamp": datetime.now().isoformat(),
        }

    def get_record_history(self, record_id: str) -> Dict[str, Any]:
        if record_id not in self.records:
            raise ValueError(f"记录不存在: {record_id}")

        record = self.records[record_id]
        return {
            "record_id": record_id,
            "current": record.to_dict(),
            "original_snapshot": record.original_snapshot.model_dump(mode="json"),
            "change_history": [log.model_dump(mode="json") for log in record.change_history],
            "change_summary": record.get_change_summary(),
        }

    def get_records_for_risk_review(self) -> List[Dict[str, Any]]:
        return [
            record.to_dict()
            for record in self.records.values()
            if record.status == ProcessStatus.RISK_REVIEW_REQUIRED
        ]

    def generate_replay_commands(self) -> List[str]:
        commands = []

        audit_logs = []
        if self.audit_log_file.exists():
            with open(self.audit_log_file, "r", encoding="utf-8") as f:
                audit_logs = json.load(f).get("audit_logs", [])

        for log in audit_logs:
            action = log["action"]
            operator = log["operator"]
            details = log["details"]

            if action == "import_ex_dividend_screenshot":
                batch_id = details.get("batch_id", "")
                commands.append(
                    f"# 重新执行导入操作 (由 {operator} 于 {log['timestamp']})"
                )
                commands.append(
                    f"processor.step1_import_ex_dividend_screenshot("
                    f'excel_file_path="...", '
                    f"operator='{operator}')"
                )
            elif action == "risk_review_tax_rate_remark":
                record_id = details.get("record_id", "")
                commands.append(
                    f"# 重新执行风控备注补全 (由 {operator} 于 {log['timestamp']})"
                )
                commands.append(
                    f"processor.step2_risk_review_tax_rate_remark("
                    f"record_id='{record_id}', "
                    f"operator='{operator}')"
                )

        return commands

    def export_full_report(self, output_path: Optional[str] = None) -> Dict[str, Any]:
        report = {
            "generated_at": datetime.now().isoformat(),
            "records": {
                record_id: {
                    "data": record.to_dict(),
                    "change_history": [log.model_dump(mode="json") for log in record.change_history],
                }
                for record_id, record in self.records.items()
            },
            "import_history": self.importer.get_import_history(),
            "boundary_rules": self.rule_engine.get_rule_documentation(),
            "replay_commands": self.generate_replay_commands(),
        }

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2, default=str)

        return report
