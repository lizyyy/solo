from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging

from audit import AuditManager
from models import ComparisonItem, ReportResponse

logger = logging.getLogger(__name__)


class Reporter:
    def __init__(self, audit_manager: AuditManager):
        self.audit_manager = audit_manager

    def generate_report(self, batch_id: str) -> Optional[ReportResponse]:
        summary = self.audit_manager.get_batch_summary(batch_id)
        if not summary:
            return None

        started_at = datetime.fromisoformat(summary["started_at"])
        completed_at = datetime.fromisoformat(summary["completed_at"])
        duration_ms = (completed_at - started_at).total_seconds() * 1000

        comparison = self._generate_comparison(summary["records"])
        failure_summary = self._generate_failure_summary(summary["records"])
        next_steps = self._generate_next_steps(summary)

        success_rate = (
            summary["success_count"] / summary["total_count"] * 100
            if summary["total_count"] > 0 else 0
        )

        return ReportResponse(
            batch_id=batch_id,
            started_at=summary["started_at"],
            completed_at=summary["completed_at"],
            duration_ms=duration_ms,
            total_count=summary["total_count"],
            success_count=summary["success_count"],
            fail_count=summary["fail_count"],
            success_rate=success_rate,
            comparison=comparison,
            failure_summary=failure_summary,
            next_steps=next_steps,
            needs_manual_confirmation=not summary.get("confirmed", False)
        )

    def _generate_comparison(self, records: List) -> List[ComparisonItem]:
        comparisons = []

        for record in records:
            before = record.original_params.copy()
            after = before.copy()
            changes = []

            if record.compensated:
                after["_compensated"] = True
                after["_compensation_time"] = record.created_at
                after["timestamp"] = after.get("timestamp", record.created_at)
                changes.append("已添加补偿标记")
                changes.append("已添加补偿时间戳")

            if record.signature:
                after["signature"] = record.signature
                changes.append("已添加签名")

            comparisons.append(ComparisonItem(
                item_id=record.item_id,
                before=before,
                after=after,
                changes=changes
            ))

        return comparisons

    def _generate_failure_summary(self, records: List) -> Dict[str, int]:
        failures = {}

        for record in records:
            if record.status == "failed" and record.error_code:
                failures[record.error_code] = failures.get(record.error_code, 0) + 1

        return failures

    def _generate_next_steps(self, summary: Dict[str, Any]) -> List[str]:
        steps = []

        if not summary.get("confirmed", False):
            steps.append("需要审计人员手动确认该批次处理结果")

        fail_count = summary["fail_count"]
        total_count = summary["total_count"]
        fail_rate = fail_count / total_count * 100 if total_count > 0 else 0

        if fail_count > 0:
            steps.append(f"共有 {fail_count} 条记录处理失败，建议查看失败明细并排查原因")

            if "GRAY_SEARCH_WORD_DETECTED" in self._get_error_codes(summary):
                steps.append("检测到灰度搜索词相关失败，建议考虑启用补偿机制或调整搜索词策略")

        if fail_rate > 20:
            steps.append(f"失败率较高 ({fail_rate:.1f}%)，建议执行批量重试或检查系统配置")

        if summary.get("success_count", 0) > 0 and fail_count == 0:
            steps.append("所有记录处理成功，建议定期监控系统运行状态")

        compensated_count = sum(1 for r in summary["records"] if r.compensated)
        if compensated_count > 0:
            steps.append(f"有 {compensated_count} 条记录通过补偿机制成功处理，建议关注此类记录的业务影响")

        if not steps:
            steps.append("批次处理正常，无特殊操作建议")

        return steps

    def _get_error_codes(self, summary: Dict[str, Any]) -> List[str]:
        return list(set(
            r.error_code for r in summary["records"]
            if r.error_code
        ))

    def export_report_to_file(self, batch_id: str, output_dir: str = "./reports") -> Optional[str]:
        report = self.generate_report(batch_id)
        if not report:
            return None

        Path(output_dir).mkdir(parents=True, exist_ok=True)
        file_path = Path(output_dir) / f"report_{batch_id}.json"

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(report.model_dump_json(indent=2, ensure_ascii=False))

        logger.info(f"报告已导出到: {file_path}")
        return str(file_path)
