import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from collections import defaultdict

from .models import (
    MigrationReport,
    TaskRetryRecord,
    TaskStatus,
    DataSource,
)


class ReportGenerator:
    PROCESSING_POLICY = """
    处理口径说明：
    1. 幂等性保证：同一批材料第二次进入时，已成功/已确认/已人工修改的记录不会被覆盖为新的成功记录
    2. 自动判断规则：
       - 所有调用成功：标记为成功
       - 超时/限流失败：建议重试
       - 权限问题：需要人工审核
       - 服务端错误：待补充信息确认
    3. 幂等键问题处理：
       - 缺失幂等键：记录来源并提示联系对应负责人补充
       - 幂等键冲突：记录冲突来源，提示人工核对
    4. 记录分类：
       - 已确认(confirmed)：人工确认无误的记录
       - 待补(awaiting_supplement)：需要补充信息的记录
       - 人工改过(manually_modified)：经过人工修改的记录
    """

    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

    def generate_migration_report(
        self,
        tasks: List[TaskRetryRecord],
        batch_id: str,
    ) -> MigrationReport:
        confirmed_tasks = [t for t in tasks if t.status == TaskStatus.CONFIRMED]
        awaiting_tasks = [
            t for t in tasks if t.status == TaskStatus.AWAITING_SUPPLEMENT
        ]
        modified_tasks = [
            t for t in tasks if t.status == TaskStatus.MANUALLY_MODIFIED
        ]
        success_tasks = [t for t in tasks if t.status == TaskStatus.SUCCESS]
        failed_tasks = [t for t in tasks if t.status == TaskStatus.FAILED]
        idempotent_issue_tasks = [
            t for t in tasks if t.status == TaskStatus.IDEMPOTENT_ISSUE
        ]

        details = self._build_details(
            confirmed_tasks,
            awaiting_tasks,
            modified_tasks,
            success_tasks,
            failed_tasks,
            idempotent_issue_tasks,
        )

        report = MigrationReport(
            report_id=f"report_{uuid.uuid4().hex[:8]}",
            generated_at=datetime.now(),
            batch_id=batch_id,
            processing_policy=self.PROCESSING_POLICY.strip(),
            total_records=len(tasks),
            confirmed_count=len(confirmed_tasks),
            awaiting_supplement_count=len(awaiting_tasks),
            manually_modified_count=len(modified_tasks),
            success_count=len(success_tasks),
            failed_count=len(failed_tasks),
            idempotent_issue_count=len(idempotent_issue_tasks),
            details=details,
        )

        self._save_report(report)
        self._save_human_readable_report(report)

        return report

    def _build_details(
        self,
        confirmed_tasks: List[TaskRetryRecord],
        awaiting_tasks: List[TaskRetryRecord],
        modified_tasks: List[TaskRetryRecord],
        success_tasks: List[TaskRetryRecord],
        failed_tasks: List[TaskRetryRecord],
        idempotent_issue_tasks: List[TaskRetryRecord],
    ) -> Dict[str, Any]:
        return {
            "confirmed_records": [
                self._task_to_summary(t) for t in confirmed_tasks
            ],
            "awaiting_supplement_records": [
                self._task_to_awaiting_summary(t) for t in awaiting_tasks
            ],
            "manually_modified_records": [
                self._task_to_modified_summary(t) for t in modified_tasks
            ],
            "success_records": [
                self._task_to_summary(t) for t in success_tasks
            ],
            "failed_records": [
                self._task_to_failed_summary(t) for t in failed_tasks
            ],
            "idempotent_issues": [
                self._task_to_idempotent_summary(t)
                for t in idempotent_issue_tasks
            ],
            "statistics": self._build_statistics(
                confirmed_tasks
                + awaiting_tasks
                + modified_tasks
                + success_tasks
                + failed_tasks
                + idempotent_issue_tasks
            ),
        }

    def _task_to_summary(self, task: TaskRetryRecord) -> Dict[str, Any]:
        return {
            "task_id": task.task_id,
            "api_endpoint": task.api_endpoint,
            "idempotent_key": task.idempotent_key,
            "status": task.status.value,
            "retry_count": task.retry_count,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            "judgment_reason": task.auto_judgment.reason if task.auto_judgment else None,
            "next_step": task.auto_judgment.suggestion if task.auto_judgment else None,
        }

    def _task_to_awaiting_summary(self, task: TaskRetryRecord) -> Dict[str, Any]:
        summary = self._task_to_summary(task)
        summary.update(
            {
                "missing_info": task.last_error,
                "contact_person": self._get_contact_for_awaiting(task),
                "urgency": "high" if task.retry_count > 2 else "medium",
            }
        )
        return summary

    def _task_to_modified_summary(self, task: TaskRetryRecord) -> Dict[str, Any]:
        summary = self._task_to_summary(task)
        summary.update(
            {
                "modification_notes": task.manual_notes,
                "modified_at": task.updated_at.isoformat() if task.updated_at else None,
            }
        )
        return summary

    def _task_to_failed_summary(self, task: TaskRetryRecord) -> Dict[str, Any]:
        summary = self._task_to_summary(task)
        summary.update(
            {
                "last_error": task.last_error,
                "last_attempt_at": task.last_attempt_at.isoformat()
                if task.last_attempt_at
                else None,
            }
        )
        return summary

    def _task_to_idempotent_summary(self, task: TaskRetryRecord) -> Dict[str, Any]:
        summary = self._task_to_summary(task)
        if task.idempotent_issue:
            summary.update(
                {
                    "issue_type": task.idempotent_issue.issue_type,
                    "source": task.idempotent_issue.source.value,
                    "description": task.idempotent_issue.description,
                    "contact_person": task.idempotent_issue.contact_person,
                    "next_step": task.idempotent_issue.next_step,
                }
            )
        return summary

    def _get_contact_for_awaiting(self, task: TaskRetryRecord) -> str:
        if task.auto_judgment:
            suggestion = task.auto_judgment.suggestion
            if "服务端" in suggestion:
                return "服务端开发人员"
            if "日志" in suggestion:
                return "日志系统管理员"
            if "权限" in suggestion:
                return "系统管理员"
        return "相关技术负责人"

    def _build_statistics(self, tasks: List[TaskRetryRecord]) -> Dict[str, Any]:
        status_counts = defaultdict(int)
        for task in tasks:
            status_counts[task.status.value] += 1

        issue_type_counts = defaultdict(int)
        for task in tasks:
            if task.idempotent_issue:
                issue_type_counts[task.idempotent_issue.issue_type] += 1

        source_counts = defaultdict(int)
        for task in tasks:
            if task.idempotent_issue:
                source_counts[task.idempotent_issue.source.value] += 1

        return {
            "status_distribution": dict(status_counts),
            "idempotent_issue_types": dict(issue_type_counts),
            "idempotent_issue_sources": dict(source_counts),
            "avg_retry_count": (
                sum(t.retry_count for t in tasks) / len(tasks) if tasks else 0
            ),
        }

    def _save_report(self, report: MigrationReport) -> None:
        file_path = (
            self.output_dir
            / f"migration_report_{report.batch_id}_{report.generated_at.strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(
                report.model_dump(mode="json"),
                f,
                ensure_ascii=False,
                indent=2,
            )

    def _save_human_readable_report(self, report: MigrationReport) -> None:
        file_path = (
            self.output_dir
            / f"migration_report_{report.batch_id}_{report.generated_at.strftime('%Y%m%d_%H%M%S')}.txt"
        )

        content = self._format_human_readable_report(report)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    def _format_human_readable_report(self, report: MigrationReport) -> str:
        lines = []

        lines.append("=" * 80)
        lines.append("任务调度重试 - 迁移报告")
        lines.append("=" * 80)
        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"批次ID: {report.batch_id}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("处理口径")
        lines.append("-" * 80)
        lines.append(report.processing_policy)
        lines.append("")

        lines.append("-" * 80)
        lines.append("概览统计")
        lines.append("-" * 80)
        lines.append(f"总记录数: {report.total_records}")
        lines.append(f"  - 已确认: {report.confirmed_count}")
        lines.append(f"  - 待补充: {report.awaiting_supplement_count}")
        lines.append(f"  - 人工修改: {report.manually_modified_count}")
        lines.append(f"  - 成功: {report.success_count}")
        lines.append(f"  - 失败: {report.failed_count}")
        lines.append(f"  - 幂等键问题: {report.idempotent_issue_count}")
        lines.append("")

        if report.details.get("confirmed_records"):
            lines.append("-" * 80)
            lines.append("一、已确认记录 (人工确认无误)")
            lines.append("-" * 80)
            for record in report.details["confirmed_records"]:
                lines.append(f"  任务ID: {record['task_id']}")
                lines.append(f"  接口: {record['api_endpoint']}")
                lines.append(f"  幂等键: {record['idempotent_key']}")
                lines.append(f"  确认时间: {record['updated_at']}")
                lines.append("")

        if report.details.get("awaiting_supplement_records"):
            lines.append("-" * 80)
            lines.append("二、待补充记录 (需要补充信息)")
            lines.append("-" * 80)
            for record in report.details["awaiting_supplement_records"]:
                lines.append(f"  任务ID: {record['task_id']}")
                lines.append(f"  接口: {record['api_endpoint']}")
                lines.append(f"  缺失信息: {record['missing_info']}")
                lines.append(f"  联系人: {record['contact_person']}")
                lines.append(f"  紧急程度: {record['urgency']}")
                lines.append("")

        if report.details.get("manually_modified_records"):
            lines.append("-" * 80)
            lines.append("三、人工修改记录 (经过人工处理)")
            lines.append("-" * 80)
            for record in report.details["manually_modified_records"]:
                lines.append(f"  任务ID: {record['task_id']}")
                lines.append(f"  接口: {record['api_endpoint']}")
                lines.append(f"  修改说明: {record['modification_notes']}")
                lines.append(f"  修改时间: {record['modified_at']}")
                lines.append("")

        if report.details.get("idempotent_issues"):
            lines.append("-" * 80)
            lines.append("四、幂等键问题 (需重点关注)")
            lines.append("-" * 80)
            for issue in report.details["idempotent_issues"]:
                lines.append(f"  任务ID: {issue['task_id']}")
                lines.append(f"  接口: {issue['api_endpoint']}")
                lines.append(f"  问题类型: {issue['issue_type']}")
                lines.append(f"  问题来源: {issue['source']}")
                lines.append(f"  问题描述: {issue['description']}")
                lines.append(f"  联系人: {issue['contact_person']}")
                lines.append(f"  下一步: {issue['next_step']}")
                lines.append("")

        if report.details.get("success_records"):
            lines.append("-" * 80)
            lines.append("五、成功记录 (自动判断可重试)")
            lines.append("-" * 80)
            for record in report.details["success_records"]:
                lines.append(f"  任务ID: {record['task_id']}")
                lines.append(f"  接口: {record['api_endpoint']}")
                lines.append(f"  判断原因: {record['judgment_reason']}")
                lines.append(f"  处理建议: {record['next_step']}")
                lines.append("")

        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)
