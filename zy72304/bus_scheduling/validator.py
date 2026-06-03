"""
边界校验器模块

核心功能：
- 判定百分数和小数混合情况
- 提供修改机制
- 提供回滚机制
- 所有边界规则都写在代码里，不靠口头约定
"""

import re
import uuid
from datetime import datetime
from typing import Tuple, Optional, Dict, Any, List

from .models import (
    MixedNumberIssue,
    NumberType,
    IssueStatus,
    ChangeHistory,
)
from .exceptions import (
    format_error,
    MixedNumberError,
    ValidationError,
)


class BoundaryValidator:
    """
    边界校验器

    所有边界规则都在此类中定义，确保规则在代码中可见，不依赖口头约定。
    """

    # 边界规则配置 - 写在代码里，不靠口头约定
    BOUNDARY_RULES = {
        "percentage_pattern": r"^\s*(\d+\.?\d*)\s*%\s*$",
        "decimal_pattern": r"^\s*(\d+\.?\d*)\s*$",
        "min_percentage": 0.0,
        "max_percentage": 100.0,
        "min_decimal": 0.0,
        "max_decimal": 10000.0,
        "mixed_detection_threshold": 2,
    }

    def __init__(self):
        self._percentage_re = re.compile(self.BOUNDARY_RULES["percentage_pattern"])
        self._decimal_re = re.compile(self.BOUNDARY_RULES["decimal_pattern"])
        self._change_history: List[ChangeHistory] = []

    def detect_number_type(self, value: str) -> Tuple[NumberType, Optional[float]]:
        """
        判定数值类型

        边界规则：
        1. 先判断是否为百分数（带%号）
        2. 再判断是否为小数
        3. 都不匹配则返回UNKNOWN

        Args:
            value: 原始字符串值

        Returns:
            (类型, 转换后的浮点数值)
        """
        if value is None:
            return NumberType.UNKNOWN, None

        value_str = str(value).strip()

        if not value_str:
            return NumberType.UNKNOWN, None

        # 检查是否为百分数
        pct_match = self._percentage_re.match(value_str)
        if pct_match:
            try:
                num_value = float(pct_match.group(1))
                if (self.BOUNDARY_RULES["min_percentage"] <= num_value <=
                        self.BOUNDARY_RULES["max_percentage"]):
                    return NumberType.PERCENTAGE, num_value / 100.0
            except ValueError:
                pass

        # 检查是否为小数
        dec_match = self._decimal_re.match(value_str)
        if dec_match:
            try:
                num_value = float(dec_match.group(1))
                if (self.BOUNDARY_RULES["min_decimal"] <= num_value <=
                        self.BOUNDARY_RULES["max_decimal"]):
                    return NumberType.DECIMAL, num_value
            except ValueError:
                pass

        return NumberType.UNKNOWN, None

    def check_mixed_numbers(
        self,
        values: List[str],
        record_id: str,
        field_name: str,
    ) -> Tuple[bool, List[MixedNumberIssue]]:
        """
        检查是否存在百分数和小数混合出现

        边界规则：
        1. 当同一字段在不同记录中同时出现百分数和小数，则判定为混合
        2. 混合情况需要活动负责人复核，不急着归正常

        Args:
            values: 同一字段的所有值
            record_id: 当前记录ID
            field_name: 字段名

        Returns:
            (是否存在混合, 问题列表)
        """
        issues = []
        types_found = set()
        converted_values = []

        for value in values:
            num_type, _ = self.detect_number_type(value)
            if num_type in (NumberType.PERCENTAGE, NumberType.DECIMAL):
                types_found.add(num_type)
                converted_values.append(value)

        has_mixed = (NumberType.PERCENTAGE in types_found and NumberType.DECIMAL in types_found)

        if has_mixed:
            for value in values:
                num_type, suggested = self.detect_number_type(value)
                if num_type in (NumberType.PERCENTAGE, NumberType.DECIMAL):
                    issue = MixedNumberIssue(
                        issue_id=f"issue_{uuid.uuid4().hex[:8]}",
                        record_id=record_id,
                        field_name=field_name,
                        original_value=value,
                        detected_type=num_type,
                        suggested_value=suggested,
                        status=IssueStatus.PENDING_REVIEW,
                    )
                    issues.append(issue)

        return has_mixed, issues

    def review_issue(
        self,
        issue: MixedNumberIssue,
        approved: bool,
        reviewer: str,
        retain_reason: Optional[str] = None,
        modified_value: Optional[float] = None,
    ) -> MixedNumberIssue:
        """
        复核混合问题

        边界规则：
        1. approved=True → 保留原值，标记为APPROVED
        2. approved=False + modified_value → 修改为新值，标记为MODIFIED
        3. approved=False + 无modified_value → 拒绝，标记为REJECTED

        Args:
            issue: 问题记录
            approved: 是否通过复核
            reviewer: 复核人
            retain_reason: 保留/修改理由
            modified_value: 修改后的值（当不通过时可选）

        Returns:
            更新后的问题记录
        """
        if issue.status != IssueStatus.PENDING_REVIEW:
            raise ValidationError(
                format_error("review_required"),
                {"issue_id": issue.issue_id,
                "current_status": issue.status.value,
            })

        issue.reviewer = reviewer
        issue.review_time = datetime.now()
        issue.retain_reason = retain_reason

        if approved:
            issue.status = IssueStatus.APPROVED
        elif modified_value is not None:
            issue.status = IssueStatus.MODIFIED
            issue.suggested_value = modified_value
        else:
            issue.status = IssueStatus.REJECTED

        return issue

    def rollback_issue(
        self,
        issue: MixedNumberIssue,
        operator: str,
        reason: str,
    ) -> Tuple[MixedNumberIssue, ChangeHistory]:
        """
        回滚问题处理结果

        边界规则：
        1. 回滚后状态回到PENDING_REVIEW
        2. 记录变更历史

        Args:
            issue: 问题记录
            operator: 操作人
            reason: 回滚理由

        Returns:
            (更新后的问题记录, 变更历史记录
        """
        if issue.status == IssueStatus.PENDING_REVIEW:
            raise ValidationError(
                format_error("rollback_failed"),
                {"issue_id": issue.issue_id, "reason": "该问题尚未处理，无需回滚"},
            )

        old_status = issue.status.value
        issue.status = IssueStatus.ROLLED_BACK

        history = ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=issue.record_id,
            field_name=f"issue_status:{issue.issue_id}",
            old_value=old_status,
            new_value=IssueStatus.PENDING_REVIEW.value,
            operator=operator,
            change_reason=reason,
        )

        self._change_history.append(history)

        # 重新标记为待复核
        issue.status = IssueStatus.PENDING_REVIEW
        issue.reviewer = None
        issue.review_time = None
        issue.retain_reason = None

        return issue, history

    def modify_value(
        self,
        issue: MixedNumberIssue,
        new_value: float,
        operator: str,
        reason: str,
    ) -> Tuple[MixedNumberIssue, ChangeHistory]:
        """
        修改问题数值

        边界规则：
        1. 记录修改历史
        2. 状态更新为MODIFIED

        Args:
            issue: 问题记录
            new_value: 新值
            operator: 操作人
            reason: 修改理由

        Returns:
            (更新后的问题记录, 变更历史记录
        """
        old_value = str(issue.suggested_value if issue.suggested_value else issue.original_value)

        history = ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=issue.record_id,
            field_name=issue.field_name,
            old_value=str(old_value),
            new_value=str(new_value),
            operator=operator,
            change_reason=reason,
        )

        self._change_history.append(history)

        issue.suggested_value = new_value
        issue.status = IssueStatus.MODIFIED
        issue.retain_reason = reason

        return issue, history

    def get_boundary_rules(self) -> Dict[str, Any]:
        """
        获取所有边界规则

        用于展示给用户查看，确保规则透明

        Returns:
            边界规则字典
        """
        return {
            "规则说明": "所有规则均已在代码中定义，不依赖口头约定",
            "百分数格式": "必须包含%符号，范围0-100",
            "小数格式": "纯数字，范围0-10000",
            "混合判定": "同一字段同时出现百分数和小数即判定为混合",
            "混合处理": "自动标记为待复核，不自动归一化，需活动负责人复核",
            "复核规则": self.BOUNDARY_RULES,
        }

    def get_change_history(self, record_id: Optional[str] = None) -> List[ChangeHistory]:
        """
        获取变更历史

        Args:
            record_id: 可选，指定记录ID

        Returns:
            变更历史列表
        """
        if record_id:
            return [h for h in self._change_history if h.record_id == record_id]
        return list(self._change_history)
