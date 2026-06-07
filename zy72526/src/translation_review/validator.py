from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Dict, Tuple
from .models import (
    TranslationRecord,
    ValidationIssue,
    ExportRecord,
    AbnormalType,
)
from .storage import Storage


def _gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class Validator:
    def __init__(self, storage: Storage):
        self.storage = storage

    def check_duplicate_imports(self) -> List[ValidationIssue]:
        records = self.storage.list_records()
        ticket_groups: Dict[str, List[TranslationRecord]] = {}
        for r in records:
            ticket_id = r.feedback_ticket.ticket_id
            ticket_groups.setdefault(ticket_id, []).append(r)

        issues = []
        for ticket_id, group in ticket_groups.items():
            if len(group) > 1:
                for record in group:
                    issue = ValidationIssue(
                        issue_id=_gen_id("issue"),
                        record_id=record.record_id,
                        abnormal_type=AbnormalType.DUPLICATE_IMPORT,
                        severity="high",
                        message=f"工单 {ticket_id} 被重复导入 {len(group)} 次",
                        details={
                            "ticket_id": ticket_id,
                            "import_count": len(group),
                            "record_ids": [r.record_id for r in group],
                            "import_batch_nos": [r.import_batch_no for r in group],
                        },
                    )
                    self.storage.save_issue(issue)
                    issues.append(issue)
        return issues

    def check_model_version_changes(self) -> List[ValidationIssue]:
        records = self.storage.list_records()
        sample_groups: Dict[str, List[TranslationRecord]] = {}
        for r in records:
            sample_groups.setdefault(r.sample_no, []).append(r)

        issues = []
        for sample_no, group in sample_groups.items():
            versions = {r.model_version for r in group}
            if len(versions) > 1:
                for record in group:
                    issue = ValidationIssue(
                        issue_id=_gen_id("issue"),
                        record_id=record.record_id,
                        abnormal_type=AbnormalType.MODEL_VERSION_CHANGED,
                        severity="medium",
                        message=f"样本 {sample_no} 存在 {len(versions)} 个不同模型版本: {', '.join(versions)}",
                        details={
                            "sample_no": sample_no,
                            "model_versions": list(versions),
                            "record_ids": [r.record_id for r in group],
                            "current_record_version": record.model_version,
                        },
                    )
                    self.storage.save_issue(issue)
                    issues.append(issue)
        return issues

    def check_supplementary_records(self) -> List[ValidationIssue]:
        records = self.storage.list_records()
        issues = []
        for record in records:
            if AbnormalType.SUPPLEMENTARY_RECORD in record.abnormal_types:
                issue = ValidationIssue(
                    issue_id=_gen_id("issue"),
                    record_id=record.record_id,
                    abnormal_type=AbnormalType.SUPPLEMENTARY_RECORD,
                    severity="low",
                    message=f"记录 {record.record_id} 是补录数据，已重算 {record.recheck_count} 次",
                    details={
                        "record_id": record.record_id,
                        "recheck_count": record.recheck_count,
                        "sample_no": record.sample_no,
                    },
                )
                self.storage.save_issue(issue)
                issues.append(issue)
        return issues

    def check_export_consistency(self) -> Tuple[bool, List[ValidationIssue]]:
        records = self.storage.list_records()
        issues = []
        all_consistent = True

        for record in records:
            export_record = ExportRecord(
                record_id=record.record_id,
                sample_no=record.sample_no,
                model_version=record.model_version,
                status=record.status,
                original_line_no=record.feedback_ticket.original_line_no,
                ticket_id=record.feedback_ticket.ticket_id,
                source_language=record.feedback_ticket.source_language,
                target_language=record.feedback_ticket.target_language,
                customer_text=record.feedback_ticket.customer_text,
                original_translation=record.feedback_ticket.original_translation,
                model_translation=record.model_translation,
                final_translation=record.final_translation,
                abnormal_types=[t.value for t in record.abnormal_types],
                has_manual_changes=len(record.manual_changes) > 0,
                desensitization_reviewed=record.desensitization_note is not None,
                imported_at=record.imported_at,
                recheck_count=record.recheck_count,
            )

            if record.sample_no != export_record.sample_no:
                all_consistent = False
                issue = ValidationIssue(
                    issue_id=_gen_id("issue"),
                    record_id=record.record_id,
                    abnormal_type=AbnormalType.DATA_INCONSISTENT,
                    severity="high",
                    message=f"记录 {record.record_id} 样本编号不一致",
                    details={
                        "record_sample_no": record.sample_no,
                        "export_sample_no": export_record.sample_no,
                    },
                )
                self.storage.save_issue(issue)
                issues.append(issue)

            if record.final_translation != export_record.final_translation:
                all_consistent = False
                issue = ValidationIssue(
                    issue_id=_gen_id("issue"),
                    record_id=record.record_id,
                    abnormal_type=AbnormalType.DATA_INCONSISTENT,
                    severity="high",
                    message=f"记录 {record.record_id} 最终翻译不一致",
                    details={
                        "record_final": record.final_translation,
                        "export_final": export_record.final_translation,
                    },
                )
                self.storage.save_issue(issue)
                issues.append(issue)

        return all_consistent, issues

    def run_all_checks(self) -> Dict[str, List[ValidationIssue]]:
        results = {
            "duplicate_imports": self.check_duplicate_imports(),
            "model_version_changes": self.check_model_version_changes(),
            "supplementary_records": self.check_supplementary_records(),
        }
        _, export_issues = self.check_export_consistency()
        results["export_consistency"] = export_issues
        return results

    def get_check_summary(self) -> Dict:
        records = self.storage.list_records()
        unresolved_issues = self.storage.list_issues(resolved=False)

        by_type: Dict[str, int] = {}
        for issue in unresolved_issues:
            key = issue.abnormal_type.value
            by_type[key] = by_type.get(key, 0) + 1

        return {
            "total_records": len(records),
            "unresolved_issues": len(unresolved_issues),
            "issues_by_type": by_type,
        }
