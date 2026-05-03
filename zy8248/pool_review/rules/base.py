"""规则基类"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ..models import (
    Pool, SensorData, DosingLog, ReviewRules, Issue,
    PoolReviewResult, VisitorPeriod
)

logger = logging.getLogger(__name__)


class BaseRule(ABC):
    """规则检查器基类"""
    
    def __init__(self, rules: ReviewRules):
        self.rules = rules
        self.issues: List[Issue] = []
    
    @abstractmethod
    def check(
        self,
        pool: Pool,
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]] = None,
        review_date: Optional[datetime] = None
    ) -> List[Issue]:
        """执行规则检查"""
        pass
    
    def add_issue(self, issue: Issue):
        """添加问题"""
        logger.debug(f"检测到问题: {issue.issue_type.value} - {issue.description}")
        self.issues.append(issue)
    
    def clear_issues(self):
        """清空问题列表"""
        self.issues.clear()
    
    def get_issues(self) -> List[Issue]:
        """获取所有问题"""
        return self.issues.copy()
