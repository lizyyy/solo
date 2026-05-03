from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Type

from models.workbench import Workbench, WorkbenchItem
from models.issue import Issue
from rules.base_rule import BaseRule, RuleResult
from rules.missing_check import MissingFileRule
from rules.id_consistency import IDConsistencyRule
from rules.photo_time_check import PhotoTimeRule
from rules.rework_status_check import ReworkStatusRule
from rules.overdue_check import OverdueRule


@dataclass
class EngineResult:
    success: bool = True
    issues: List[Issue] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    rule_results: Dict[str, RuleResult] = field(default_factory=dict)
    stats: dict = field(default_factory=dict)


class RuleEngine:
    DEFAULT_RULES = [
        MissingFileRule,
        IDConsistencyRule,
        PhotoTimeRule,
        ReworkStatusRule,
        OverdueRule,
    ]

    def __init__(self, config: dict = None, rules: List[Type[BaseRule]] = None):
        self.config = config or {}
        self.rules: List[BaseRule] = []

        rule_classes = rules or self.DEFAULT_RULES
        for rule_class in rule_classes:
            self.rules.append(rule_class(self.config))

    def add_rule(self, rule: BaseRule) -> None:
        self.rules.append(rule)

    def run(
        self,
        workbench: Workbench,
        item: Optional[WorkbenchItem] = None,
        rule_names: Optional[List[str]] = None,
    ) -> EngineResult:
        result = EngineResult()
        all_issues: List[Issue] = []

        for rule in self.rules:
            if rule_names and rule.rule_name not in rule_names:
                continue

            try:
                rule_result = rule.execute(workbench, item)
                result.rule_results[rule.rule_name] = rule_result
                all_issues.extend(rule_result.issues)
                result.errors.extend(rule_result.errors)
                result.warnings.extend(rule_result.warnings)
            except Exception as e:
                result.errors.append(f"规则 '{rule.rule_name}' 执行失败: {str(e)}")

        all_issues.sort(
            key=lambda x: {
                "严重": 0,
                "高": 1,
                "中": 2,
                "低": 3,
            }.get(x.severity.value, 99)
        )

        result.issues = all_issues

        result.stats = {
            "total_rules": len(self.rules),
            "total_issues": len(all_issues),
            "by_severity": self._count_by_severity(all_issues),
            "by_type": self._count_by_type(all_issues),
        }

        return result

    def run_and_apply(
        self,
        workbench: Workbench,
        item: Optional[WorkbenchItem] = None,
        clear_existing: bool = True,
    ) -> EngineResult:
        result = self.run(workbench, item)

        if item:
            if clear_existing:
                item.issues = []
            for issue in result.issues:
                if issue.model_id == item.model_id:
                    item.issues.append(issue)
        else:
            model_issues: Dict[str, List[Issue]] = {}
            for issue in result.issues:
                if issue.model_id not in model_issues:
                    model_issues[issue.model_id] = []
                model_issues[issue.model_id].append(issue)

            for model_id, workbench_item in workbench.items.items():
                if clear_existing:
                    workbench_item.issues = []
                if model_id in model_issues:
                    workbench_item.issues.extend(model_issues[model_id])

        return result

    def _count_by_severity(self, issues: List[Issue]) -> Dict[str, int]:
        counts = {}
        for issue in issues:
            severity = issue.severity.value
            counts[severity] = counts.get(severity, 0) + 1
        return counts

    def _count_by_type(self, issues: List[Issue]) -> Dict[str, int]:
        counts = {}
        for issue in issues:
            issue_type = issue.issue_type.value
            counts[issue_type] = counts.get(issue_type, 0) + 1
        return counts
