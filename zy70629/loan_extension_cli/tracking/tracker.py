from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from pathlib import Path
import hashlib
import json

from loan_extension_cli.models import (
    BaseRecord,
    LoanRecord,
    RepaymentPlanRecord,
    ExtensionApplicationRecord,
    ApprovalRecord,
    DeductionRecord,
    RepaymentReportRecord,
)


@dataclass
class TrackedRecord:
    record_id: str
    record_type: str
    source_file: str
    source_location: str
    raw_content: str
    parsed_data: dict[str, Any]
    is_valid: bool
    validation_errors: list[str]


@dataclass
class TrackingResult:
    run_id: str
    run_timestamp: datetime
    input_files: list[str] = field(default_factory=list)
    tracked_records: list[TrackedRecord] = field(default_factory=list)
    parse_errors: list[str] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)

    def generate_stable_id(self) -> str:
        content = json.dumps(
            {
                "records": [
                    {
                        "record_id": r.record_id,
                        "source_file": r.source_file,
                        "source_location": r.source_location,
                        "raw_content": r.raw_content,
                    }
                    for r in sorted(self.tracked_records, key=lambda x: x.record_id)
                ],
                "errors": sorted(self.parse_errors),
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


class SourceTracker:
    def __init__(self):
        self.tracking_result = TrackingResult(
            run_id=datetime.now().strftime("%Y%m%d_%H%M%S"),
            run_timestamp=datetime.now(),
        )
        self._record_counters: dict[str, int] = {}

    def add_input_file(self, file_path: str) -> None:
        self.tracking_result.input_files.append(str(Path(file_path).resolve()))

    def add_parse_error(self, error: str) -> None:
        self.tracking_result.parse_errors.append(error)

    def track_record(self, record: BaseRecord, record_type: str) -> None:
        parsed_data = self._extract_parsed_data(record)

        tracked = TrackedRecord(
            record_id=record.record_id,
            record_type=record_type,
            source_file=record.source.file_path,
            source_location=record.source.get_location_str(),
            raw_content=record.source.raw_content,
            parsed_data=parsed_data,
            is_valid=record.is_valid,
            validation_errors=record.validation_errors.copy(),
        )

        self.tracking_result.tracked_records.append(tracked)

    def _extract_parsed_data(self, record: BaseRecord) -> dict[str, Any]:
        if isinstance(record, LoanRecord):
            return {
                "loan_no": record.loan_no,
                "employee_id": record.employee_id,
                "employee_name": record.employee_name,
                "loan_amount": record.loan_amount,
                "loan_date": str(record.loan_date),
                "loan_term_months": record.loan_term_months,
                "status": record.status,
            }
        elif isinstance(record, RepaymentPlanRecord):
            return {
                "plan_id": record.plan_id,
                "loan_no": record.loan_no,
                "period_no": record.period_no,
                "due_date": str(record.due_date),
                "principal_amount": record.principal_amount,
                "interest_amount": record.interest_amount,
                "total_amount": record.total_amount,
                "status": record.status,
                "is_extended": record.is_extended,
            }
        elif isinstance(record, ExtensionApplicationRecord):
            return {
                "application_id": record.application_id,
                "loan_no": record.loan_no,
                "application_date": str(record.application_date),
                "extension_months": record.extension_months,
                "new_due_date": str(record.new_due_date) if record.new_due_date else None,
                "reason": record.reason,
                "applicant": record.applicant,
            }
        elif isinstance(record, ApprovalRecord):
            return {
                "approval_id": record.approval_id,
                "application_id": record.application_id,
                "loan_no": record.loan_no,
                "approver": record.approver,
                "approval_date": str(record.approval_date),
                "approval_result": record.approval_result,
                "approval_comment": record.approval_comment,
                "approval_level": record.approval_level,
            }
        elif isinstance(record, DeductionRecord):
            return {
                "deduction_id": record.deduction_id,
                "loan_no": record.loan_no,
                "deduction_date": str(record.deduction_date),
                "deduction_amount": record.deduction_amount,
                "deduction_type": record.deduction_type,
                "related_plan_id": record.related_plan_id,
                "transaction_no": record.transaction_no,
            }
        elif isinstance(record, RepaymentReportRecord):
            return {
                "report_id": record.report_id,
                "loan_no": record.loan_no,
                "report_date": str(record.report_date),
                "total_principal_due": record.total_principal_due,
                "total_interest_due": record.total_interest_due,
                "total_paid": record.total_paid,
                "remaining_principal": record.remaining_principal,
                "remaining_interest": record.remaining_interest,
                "is_overdue": record.is_overdue,
            }
        return {}

    def generate_summary(self) -> dict[str, Any]:
        summary: dict[str, Any] = {
            "run_id": self.tracking_result.run_id,
            "run_timestamp": self.tracking_result.run_timestamp.isoformat(),
            "input_files_count": len(self.tracking_result.input_files),
            "total_records": len(self.tracking_result.tracked_records),
            "valid_records": sum(1 for r in self.tracking_result.tracked_records if r.is_valid),
            "invalid_records": sum(1 for r in self.tracking_result.tracked_records if not r.is_valid),
            "parse_errors_count": len(self.tracking_result.parse_errors),
            "records_by_type": {},
        }

        for record in self.tracking_result.tracked_records:
            record_type = record.record_type
            if record_type not in summary["records_by_type"]:
                summary["records_by_type"][record_type] = {"total": 0, "valid": 0, "invalid": 0}
            summary["records_by_type"][record_type]["total"] += 1
            if record.is_valid:
                summary["records_by_type"][record_type]["valid"] += 1
            else:
                summary["records_by_type"][record_type]["invalid"] += 1

        self.tracking_result.summary = summary
        return summary

    def get_tracking_result(self) -> TrackingResult:
        self.generate_summary()
        return self.tracking_result

    def compare_with_previous(self, previous_result: TrackingResult) -> dict[str, Any]:
        comparison: dict[str, Any] = {
            "has_changes": False,
            "added_records": [],
            "removed_records": [],
            "modified_records": [],
            "file_changes": [],
        }

        current_ids = {r.record_id for r in self.tracking_result.tracked_records}
        previous_ids = {r.record_id for r in previous_result.tracked_records}

        added = current_ids - previous_ids
        removed = previous_ids - current_ids

        if added or removed:
            comparison["has_changes"] = True

        current_map = {r.record_id: r for r in self.tracking_result.tracked_records}
        previous_map = {r.record_id: r for r in previous_result.tracked_records}

        for record_id in added:
            rec = current_map[record_id]
            comparison["added_records"].append(
                {"record_id": record_id, "type": rec.record_type, "source": rec.source_location}
            )

        for record_id in removed:
            rec = previous_map[record_id]
            comparison["removed_records"].append(
                {"record_id": record_id, "type": rec.record_type, "source": rec.source_location}
            )

        common_ids = current_ids & previous_ids
        for record_id in common_ids:
            curr = current_map[record_id]
            prev = previous_map[record_id]
            if curr.raw_content != prev.raw_content or curr.source_location != prev.source_location:
                comparison["has_changes"] = True
                comparison["modified_records"].append(
                    {
                        "record_id": record_id,
                        "type": curr.record_type,
                        "previous_source": prev.source_location,
                        "current_source": curr.source_location,
                    }
                )

        current_files = set(self.tracking_result.input_files)
        previous_files = set(previous_result.input_files)
        if current_files != previous_files:
            comparison["has_changes"] = True
            comparison["file_changes"] = {
                "added": list(current_files - previous_files),
                "removed": list(previous_files - current_files),
            }

        return comparison
