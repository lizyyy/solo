from datetime import datetime
from typing import List, Optional

from models.enums import IssueType, IssueSeverity, PhotoType
from models.workbench import Workbench, WorkbenchItem
from rules.base_rule import BaseRule, RuleResult


class MissingFileRule(BaseRule):
    rule_name = "文件缺失检查"
    rule_description = "检查订单是否缺少必要的文件：照片、STL文件等"
    issue_type = IssueType.MISSING_FILE

    def __init__(self, config: dict = None):
        super().__init__(config)
        self.required_photo_types = self.config.get(
            "required_photos",
            [PhotoType.OCCLUSION, PhotoType.FRONT, PhotoType.SIDE, PhotoType.OCCLUSAL_SURFACE]
        )

    def execute(
        self,
        workbench: Workbench,
        item: Optional[WorkbenchItem] = None
    ) -> RuleResult:
        result = RuleResult()

        if item:
            item_result = self.check_item(item)
            result.issues.extend(item_result.issues)
            result.errors.extend(item_result.errors)
            result.warnings.extend(item_result.warnings)
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

        if not item.order:
            issue = self.create_issue(
                model_id=model_id,
                title="订单信息缺失",
                description=f"模型 {model_id} 缺少订单信息",
                severity=IssueSeverity.CRITICAL,
            )
            result.issues.append(issue)
            return result

        photo_types = {p.photo_type for p in item.photos}

        for required_type in self.required_photo_types:
            if required_type not in photo_types:
                issue = self.create_issue(
                    model_id=model_id,
                    title=f"缺少{required_type.value}照片",
                    description=f"模型 {model_id} 缺少必需的{required_type.value}照片。"
                                f"当前照片类型：{[p.value for p in photo_types] if photo_types else '无'}",
                    severity=IssueSeverity.HIGH,
                    issue_type=IssueType.PHOTO_MISSING,
                )
                result.issues.append(issue)

        if not item.stl_files:
            issue = self.create_issue(
                model_id=model_id,
                title="STL文件缺失",
                description=f"模型 {model_id} 缺少STL文件",
                severity=IssueSeverity.HIGH,
                issue_type=IssueType.STL_MISSING,
            )
            result.issues.append(issue)
        else:
            jaws = {s.jaw for s in item.stl_files if s.jaw}
            if len(jaws) < 2:
                missing_jaws = []
                if "upper" not in jaws:
                    missing_jaws.append("上颌")
                if "lower" not in jaws:
                    missing_jaws.append("下颌")

                if missing_jaws:
                    issue = self.create_issue(
                        model_id=model_id,
                        title=f"缺少{', '.join(missing_jaws)}STL文件",
                        description=f"模型 {model_id} 缺少 {', '.join(missing_jaws)} 的STL文件。"
                                    f"当前只有：{[j for j in jaws] if jaws else '未知'}",
                        severity=IssueSeverity.MEDIUM,
                        issue_type=IssueType.STL_MISSING,
                    )
                    result.issues.append(issue)

        return result
