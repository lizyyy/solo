from datetime import datetime
from typing import List, Dict, Any
from uuid import uuid4
from .base_rule import BaseRule, RuleContext
from .approval_rule import ApprovalRule
from .window_expiry_rule import WindowExpiryRule
from .recovery_validation_rule import RecoveryValidationRule
from .duplicate_application_rule import DuplicateApplicationRule
from ..models import (
    ParseResult,
    AuditRecord,
    AuditConclusion,
    ValidationResult,
    ValidationStatus,
)


class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            ApprovalRule(),
            WindowExpiryRule(),
            RecoveryValidationRule(),
            DuplicateApplicationRule(),
        ]

    def run_all_rules(self, parse_result: ParseResult, audit_time: datetime = None) -> AuditConclusion:
        context = RuleContext(parse_result, audit_time=audit_time or datetime.now())

        all_validations = []
        for rule in self.rules:
            validations = rule.validate(context)
            all_validations.extend(validations)

        records = self._build_audit_records(context, all_validations)

        records.sort(key=lambda r: r.record_id)

        pass_count = sum(1 for r in records if r.overall_status == ValidationStatus.PASS)
        warn_count = sum(1 for r in records if r.overall_status == ValidationStatus.WARN)
        fail_count = sum(1 for r in records if r.overall_status == ValidationStatus.FAIL)
        skip_count = sum(1 for r in records if r.overall_status == ValidationStatus.SKIP)

        conclusion = AuditConclusion(
            audit_id=str(uuid4()),
            generated_at=context.audit_time,
            total_records=len(records),
            pass_count=pass_count,
            warn_count=warn_count,
            fail_count=fail_count,
            skip_count=skip_count,
            records=records,
            summary=self._build_summary(context, pass_count, warn_count, fail_count, skip_count),
        )

        return conclusion

    def _build_audit_records(self, context: RuleContext, validations: List[ValidationResult]) -> List[AuditRecord]:
        records = []

        record_map = {}
        for validation in validations:
            for record_id in validation.related_records:
                if record_id not in record_map:
                    record_map[record_id] = []
                record_map[record_id].append(validation)

        for exc in context.parse_result.exceptions:
            exc_validations = record_map.get(exc.id, [])
            windows = context.windows_by_exception_id.get(exc.id, [])

            for window in windows:
                window_validations = record_map.get(window.id, [])
                recoveries = context.recoveries_by_window_id.get(window.id, [])

                for recovery in recoveries:
                    recovery_validations = record_map.get(recovery.id, [])

                    all_vals = exc_validations + window_validations + recovery_validations

                    record = AuditRecord(
                        record_id=f"{exc.id}_{window.id}_{recovery.id}",
                        record_type="FULL_AUDIT",
                        repository_name=exc.repository_id or "未知仓库",
                        branch_pattern=exc.branch_pattern,
                        applicant=exc.applicant,
                        approver=exc.approver,
                        window_start=window.start_time,
                        window_end=window.end_time,
                        actual_end=window.actual_end_time,
                        recovered_by=recovery.recovered_by,
                        recovered_at=recovery.recovered_at,
                        validations=all_vals,
                        source=exc.source,
                    )
                    records.append(record)

                if not recoveries:
                    all_vals = exc_validations + window_validations
                    record = AuditRecord(
                        record_id=f"{exc.id}_{window.id}",
                        record_type="NO_RECOVERY",
                        repository_name=exc.repository_id or "未知仓库",
                        branch_pattern=exc.branch_pattern,
                        applicant=exc.applicant,
                        approver=exc.approver,
                        window_start=window.start_time,
                        window_end=window.end_time,
                        actual_end=window.actual_end_time,
                        validations=all_vals,
                        source=exc.source,
                    )
                    records.append(record)

            if not windows:
                record = AuditRecord(
                    record_id=exc.id,
                    record_type="EXCEPTION_ONLY",
                    repository_name=exc.repository_id or "未知仓库",
                    branch_pattern=exc.branch_pattern,
                    applicant=exc.applicant,
                    approver=exc.approver,
                    validations=exc_validations,
                    source=exc.source,
                )
                records.append(record)

        from ..models import SourceLocation
        for validation in validations:
            if not validation.related_records:
                source_loc = validation.details.get("source_location")
                if not isinstance(source_loc, SourceLocation):
                    source_loc = SourceLocation(file_path="规则引擎内部", raw_content="")
                record = AuditRecord(
                    record_id=f"rule_{validation.rule_id}_{len(records)}",
                    record_type="RULE_LEVEL",
                    repository_name="系统级",
                    branch_pattern="N/A",
                    validations=[validation],
                    source=source_loc,
                )
                records.append(record)

        return records

    def _build_summary(self, context: RuleContext, pass_count: int, warn_count: int, fail_count: int, skip_count: int) -> Dict[str, Any]:
        total = pass_count + warn_count + fail_count + skip_count
        pass_rate = round(pass_count / total * 100, 2) if total > 0 else 0

        return {
            "总记录数": total,
            "通过数": pass_count,
            "警告数": warn_count,
            "失败数": fail_count,
            "跳过数": skip_count,
            "通过率": f"{pass_rate}%",
            "仓库数量": len(context.parse_result.repositories),
            "例外申请数量": len(context.parse_result.exceptions),
            "放开窗口数量": len(context.parse_result.windows),
            "恢复动作数量": len(context.parse_result.recoveries),
            "解析错误数量": len(context.parse_result.parse_errors),
        }
