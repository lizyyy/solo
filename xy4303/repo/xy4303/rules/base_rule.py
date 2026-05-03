from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Any

from models.issue import Issue
from models.workbench import Workbench, WorkbenchItem
from models.enums import IssueType, IssueSeverity


@dataclass
class RuleResult:
    success: bool = True
    issues: List[Issue] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


class BaseRule(ABC):
    rule_name: str = "基础规则"
    rule_description: str = "规则基类，所有检查规则必须继承此类"
    issue_type: IssueType = IssueType.MISSING_FILE

    def __init__(self, config: dict = None):
        self.config = config or {}

    @abstractmethod
    def execute(
        self,
        workbench: Workbench,
        item: Optional[WorkbenchItem] = None
    ) -> RuleResult:
        pass

    def check_item(self, item: WorkbenchItem) -> RuleResult:
        pass

    def create_issue(
        self,
        model_id: str,
        title: str,
        description: str = "",
        severity: IssueSeverity = IssueSeverity.MEDIUM,
        issue_type: Optional[IssueType] = None,
    ) -> Issue:
        issue_type = issue_type or self.issue_type
        issue_id = f"{model_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        return Issue(
            issue_id=issue_id,
            model_id=model_id,
            issue_type=issue_type,
            severity=severity,
            title=title,
            description=description,
        )
