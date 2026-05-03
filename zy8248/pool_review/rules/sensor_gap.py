"""传感器断采检查器"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from .base import BaseRule
from ..models import (
    Pool, SensorData, DosingLog, ReviewRules, Issue,
    IssueType, SeverityLevel, PoolReviewResult, VisitorPeriod
)

logger = logging.getLogger(__name__)


class SensorGapChecker(BaseRule):
    """传感器断采检查器"""
    
    def check(
        self,
        pool: Pool,
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]] = None,
        review_date: Optional[datetime] = None
    ) -> List[Issue]:
        """检查传感器数据断采情况"""
        self.clear_issues()
        
        if not sensor_data or not sensor_data.readings:
            logger.warning(f"泳池 {pool.pool_id} 没有传感器数据")
            
            if review_date:
                self.add_issue(Issue(
                    issue_type=IssueType.SENSOR_GAP,
                    severity=SeverityLevel.CRITICAL,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=review_date,
                    end_time=review_date + timedelta(hours=24),
                    description="无传感器数据，全天数据断采",
                    details={'gap_type': 'no_data'}
                ))
            return self.get_issues()
        
        gaps = sensor_data.get_gaps(self.rules.max_gap_minutes)
        
        for gap_start, gap_end, gap_duration in gaps:
            gap_minutes = gap_duration.total_seconds() / 60
            
            is_critical = gap_minutes >= self.rules.critical_gap_minutes
            
            details = {
                'gap_minutes': gap_minutes,
                'max_allowed_minutes': self.rules.max_gap_minutes,
                'critical_threshold': self.rules.critical_gap_minutes
            }
            
            if is_critical:
                self.add_issue(Issue(
                    issue_type=IssueType.SENSOR_GAP,
                    severity=SeverityLevel.CRITICAL,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=gap_start,
                    end_time=gap_end,
                    description=(
                        f"传感器严重断采: 持续 {gap_minutes:.1f} 分钟, "
                        f"超过临界阈值 {self.rules.critical_gap_minutes} 分钟"
                    ),
                    details=details
                ))
            else:
                self.add_issue(Issue(
                    issue_type=IssueType.SENSOR_GAP,
                    severity=SeverityLevel.WARNING,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=gap_start,
                    end_time=gap_end,
                    description=(
                        f"传感器数据断采: 持续 {gap_minutes:.1f} 分钟, "
                        f"超过正常阈值 {self.rules.max_gap_minutes} 分钟"
                    ),
                    details=details
                ))
        
        self._check_invalid_readings(pool, sensor_data)
        
        return self.get_issues()
    
    def _check_invalid_readings(self, pool: Pool, sensor_data: SensorData):
        """检查无效读数（None值）"""
        total_count = len(sensor_data.readings)
        
        if total_count == 0:
            return
        
        fc_invalid = sum(1 for r in sensor_data.readings if r.free_chlorine is None)
        ph_invalid = sum(1 for r in sensor_data.readings if r.ph is None)
        orp_invalid = sum(1 for r in sensor_data.readings if r.orp is None)
        
        invalid_threshold = 0.1
        
        for metric_name, invalid_count in [
            ('free_chlorine', fc_invalid),
            ('ph', ph_invalid),
            ('orp', orp_invalid)
        ]:
            invalid_ratio = invalid_count / total_count
            
            if invalid_ratio > invalid_threshold:
                details = {
                    'metric': metric_name,
                    'total_readings': total_count,
                    'invalid_readings': invalid_count,
                    'invalid_ratio': invalid_ratio
                }
                
                if invalid_ratio > 0.3:
                    self.add_issue(Issue(
                        issue_type=IssueType.SENSOR_GAP,
                        severity=SeverityLevel.CRITICAL,
                        pool_id=pool.pool_id,
                        pool_name=pool.pool_name,
                        start_time=sensor_data.readings[0].timestamp if sensor_data.readings else None,
                        end_time=sensor_data.readings[-1].timestamp if sensor_data.readings else None,
                        description=(
                            f"传感器读数严重异常: {metric_name} 无效读数比例 "
                            f"{invalid_ratio*100:.1f}%, 超过30%"
                        ),
                        details=details
                    ))
                else:
                    self.add_issue(Issue(
                        issue_type=IssueType.SENSOR_GAP,
                        severity=SeverityLevel.WARNING,
                        pool_id=pool.pool_id,
                        pool_name=pool.pool_name,
                        start_time=sensor_data.readings[0].timestamp if sensor_data.readings else None,
                        end_time=sensor_data.readings[-1].timestamp if sensor_data.readings else None,
                        description=(
                            f"传感器读数异常: {metric_name} 无效读数比例 "
                            f"{invalid_ratio*100:.1f}%, 超过10%"
                        ),
                        details=details
                    ))
