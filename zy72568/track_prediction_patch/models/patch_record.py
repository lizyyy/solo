from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from ..utils.helpers import generate_id, get_current_time


class PatchStatus(str, Enum):
    DRAFT = "draft"
    IMPORTED = "imported"
    PARAMS_REVIEWED = "params_reviewed"
    METRICS_UPDATED = "metrics_updated"
    NEEDS_REVIEW = "needs_review"
    CONFLICT_DETECTED = "conflict_detected"
    COMPLETED = "completed"
    REJECTED = "rejected"


class PatchIssueType(str, Enum):
    THRESHOLD_MISMATCH = "threshold_mismatch"
    DUPLICATE_IMPORT = "duplicate_import"
    EXPORT_INCONSISTENT = "export_inconsistent"
    NEEDS_RECALCULATION = "needs_recalculation"


@dataclass
class PatchIssue:
    """修补过程中发现的问题"""
    issue_type: PatchIssueType
    description: str
    severity: str = "warning"
    track_id: str = ""
    evidence: Dict = field(default_factory=dict)
    resolved: bool = False
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None
    issue_id: str = field(default_factory=lambda: generate_id("issue"))


@dataclass
class PatchRecord:
    """轨迹预测缺失修补记录"""
    patch_id: str = field(default_factory=lambda: generate_id("patch"))
    candidate_table_id: str = ""
    param_yaml_id: str = ""
    status: PatchStatus = PatchStatus.DRAFT
    created_by: str = ""
    created_at: datetime = field(default_factory=get_current_time)
    updated_at: datetime = field(default_factory=get_current_time)
    issues: List[PatchIssue] = field(default_factory=list)
    metrics: Dict = field(default_factory=dict)
    tier_metrics: Dict[str, Dict] = field(default_factory=dict)
    remarks: str = ""
    review_comments: List[Dict] = field(default_factory=list)

    def add_issue(self, issue: PatchIssue):
        """添加问题"""
        self.issues.append(issue)
        self.updated_at = get_current_time()

    def resolve_issue(self, issue_id: str, resolved_by: str = ""):
        """标记问题已解决"""
        for issue in self.issues:
            if issue.issue_id == issue_id:
                issue.resolved = True
                issue.resolved_by = resolved_by
                issue.resolved_at = get_current_time()
        self.updated_at = get_current_time()

    def get_unresolved_issues(self) -> List[PatchIssue]:
        """获取未解决的问题"""
        return [i for i in self.issues if not i.resolved]

    def update_status(self, new_status: PatchStatus, updated_by: str = "", remark: str = ""):
        """更新状态"""
        self.status = new_status
        self.updated_at = get_current_time()
        if remark:
            self.remarks = remark
