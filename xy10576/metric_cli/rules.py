from typing import List, Dict, Any, Tuple
from dataclasses import dataclass

from .models import (
    MetricChange,
    ChangeProject,
    ChangeCheckResult,
    ChangeStatus,
    BackfillStatus,
    ChangeRecord,
)
from datetime import datetime
import uuid


@dataclass
class RuleContext:
    project: ChangeProject
    operator: str


class BaseRule:
    name: str = "base_rule"
    description: str = "基础规则"
    severity: str = "info"

    def check(self, context: RuleContext) -> List[ChangeCheckResult]:
        raise NotImplementedError


class RenameDetectionRule(BaseRule):
    name = "rename_detection"
    description = "检测指标重命名"
    severity = "medium"

    def check(self, context: RuleContext) -> List[ChangeCheckResult]:
        results = []
        project = context.project

        for change_id, change in project.metric_changes.items():
            if change.old_metric and change.new_metric:
                if change.old_metric.metric_id != change.new_metric.metric_id:
                    change.renamed_from = change.old_metric.metric_id
                    results.append(ChangeCheckResult(
                        rule_name=self.name,
                        passed=True,
                        severity=self.severity,
                        message=f"检测到指标重命名: {change.old_metric.metric_id} -> {change.new_metric.metric_id}",
                        details={
                            "change_id": change_id,
                            "old_id": change.old_metric.metric_id,
                            "new_id": change.new_metric.metric_id
                        }
                    ))
        return results


class MultipleMetricsRule(BaseRule):
    name = "multiple_metrics_dashboard"
    description = "检测同一看板多个指标变更"
    severity = "high"

    def check(self, context: RuleContext) -> List[ChangeCheckResult]:
        results = []
        project = context.project

        dashboard_change_count: Dict[str, List[str]] = {}

        for change_id, change in project.metric_changes.items():
            for dash_id in change.affected_dashboards:
                if dash_id not in dashboard_change_count:
                    dashboard_change_count[dash_id] = []
                dashboard_change_count[dash_id].append(change_id)

        for dash_id, change_ids in dashboard_change_count.items():
            if len(change_ids) >= 2:
                dashboard = project.dashboards.get(dash_id)
                dashboard_name = dashboard.name if dashboard else dash_id

                results.append(ChangeCheckResult(
                    rule_name=self.name,
                    passed=False,
                    severity=self.severity,
                    message=f"看板 {dashboard_name} 包含 {len(change_ids)} 个变更指标，需要特别注意",
                    details={
                        "dashboard_id": dash_id,
                        "change_ids": change_ids,
                        "count": len(change_ids)
                    }
                ))
        return results


class BackfillStatusRule(BaseRule):
    name = "backfill_status_check"
    description = "检查回填任务状态"
    severity = "critical"

    def check(self, context: RuleContext) -> List[ChangeCheckResult]:
        results = []
        project = context.project

        for change_id, change in project.metric_changes.items():
            if change.backfill_tasks:
                incomplete_tasks = []
                for task_id in change.backfill_tasks:
                    task = project.backfill_tasks.get(task_id)
                    if task and task.status != BackfillStatus.SUCCEEDED:
                        incomplete_tasks.append({
                            "task_id": task_id,
                            "status": task.status,
                            "metric_id": task.metric_id
                        })
                        change.backfill_incomplete = True

                if incomplete_tasks:
                    results.append(ChangeCheckResult(
                        rule_name=self.name,
                        passed=False,
                        severity=self.severity,
                        message=f"变更 {change_id} 有 {len(incomplete_tasks)} 个未完成回填任务",
                        details={
                            "change_id": change_id,
                            "incomplete_tasks": incomplete_tasks
                        }
                    ))
        return results


class OwnerMissingRule(BaseRule):
    name = "owner_missing"
    description = "检查负责人信息完整性"
    severity = "high"

    def check(self, context: RuleContext) -> List[ChangeCheckResult]:
        results = []
        project = context.project

        for change_id, change in project.metric_changes.items():
            missing_owners = []
            metric = change.new_metric

            if not metric.business_owner:
                missing_owners.append("business_owner")
            if not metric.tech_owner:
                missing_owners.append("tech_owner")

            if missing_owners:
                change.owner_missing = True
                results.append(ChangeCheckResult(
                    rule_name=self.name,
                    passed=False,
                    severity=self.severity,
                    message=f"指标 {metric.metric_id} 缺少负责人: {', '.join(missing_owners)}",
                    details={
                        "change_id": change_id,
                        "metric_id": metric.metric_id,
                        "missing_fields": missing_owners
                    }
                ))

        for dash_id, dashboard in project.dashboards.items():
            if not dashboard.owner:
                results.append(ChangeCheckResult(
                    rule_name=self.name,
                    passed=False,
                    severity=self.severity,
                    message=f"看板 {dashboard.name} ({dash_id}) 缺少负责人",
                    details={
                        "dashboard_id": dash_id,
                        "dashboard_name": dashboard.name
                    }
                ))
        return results


class LogicChangeRule(BaseRule):
    name = "logic_change_detection"
    description = "检测指标逻辑变更类型"
    severity = "medium"

    def check(self, context: RuleContext) -> List[ChangeCheckResult]:
        results = []
        project = context.project

        for change_id, change in project.metric_changes.items():
            if not change.old_metric:
                continue

            old_metric = change.old_metric
            new_metric = change.new_metric

            changes = []

            if old_metric.sql != new_metric.sql:
                changes.append("sql")
            if old_metric.aggregation != new_metric.aggregation:
                changes.append("aggregation")
            if old_metric.filters != new_metric.filters:
                changes.append("filters")
            if old_metric.time_window != new_metric.time_window:
                changes.append("time_window")

            if changes:
                results.append(ChangeCheckResult(
                    rule_name=self.name,
                    passed=True,
                    severity=self.severity,
                    message=f"指标 {new_metric.metric_id} 逻辑变更: {', '.join(changes)}",
                    details={
                        "change_id": change_id,
                        "metric_id": new_metric.metric_id,
                        "changes": changes
                    }
                ))
        return results


class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            RenameDetectionRule(),
            MultipleMetricsRule(),
            BackfillStatusRule(),
            OwnerMissingRule(),
            LogicChangeRule(),
        ]

    def add_rule(self, rule: BaseRule):
        self.rules.append(rule)

    def check_project(self, project: ChangeProject, operator: str) -> List[ChangeCheckResult]:
        context = RuleContext(project=project, operator=operator)
        all_results = []

        for rule in self.rules:
            try:
                results = rule.check(context)
                all_results.extend(results)
            except Exception as e:
                all_results.append(ChangeCheckResult(
                    rule_name=rule.name,
                    passed=False,
                    severity="error",
                    message=f"规则执行失败: {str(e)}",
                    details={"error": str(e)}
                ))
        return all_results

    def determine_change_status(self, change: MetricChange, results: List[ChangeCheckResult]) -> ChangeStatus:
        change_results = [r for r in results if r.details.get("change_id") == change.change_id]

        has_critical = any(r.severity == "critical" for r in change_results)
        has_high = any(r.severity == "high" for r in change_results)

        if change.backfill_incomplete:
            return ChangeStatus.NEEDS_BACKFILL

        if change.owner_missing:
            return ChangeStatus.NEEDS_REVIEW

        if change_results:
            sql_changed = any(
                "sql" in r.details.get("changes", [])
                for r in change_results
            )
            if sql_changed:
                return ChangeStatus.NOTIFY_BUSINESS

        return ChangeStatus.INTERNAL_ONLY


def update_change_status(
    project: ChangeProject,
    change_id: str,
    new_status: ChangeStatus,
    operator: str,
    reason: str = None
) -> Tuple[bool, str]:
    if change_id not in project.metric_changes:
        return False, "变更不存在"

    change = project.metric_changes[change_id]
    old_status = change.status

    if old_status == new_status:
        return True, "状态未变更（幂等）"

    if old_status == ChangeStatus.COMPLETED and new_status != ChangeStatus.COMPLETED:
        return False, "已完成的变更不能回退状态"

    before = {"status": old_status.value}
    change.status = new_status
    after = {"status": new_status.value}

    record = ChangeRecord(
        record_id=f"rec_{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now(),
        change_type="status_update",
        entity_id=change_id,
        entity_type="metric_change",
        before=before,
        after=after,
        operator=operator,
        reason=reason or f"状态变更: {old_status.value} -> {new_status.value}"
    )
    project.history.append(record)
    change.history.append(record)

    return True, f"状态已变更: {old_status.value} -> {new_status.value}"


def manual_correction(
    project: ChangeProject,
    change_id: str,
    field: str,
    old_value: Any,
    new_value: Any,
    operator: str,
    reason: str
) -> Tuple[bool, str]:
    if change_id not in project.metric_changes:
        return False, "变更不存在"

    change = project.metric_changes[change_id]
    metric = change.new_metric

    before = {field: getattr(metric, field, old_value)}
    setattr(metric, field, new_value)
    after = {field: new_value}

    record = ChangeRecord(
        record_id=f"rec_{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now(),
        change_type="manual_correction",
        entity_id=change_id,
        entity_type="metric_change",
        before=before,
        after=after,
        operator=operator,
        reason=reason
    )
    project.history.append(record)
    change.history.append(record)

    return True, "人工修正已记录"
