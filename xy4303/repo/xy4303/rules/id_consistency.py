from datetime import datetime
from typing import List, Optional, Set

from models.enums import IssueType, IssueSeverity
from models.workbench import Workbench, WorkbenchItem
from rules.base_rule import BaseRule, RuleResult


class IDConsistencyRule(BaseRule):
    rule_name = "编号一致性检查"
    rule_description = "检查订单编号、模型编号在各数据源中是否一致"
    issue_type = IssueType.ID_MISMATCH

    def __init__(self, config: dict = None):
        super().__init__(config)

    def execute(
        self,
        workbench: Workbench,
        item: Optional[WorkbenchItem] = None
    ) -> RuleResult:
        result = RuleResult()

        all_model_ids: Set[str] = set()

        if item:
            item_result = self.check_item(item)
            result.issues.extend(item_result.issues)
            all_model_ids.add(item.model_id)
        else:
            for model_id, workbench_item in workbench.items.items():
                item_result = self.check_item(workbench_item)
                result.issues.extend(item_result.issues)
                all_model_ids.add(model_id)

            cross_result = self._check_cross_item_consistency(workbench)
            result.issues.extend(cross_result.issues)

        result.stats = {
            "total_checked": 1 if item else len(workbench.items),
            "issues_found": len(result.issues),
        }

        return result

    def check_item(self, item: WorkbenchItem) -> RuleResult:
        result = RuleResult()
        model_id = item.model_id

        all_ids = set()
        all_ids.add(model_id)

        if item.order:
            order_model_id = item.order.model_id
            if order_model_id != model_id:
                issue = self.create_issue(
                    model_id=model_id,
                    title="订单模型编号不一致",
                    description=f"工作台模型编号 {model_id} 与订单模型编号 {order_model_id} 不一致",
                    severity=IssueSeverity.CRITICAL,
                )
                result.issues.append(issue)

            all_ids.add(item.order.order_id)
            if item.order.patient_id:
                all_ids.add(item.order.patient_id)

        if item.processing_status:
            status_model_id = item.processing_status.model_id
            if status_model_id != model_id:
                issue = self.create_issue(
                    model_id=model_id,
                    title="状态表模型编号不一致",
                    description=f"工作台模型编号 {model_id} 与状态表模型编号 {status_model_id} 不一致",
                    severity=IssueSeverity.CRITICAL,
                )
                result.issues.append(issue)

        for photo in item.photos:
            if photo.model_id != model_id:
                issue = self.create_issue(
                    model_id=model_id,
                    title="照片模型编号不一致",
                    description=f"照片 {photo.file_name} 的模型编号 {photo.model_id} 与当前模型 {model_id} 不一致",
                    severity=IssueSeverity.HIGH,
                )
                result.issues.append(issue)

        for stl_file in item.stl_files:
            if stl_file.model_id != model_id:
                issue = self.create_issue(
                    model_id=model_id,
                    title="STL文件模型编号不一致",
                    description=f"STL文件 {stl_file.file_name} 的模型编号 {stl_file.model_id} 与当前模型 {model_id} 不一致",
                    severity=IssueSeverity.HIGH,
                )
                result.issues.append(issue)

        return result

    def _check_cross_item_consistency(self, workbench: Workbench) -> RuleResult:
        result = RuleResult()

        order_ids = set()
        for item in workbench.items.values():
            if item.order:
                if item.order.order_id in order_ids:
                    issue = self.create_issue(
                        model_id=item.model_id,
                        title="订单编号重复",
                        description=f"订单编号 {item.order.order_id} 被多个模型使用，可能存在串单风险",
                        severity=IssueSeverity.CRITICAL,
                    )
                    result.issues.append(issue)
                order_ids.add(item.order.order_id)

        return result
