from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
import json
from pathlib import Path

from .data_models import (
    AnomalyResult,
    ProcessStatus,
    ManualModification,
    AnomalyType
)


@dataclass
class AuditRecord:
    row_number: int
    action: str
    old_status: Optional[ProcessStatus]
    new_status: ProcessStatus
    actor: str
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)
    comment: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_number": self.row_number,
            "action": self.action,
            "old_status": self.old_status.value if self.old_status else None,
            "new_status": self.new_status.value,
            "actor": self.actor,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
            "comment": self.comment
        }


class AuditTrail:
    def __init__(self):
        self._records: List[AuditRecord] = []
        self._result_store: Dict[int, AnomalyResult] = {}

    def add_result(self, result: AnomalyResult) -> None:
        self._result_store[result.row_number] = result

    def get_result(self, row_number: int) -> Optional[AnomalyResult]:
        return self._result_store.get(row_number)

    def get_all_results(self) -> List[AnomalyResult]:
        return list(self._result_store.values())

    def record_import(self, row_number: int, actor: str,
                      screenshot_ref: Optional[str] = None) -> None:
        result = self._result_store.get(row_number)
        old_status = None
        if result:
            old_status = result.process_status

        self._records.append(AuditRecord(
            row_number=row_number,
            action="import",
            old_status=old_status,
            new_status=ProcessStatus.IMPORTED,
            actor=actor,
            details={"screenshot_ref": screenshot_ref} if screenshot_ref else {},
            comment="从旧公式截图导入数据"
        ))

        if result:
            result.process_status = ProcessStatus.IMPORTED
            result.updated_at = datetime.now()

    def record_teacher_comment_added(self, row_number: int, actor: str,
                                     comment: str) -> None:
        result = self._result_store.get(row_number)
        if not result:
            return

        old_status = result.process_status
        result.teacher_comment = comment
        result.process_status = ProcessStatus.PENDING_REVIEW
        result.updated_at = datetime.now()

        self._records.append(AuditRecord(
            row_number=row_number,
            action="add_teacher_comment",
            old_status=old_status,
            new_status=ProcessStatus.PENDING_REVIEW,
            actor=actor,
            details={"comment": comment},
            comment="数据分析师小祁补充老师批注，进入待复核状态"
        ))

    def record_manual_modification(self, row_number: int, actor: str,
                                   field_name: str, old_value: Any,
                                   new_value: Any, reason: str) -> None:
        result = self._result_store.get(row_number)
        if not result:
            return

        old_status = result.process_status
        modification = ManualModification(
            modified_by=actor,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
        result.manual_modifications.append(modification)
        result.process_status = ProcessStatus.MANUAL_UPDATED
        result.updated_at = datetime.now()

        if field_name == "denominator":
            result.denominator = new_value
        elif field_name == "anomaly_type":
            result.anomaly_type = new_value
        elif field_name == "review_note":
            result.review_note = new_value

        self._records.append(AuditRecord(
            row_number=row_number,
            action="manual_modification",
            old_status=old_status,
            new_status=ProcessStatus.MANUAL_UPDATED,
            actor=actor,
            details={
                "field_name": field_name,
                "old_value": str(old_value),
                "new_value": str(new_value)
            },
            comment=reason
        ))

    def record_review_complete(self, row_number: int, actor: str,
                               review_note: str, final_anomaly_type: AnomalyType) -> None:
        result = self._result_store.get(row_number)
        if not result:
            return

        old_status = result.process_status
        result.review_note = review_note
        result.anomaly_type = final_anomaly_type
        result.process_status = ProcessStatus.REVIEWED
        result.updated_at = datetime.now()

        self._records.append(AuditRecord(
            row_number=row_number,
            action="review_complete",
            old_status=old_status,
            new_status=ProcessStatus.REVIEWED,
            actor=actor,
            details={
                "review_note": review_note,
                "final_anomaly_type": final_anomaly_type.value
            },
            comment="数据复核人完成复核"
        ))

    def record_finalize(self, row_number: int, actor: str) -> None:
        result = self._result_store.get(row_number)
        if not result:
            return

        old_status = result.process_status
        result.process_status = ProcessStatus.FINALIZED
        result.updated_at = datetime.now()

        self._records.append(AuditRecord(
            row_number=row_number,
            action="finalize",
            old_status=old_status,
            new_status=ProcessStatus.FINALIZED,
            actor=actor,
            comment="课堂演示结果更新，结果已最终确认"
        ))

    def record_rollback(self, row_number: int, actor: str, reason: str) -> None:
        result = self._result_store.get(row_number)
        if not result:
            return

        old_status = result.process_status
        result.process_status = ProcessStatus.ROLLBACKED
        result.updated_at = datetime.now()

        self._records.append(AuditRecord(
            row_number=row_number,
            action="rollback",
            old_status=old_status,
            new_status=ProcessStatus.ROLLBACKED,
            actor=actor,
            details={"reason": reason},
            comment="执行回滚操作"
        ))

    def get_audit_trail_for_row(self, row_number: int) -> List[AuditRecord]:
        return [r for r in self._records if r.row_number == row_number]

    def get_full_audit_trail(self) -> List[AuditRecord]:
        return self._records.copy()

    def export_audit_trail_to_json(self, filepath: str) -> None:
        data = [record.to_dict() for record in self._records]
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_pending_review_rows(self) -> List[AnomalyResult]:
        return [
            r for r in self._result_store.values()
            if r.process_status == ProcessStatus.PENDING_REVIEW
        ]

    def get_boundary_case_rows(self) -> List[AnomalyResult]:
        return [
            r for r in self._result_store.values()
            if r.anomaly_type == AnomalyType.BOUNDARY_CASE
        ]

    def print_summary(self) -> None:
        from rich.console import Console
        from rich.table import Table

        console = Console()
        table = Table(title="时间序列异常分解 - 处理状态汇总")
        table.add_column("状态", style="cyan")
        table.add_column("数量", justify="right", style="magenta")

        status_counts: Dict[ProcessStatus, int] = {}
        for result in self._result_store.values():
            status_counts[result.process_status] = status_counts.get(
                result.process_status, 0) + 1

        for status, count in status_counts.items():
            table.add_row(status.value, str(count))

        console.print(table)

        boundary_count = len(self.get_boundary_case_rows())
        pending_count = len(self.get_pending_review_rows())
        console.print(f"\n[yellow]边界案例数量: {boundary_count}[/yellow]")
        console.print(f"[yellow]待复核数量: {pending_count}[/yellow]")
