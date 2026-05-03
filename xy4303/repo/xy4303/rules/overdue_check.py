from datetime import datetime, timedelta
from typing import List, Optional

from models.enums import IssueType, IssueSeverity, OrderStatus
from models.workbench import Workbench, WorkbenchItem
from rules.base_rule import BaseRule, RuleResult


class OverdueRule(BaseRule):
    rule_name = "超期风险检查"
    rule_description = "检查订单是否超期或存在超期风险"
    issue_type = IssueType.OVERDUE_RISK

    def __init__(self, config: dict = None):
        super().__init__(config)
        self.overdue_days = self.config.get("overdue_days", 3)
        self.warning_days = self.config.get("warning_days", 1)

    def execute(
        self,
        workbench: Workbench,
        item: Optional[WorkbenchItem] = None
    ) -> RuleResult:
        result = RuleResult()

        if item:
            item_result = self.check_item(item)
            result.issues.extend(item_result.issues)
        else:
            for model_id, workbench_item in workbench.items.items():
                item_result = self.check_item(workbench_item)
                result.issues.extend(item_result.issues)

        result.stats = {
            "total_checked": 1 if item else len(workbench.items),
            "issues_found": len(result.issues),
        }

        return result

    def check_item(self, item: WorkbenchItem) -> RuleResult:
        result = RuleResult()
        model_id = item.model_id

        delivery_date = None
        if item.order and item.order.delivery_date:
            delivery_date = item.order.delivery_date
        elif item.processing_status and item.processing_status.expected_delivery_date:
            delivery_date = item.processing_status.expected_delivery_date.date()

        if not delivery_date:
            return result

        current_status = OrderStatus.PENDING_RECEIVE
        if item.processing_status:
            current_status = item.processing_status.current_status

        if current_status == OrderStatus.COMPLETED:
            return result

        now = datetime.now().date()
        days_until_delivery = (delivery_date - now).days

        if days_until_delivery < 0:
            days_overdue = abs(days_until_delivery)
            severity = IssueSeverity.CRITICAL if days_overdue >= self.overdue_days else IssueSeverity.HIGH

            issue = self.create_issue(
                model_id=model_id,
                title=f"订单已超期 {days_overdue} 天",
                description=f"模型 {model_id} 交付日期为 {delivery_date.strftime('%Y-%m-%d')}，"
                            f"已超期 {days_overdue} 天。\n"
                            f"当前状态：{current_status.value}\n"
                            f"患者：{item.order.patient_name if item.order else '未知'}\n"
                            f"医生：{item.order.doctor_name if item.order else '未知'}",
                severity=severity,
            )
            result.issues.append(issue)

        elif days_until_delivery <= self.warning_days:
            issue = self.create_issue(
                model_id=model_id,
                title=f"即将超期（剩余 {days_until_delivery} 天）",
                description=f"模型 {model_id} 交付日期为 {delivery_date.strftime('%Y-%m-%d')}，"
                            f"仅剩 {days_until_delivery} 天。\n"
                            f"当前状态：{current_status.value}\n"
                            f"患者：{item.order.patient_name if item.order else '未知'}\n"
                            f"医生：{item.order.doctor_name if item.order else '未知'}",
                severity=IssueSeverity.MEDIUM,
            )
            result.issues.append(issue)

        if item.processing_status and item.processing_status.has_unresolved_rework:
            if days_until_delivery <= self.overdue_days:
                issue = self.create_issue(
                    model_id=model_id,
                    title="存在未解决返工且即将超期",
                    description=f"模型 {model_id} 存在未解决的返工记录，"
                                f"距离交付日期仅剩 {days_until_delivery} 天，存在超期风险。\n"
                                f"未解决返工数：{len([r for r in item.processing_status.rework_records if not r.is_resolved])}",
                    severity=IssueSeverity.HIGH,
                )
                result.issues.append(issue)

        if item.order and item.order.is_urgent:
            if days_until_delivery <= self.overdue_days:
                issue = self.create_issue(
                    model_id=model_id,
                    title="加急订单即将超期",
                    description=f"模型 {model_id} 为加急订单，"
                                f"距离交付日期仅剩 {days_until_delivery} 天，请优先处理。",
                    severity=IssueSeverity.HIGH,
                )
                result.issues.append(issue)

        return result
