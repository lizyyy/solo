"""客流后补测检查器"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from .base import BaseRule
from ..models import (
    Pool, SensorData, DosingLog, ReviewRules, Issue,
    IssueType, SeverityLevel, PoolReviewResult, VisitorPeriod
)

logger = logging.getLogger(__name__)


class PostVisitorChecker(BaseRule):
    """客流后补测检查器"""
    
    def check(
        self,
        pool: Pool,
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]] = None,
        review_date: Optional[datetime] = None
    ) -> List[Issue]:
        """检查客流后是否有足够的补测数据"""
        self.clear_issues()
        
        if not visitor_periods:
            logger.info(f"泳池 {pool.pool_id} 没有客流数据，跳过客流后补测检查")
            return []
        
        if not sensor_data or not sensor_data.readings:
            for period in visitor_periods:
                self.add_issue(Issue(
                    issue_type=IssueType.POST_VISITOR_MISSING,
                    severity=SeverityLevel.CRITICAL,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=period.end_time,
                    end_time=period.end_time + timedelta(
                        minutes=self.rules.post_visitor_check_delay_minutes + 
                                self.rules.post_visitor_check_window_minutes
                    ),
                    description=(
                        f"客流后无传感器数据: "
                        f"客流结束于 {period.end_time}, 客流量 {period.visitor_count} 人"
                    ),
                    details={
                        'visitor_count': period.visitor_count,
                        'required_readings': self.rules.required_readings_after_visitors,
                        'actual_readings': 0
                    }
                ))
            return self.get_issues()
        
        sensor_data.sort_readings()
        
        for period in visitor_periods:
            self._check_single_visitor_period(pool, sensor_data, period)
        
        return self.get_issues()
    
    def _check_single_visitor_period(
        self,
        pool: Pool,
        sensor_data: SensorData,
        visitor_period: VisitorPeriod
    ):
        """检查单个客流时间段后的补测情况"""
        check_start = visitor_period.end_time + timedelta(
            minutes=self.rules.post_visitor_check_delay_minutes
        )
        check_end = check_start + timedelta(
            minutes=self.rules.post_visitor_check_window_minutes
        )
        
        readings_in_window = [
            r for r in sensor_data.readings
            if check_start <= r.timestamp <= check_end
        ]
        
        valid_readings = [
            r for r in readings_in_window
            if r.is_valid('all')
        ]
        
        valid_count = len(valid_readings)
        required_count = self.rules.required_readings_after_visitors
        
        details = {
            'visitor_count': visitor_period.visitor_count,
            'check_window_start': check_start.isoformat(),
            'check_window_end': check_end.isoformat(),
            'required_readings': required_count,
            'actual_readings': valid_count,
            'total_readings_in_window': len(readings_in_window)
        }
        
        if valid_count == 0:
            self.add_issue(Issue(
                issue_type=IssueType.POST_VISITOR_MISSING,
                severity=SeverityLevel.CRITICAL,
                pool_id=pool.pool_id,
                pool_name=pool.pool_name,
                start_time=check_start,
                end_time=check_end,
                description=(
                    f"客流后无有效补测数据: "
                    f"需要 {required_count} 个读数, 实际 0 个, "
                    f"检查窗口: {check_start} - {check_end}"
                ),
                details=details
            ))
        elif valid_count < required_count:
            self.add_issue(Issue(
                issue_type=IssueType.POST_VISITOR_MISSING,
                severity=SeverityLevel.WARNING,
                pool_id=pool.pool_id,
                pool_name=pool.pool_name,
                start_time=check_start,
                end_time=check_end,
                description=(
                    f"客流后补测数据不足: "
                    f"需要 {required_count} 个读数, 实际 {valid_count} 个"
                ),
                details=details
            ))
