from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from ..models.patch_record import PatchRecord, PatchStatus, PatchIssue
from ..models.audit_log import AuditLog, OperationType
from ..utils.helpers import get_current_time


class ReviewDecision(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    NEEDS_MORE_INFO = "needs_more_info"


@dataclass
class ReviewComment:
    """复核评论"""
    comment_id: str
    reviewer: str
    content: str
    created_at: datetime
    decision: Optional[ReviewDecision] = None
    issue_ids: List[str] = field(default_factory=list)


class Reviewer:
    """
    复核模块
    支持：
    1. 记录谁改了什么、为什么改
    2. 追踪改完影响哪些结果
    3. 阈值旧值问题留给数据科学家复核
    """

    def __init__(self):
        self.audit_logs: List[AuditLog] = []
        self.comments: List[ReviewComment] = []

    def log_operation(
        self,
        operation_type: OperationType,
        operator: str,
        patch_id: str = "",
        details: Dict = None,
        before_state: Dict = None,
        after_state: Dict = None,
        reason: str = "",
    ) -> AuditLog:
        """记录操作日志"""
        log = AuditLog(
            operation_type=operation_type,
            operator=operator,
            patch_id=patch_id,
            details=details or {},
            before_state=before_state or {},
            after_state=after_state or {},
            reason=reason,
        )
        self.audit_logs.append(log)
        return log

    def add_review_comment(
        self,
        reviewer: str,
        content: str,
        decision: Optional[ReviewDecision] = None,
        issue_ids: List[str] = None,
    ) -> ReviewComment:
        """添加复核评论"""
        comment = ReviewComment(
            comment_id=f"cmt_{len(self.comments) + 1}",
            reviewer=reviewer,
            content=content,
            created_at=get_current_time(),
            decision=decision,
            issue_ids=issue_ids or [],
        )
        self.comments.append(comment)
        return comment

    def get_change_history(self, patch_id: str = "") -> List[AuditLog]:
        """获取变更历史"""
        if patch_id:
            return [log for log in self.audit_logs if log.patch_id == patch_id]
        return self.audit_logs

    def get_who_changed_what(self, patch_id: str = "") -> List[Dict]:
        """获取谁改了什么的摘要"""
        logs = self.get_change_history(patch_id)
        summary = []
        for log in logs:
            summary.append({
                "timestamp": log.timestamp.isoformat(),
                "operator": log.operator,
                "operation": log.operation_type,
                "changes": log.get_change_summary(),
                "reason": log.reason,
            })
        return summary

    def get_impact_analysis(
        self,
        patch_record: PatchRecord,
        operation_type: OperationType,
    ) -> Dict:
        """分析变更影响"""
        impact = {
            "operation_type": operation_type,
            "affected_metrics": list(patch_record.tier_metrics.keys()),
            "issues_count": len(patch_record.issues),
            "unresolved_issues": len(patch_record.get_unresolved_issues()),
        }

        if operation_type == OperationType.UPDATE_THRESHOLD:
            impact["impact_description"] = "阈值变更可能影响所有相关轨迹的判定结果，建议重新计算分层指标"
            impact["needs_recalculation"] = True
        elif operation_type == OperationType.IMPORT_CANDIDATES:
            impact["impact_description"] = "新增候选记录可能改变召回统计"
            impact["needs_recalculation"] = True
        else:
            impact["impact_description"] = "操作已记录"
            impact["needs_recalculation"] = False

        return impact

    def needs_data_scientist_review(self, patch_record: PatchRecord) -> bool:
        """判断是否需要数据科学家复核（只看未解决的问题）"""
        for issue in patch_record.issues:
            if issue.resolved:
                continue
            evidence = issue.evidence or {}
            if evidence.get("needs_data_scientist_review", False):
                return True
            if issue.issue_type == "threshold_mismatch":
                return True
        return False

    def get_review_summary(self, patch_record: PatchRecord) -> Dict:
        """获取复核摘要"""
        return {
            "patch_id": patch_record.patch_id,
            "status": patch_record.status,
            "total_issues": len(patch_record.issues),
            "unresolved_issues": len(patch_record.get_unresolved_issues()),
            "needs_data_scientist_review": self.needs_data_scientist_review(patch_record),
            "change_count": len(self.get_change_history(patch_record.patch_id)),
            "comment_count": len([c for c in self.comments if patch_record.patch_id in c.issue_ids]),
        }
