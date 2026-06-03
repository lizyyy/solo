from typing import List, Optional, Dict, Any, Callable
from datetime import datetime
from functools import wraps
from dataclasses import asdict

from models import (
    AuditLog,
    FundMatchRecord,
    DiscrepancyItem,
    MatchStatus,
    DiscrepancyStatus,
)
from repository import MatchRepository


class AuditService:
    def __init__(self, repository: Optional[MatchRepository] = None):
        self.repo = repository or MatchRepository()

    def log_change(
        self,
        business_no: str,
        operator: str,
        action: str,
        field_changed: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        affected_record_ids: Optional[List[str]] = None,
        affected_calculation_fields: Optional[List[str]] = None,
    ) -> AuditLog:
        log = AuditLog(
            business_no=business_no,
            operator=operator,
            action=action,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            affected_record_ids=affected_record_ids or [],
            affected_calculation_fields=affected_calculation_fields or [],
        )
        self.repo.add_audit_log(log)
        return log

    def log_record_update(
        self,
        record: FundMatchRecord,
        operator: str,
        reason: str,
        changes: Dict[str, Any],
    ) -> List[AuditLog]:
        logs = []
        affected_records = self._get_affected_records(record)
        affected_calc_fields = self._get_affected_calculation_fields(list(changes.keys()))

        for field, (old_val, new_val) in changes.items():
            log = self.log_change(
                business_no=record.business_no,
                operator=operator,
                action="更新匹配记录",
                field_changed=field,
                old_value=old_val,
                new_value=new_val,
                reason=reason,
                affected_record_ids=[r.record_id for r in affected_records],
                affected_calculation_fields=affected_calc_fields,
            )
            logs.append(log)

        return logs

    def log_discrepancy_resolution(
        self,
        discrepancy: DiscrepancyItem,
        operator: str,
        new_status: DiscrepancyStatus,
        notes: str,
    ) -> AuditLog:
        return self.log_change(
            business_no=discrepancy.business_no,
            operator=operator,
            action="处理差异项",
            field_changed="status",
            old_value=discrepancy.status.value,
            new_value=new_status.value,
            reason=notes,
            affected_record_ids=discrepancy.related_record_ids,
            affected_calculation_fields=["matched_amount", "status"],
        )

    def log_manual_adjustment(
        self,
        business_no: str,
        operator: str,
        field: str,
        old_value: Any,
        new_value: Any,
        reason: str,
    ) -> AuditLog:
        records = self.repo.get_records_by_business_no(business_no)
        affected_ids = [r.record_id for r in records]

        return self.log_change(
            business_no=business_no,
            operator=operator,
            action="人工调整",
            field_changed=field,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            affected_record_ids=affected_ids,
            affected_calculation_fields=[field, "status"],
        )

    def log_import(
        self,
        data_type: str,
        operator: str,
        batch: str,
        count: int,
    ) -> AuditLog:
        return self.log_change(
            business_no=f"batch_{batch}",
            operator=operator,
            action=f"导入{data_type}",
            field_changed="import",
            old_value=None,
            new_value=f"导入 {count} 条记录",
            reason=f"批量导入{data_type}",
            affected_record_ids=[],
            affected_calculation_fields=[],
        )

    def get_change_history(self, business_no: str) -> List[Dict[str, Any]]:
        logs = self.repo.get_audit_logs_by_business_no(business_no)
        return [self._format_log_for_display(log) for log in logs]

    def get_impact_analysis(self, business_no: str) -> Dict[str, Any]:
        logs = self.repo.get_audit_logs_by_business_no(business_no)
        records = self.repo.get_records_by_business_no(business_no)
        discrepancies = self.repo.get_discrepancies_by_business_no(business_no)

        all_affected_fields = set()
        all_affected_records = set()
        operators = set()

        for log in logs:
            all_affected_fields.update(log.affected_calculation_fields)
            all_affected_records.update(log.affected_record_ids)
            operators.add(log.operator)

        return {
            "business_no": business_no,
            "total_changes": len(logs),
            "unique_operators": list(operators),
            "affected_calculation_fields": list(all_affected_fields),
            "affected_record_ids": list(all_affected_records),
            "current_status": {
                "record_count": len(records),
                "record_statuses": [r.status.value for r in records],
                "discrepancy_count": len(discrepancies),
                "discrepancy_statuses": [d.status.value for d in discrepancies],
            },
            "change_timeline": [self._format_log_for_display(log) for log in logs],
        }

    def get_review_summary(self, business_no: str) -> Dict[str, Any]:
        impact = self.get_impact_analysis(business_no)
        records = self.repo.get_records_by_business_no(business_no)

        changes_by_field: Dict[str, List[Dict[str, Any]]] = {}
        logs = self.repo.get_audit_logs_by_business_no(business_no)
        for log in logs:
            if log.field_changed not in changes_by_field:
                changes_by_field[log.field_changed] = []
            changes_by_field[log.field_changed].append(self._format_log_for_display(log))

        return {
            **impact,
            "changes_by_field": changes_by_field,
            "requires_supervisor_review": any(
                r.status == MatchStatus.PENDING_REVIEW for r in records
            ),
            "has_split_records": any(r.is_split_record() for r in records),
            "review_warning": self._generate_review_warning(records, logs),
        }

    def _format_log_for_display(self, log: AuditLog) -> Dict[str, Any]:
        return {
            "log_id": log.log_id,
            "timestamp": log.timestamp.isoformat(),
            "operator": log.operator,
            "action": log.action,
            "field_changed": log.field_changed,
            "old_value": self._format_value(log.old_value),
            "new_value": self._format_value(log.new_value),
            "reason": log.reason,
            "affected_record_ids": log.affected_record_ids,
            "affected_calculation_fields": log.affected_calculation_fields,
        }

    def _format_value(self, value: Any) -> Any:
        if isinstance(value, float):
            return round(value, 2)
        if hasattr(value, "value"):
            return value.value
        return value

    def _get_affected_records(self, record: FundMatchRecord) -> List[FundMatchRecord]:
        affected = [record]
        if record.related_record_id:
            related = self.repo.get_match_record(record.related_record_id)
            if related:
                affected.append(related)
        return affected

    def _get_affected_calculation_fields(self, changed_fields: List[str]) -> List[str]:
        affected = set(changed_fields)
        calc_dependencies = {
            "expected_amount": ["matched_amount", "difference_amount"],
            "matched_amount": ["difference_amount", "status"],
            "match_date": ["expected_amount", "matched_amount"],
            "status": [],
        }
        for field in changed_fields:
            affected.update(calc_dependencies.get(field, []))
        return list(affected)

    def _generate_review_warning(
        self,
        records: List[FundMatchRecord],
        logs: List[AuditLog],
    ) -> List[str]:
        warnings = []

        if any(r.is_split_record() for r in records):
            warnings.append("包含同一业务号拆分为本金和手续费的记录，需要结算主管复核。")

        recent_changes = [log for log in logs if log.action == "人工调整"]
        if recent_changes:
            warnings.append(f"存在 {len(recent_changes)} 次人工调整，请核实调整原因和影响范围。")

        statuses = {r.status for r in records}
        if MatchStatus.CONFLICT in statuses:
            warnings.append("存在规则冲突的记录，请先完成冲突解决。")

        if MatchStatus.DISCREPANCY in statuses:
            warnings.append("存在差异记录，请先处理差异项。")

        return warnings
