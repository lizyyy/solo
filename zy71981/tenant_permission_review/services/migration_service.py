from datetime import datetime, timedelta
from typing import List, Tuple
from uuid import uuid4

from ..storage import Database
from ..models import CallLog, MigrationReport, RecordStatus, ProcessingResult
from .idempotency_service import IdempotencyService
from .permission_review_service import PermissionReviewService
from .manual_confirmation_service import ManualConfirmationService


class MigrationService:
    def __init__(
        self,
        db: Database,
        idempotency_service: IdempotencyService,
        review_service: PermissionReviewService,
        confirmation_service: ManualConfirmationService,
    ):
        self.db = db
        self.idempotency = idempotency_service
        self.review_service = review_service
        self.confirmation_service = confirmation_service

    def process_batch(
        self,
        tenant_id: str,
        batch_id: str,
        call_logs: List[CallLog],
        batch_cutoff_minutes: int = 60,
    ) -> MigrationReport:
        batch_cutoff = datetime.now() - timedelta(minutes=batch_cutoff_minutes)

        report = MigrationReport(
            tenant_id=tenant_id,
            migration_batch_id=batch_id,
            total_records=len(call_logs),
            success_count=0,
        )

        for log in call_logs:
            self._process_single_log(log, report, batch_cutoff, batch_id)

        report.summary = {
            "success_rate": f"{(report.success_count / report.total_records * 100):.1f}%" if report.total_records > 0 else "0%",
            "processed_at": datetime.now().isoformat(),
        }

        self._generate_report_issues(report)
        self.db.save_migration_report(report)
        return report

    def _process_single_log(
        self,
        log: CallLog,
        report: MigrationReport,
        batch_cutoff: datetime,
        batch_id: str,
    ):
        self.db.save_call_log(log)

        is_late = self.idempotency.check_late_arrival(
            log, batch_cutoff, batch_id, raise_on_late=False
        )
        if is_late:
            self.idempotency.build_late_arrival_chain(log, batch_id, batch_cutoff)
            report.late_arrival_count += 1
            report.late_arrival_ids.append(log.log_id)
            return

        result = self.review_service.process_permission_change(log, batch_id=batch_id)

        if result.details.get("status") == "duplicate":
            report.duplicate_count += 1
            report.duplicate_record_ids.append(log.log_id)
            return

        if result.success:
            report.success_count += 1
        else:
            report.failed_count += 1
            report.failed_record_ids.append(log.log_id)

    def _generate_report_issues(self, report: MigrationReport):
        if report.duplicate_count > 0:
            report.add_issue(
                f"发现 {report.duplicate_count} 条重复记录，这些记录已自动跳过处理。"
                f"如需重新处理，请先在人工确认页面撤销相关记录。"
            )

        if report.late_arrival_count > 0:
            report.add_issue(
                f"发现 {report.late_arrival_count} 条晚到记录，这些记录没有参与本次迁移。"
                f"请检查数据来源的延迟问题，或走人工更正流程。"
            )

        if report.failed_count > 0:
            report.add_issue(
                f"有 {report.failed_count} 条记录处理失败，需要人工介入排查。"
                f"失败记录ID已在报告中列出。"
            )

        if report.failed_count / max(report.total_records, 1) > 0.1:
            report.add_issue(
                "⚠️  失败率超过 10%，建议检查本次迁移的数据源是否有问题。"
            )

    def get_batch_report(self, batch_id: str) -> MigrationReport:
        return self.db.get_migration_report(batch_id)

    def print_human_readable_report(self, batch_id: str) -> str:
        report = self.get_batch_report(batch_id)
        if not report:
            return f"未找到批次 {batch_id} 的报告"

        lines = [
            "=" * 60,
            f"📊 多租户权限迁移报告 - 批次 {report.migration_batch_id}",
            "=" * 60,
            f"租户 ID: {report.tenant_id}",
            f"处理时间: {report.timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "📈 统计概览",
            "-" * 40,
            f"  总记录数: {report.total_records}",
            f"  ✅ 成功: {report.success_count}",
            f"  ❌ 失败: {report.failed_count}",
            f"  🔄 重复: {report.duplicate_count}",
            f"  ⏰ 晚到: {report.late_arrival_count}",
            f"  👋 人工更正: {report.manual_corrected_count}",
            f"  成功率: {report.summary.get('success_rate', 'N/A')}",
        ]

        if report.issues:
            lines.extend(["", "⚠️  需要关注的问题", "-" * 40])
            for i, issue in enumerate(report.issues, 1):
                lines.append(f"  {i}. {issue}")

        if report.failed_record_ids:
            lines.extend(["", "🔍 失败记录 ID", "-" * 40])
            lines.extend(f"  - {rid}" for rid in report.failed_record_ids[:5])
            if len(report.failed_record_ids) > 5:
                lines.append(f"  ... 还有 {len(report.failed_record_ids) - 5} 条")

        if report.duplicate_record_ids:
            lines.extend(["", "🔄 重复记录 ID", "-" * 40])
            lines.extend(f"  - {rid}" for rid in report.duplicate_record_ids[:5])
            if len(report.duplicate_record_ids) > 5:
                lines.append(f"  ... 还有 {len(report.duplicate_record_ids) - 5} 条")

        lines.extend([
            "",
            "💡 操作建议",
            "-" * 40,
            "  • 点击失败记录 ID 可查看详细证据链",
            "  • 重复记录如需重处理请走人工确认流程",
            "  • 晚到记录建议检查数据源延迟",
            "",
            "=" * 60,
        ])

        return "\n".join(lines)
