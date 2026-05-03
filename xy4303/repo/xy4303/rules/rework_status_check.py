from datetime import datetime
from typing import List, Optional, Dict, Set

import config
from models.enums import IssueType, IssueSeverity, OrderStatus
from models.workbench import Workbench, WorkbenchItem
from rules.base_rule import BaseRule, RuleResult


class ReworkStatusRule(BaseRule):
    rule_name = "返工状态检查"
    rule_description = "检查返工状态是否正常流转，返工原因是否闭环"
    issue_type = IssueType.REWORK_STATUS_ISSUE

    def __init__(self, config: dict = None):
        super().__init__(config)
        self.status_flow = config.STATUS_FLOW if config else {
            "待接收": ["已接收"],
            "已接收": ["加工中", "待返工"],
            "加工中": ["待检验", "待返工"],
            "待检验": ["已完成", "待返工"],
            "待返工": ["返工中"],
            "返工中": ["加工中", "已完成"],
            "已完成": [],
        }
        self.max_rework_count = self.config.get("rework_max_count", 3)

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

        if not item.processing_status:
            return result

        status = item.processing_status
        rework_records = status.rework_records

        if rework_records:
            rework_count = len(rework_records)

            if rework_count >= self.max_rework_count:
                issue = self.create_issue(
                    model_id=model_id,
                    title=f"返工次数过多（{rework_count}次）",
                    description=f"模型 {model_id} 已返工 {rework_count} 次，"
                                f"超过最大建议次数 {self.max_rework_count} 次，需要特别关注",
                    severity=IssueSeverity.HIGH,
                )
                result.issues.append(issue)

            unresolved_rewoks = [r for r in rework_records if not r.is_resolved]
            if unresolved_rewoks:
                for record in unresolved_rewoks:
                    issue = self.create_issue(
                        model_id=model_id,
                        title=f"返工原因未闭环（第{record.rework_count}次返工）",
                        description=f"模型 {model_id} 第 {record.rework_count} 次返工：\n"
                                    f"原因：{record.rework_reason}\n"
                                    f"负责人：{record.responsible_person or '未指定'}\n"
                                    f"返工日期：{record.rework_date.strftime('%Y-%m-%d') if record.rework_date else '未知'}\n"
                                    f"状态：未解决，解决方案为空或未标记为已解决",
                        severity=IssueSeverity.HIGH,
                    )
                    result.issues.append(issue)

            for i, record in enumerate(rework_records):
                expected_count = i + 1
                if record.rework_count != expected_count:
                    issue = self.create_issue(
                        model_id=model_id,
                        title="返工记录编号不连续",
                        description=f"模型 {model_id} 的返工记录编号不连续："
                                    f"预期第 {expected_count} 次，实际记录为第 {record.rework_count} 次",
                        severity=IssueSeverity.MEDIUM,
                    )
                    result.issues.append(issue)

        if status.current_status in [OrderStatus.REWORKING, OrderStatus.PENDING_REWORK]:
            if not rework_records:
                issue = self.create_issue(
                    model_id=model_id,
                    title="状态为返工但无返工记录",
                    description=f"模型 {model_id} 当前状态为 '{status.current_status.value}'，"
                                f"但没有对应的返工记录",
                    severity=IssueSeverity.HIGH,
                )
                result.issues.append(issue)
            else:
                latest_rework = rework_records[-1]
                if latest_rework.is_resolved and status.current_status == OrderStatus.REWORKING:
                    issue = self.create_issue(
                        model_id=model_id,
                        title="返工状态与记录不一致",
                        description=f"模型 {model_id} 最新返工记录已标记为解决，"
                                    f"但当前状态仍为 '{status.current_status.value}'",
                        severity=IssueSeverity.MEDIUM,
                    )
                    result.issues.append(issue)

        if status.current_status == OrderStatus.COMPLETED:
            if status.has_unresolved_rework:
                issue = self.create_issue(
                    model_id=model_id,
                    title="已完成但有未解决的返工",
                    description=f"模型 {model_id} 状态为已完成，"
                                f"但存在 {len(status.rework_records)} 条未解决的返工记录",
                    severity=IssueSeverity.CRITICAL,
                )
                result.issues.append(issue)

        return result
