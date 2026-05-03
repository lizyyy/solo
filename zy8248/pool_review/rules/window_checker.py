"""超窗检查器 - pH/ORP超范围检测"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from .base import BaseRule
from ..models import (
    Pool, SensorData, DosingLog, ReviewRules, Issue,
    IssueType, SeverityLevel, PoolReviewResult, VisitorPeriod
)

logger = logging.getLogger(__name__)


class OutOfWindowChecker(BaseRule):
    """pH/ORP超窗检查器"""
    
    def check(
        self,
        pool: Pool,
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]] = None,
        review_date: Optional[datetime] = None
    ) -> List[Issue]:
        """检查pH和ORP是否超出正常范围"""
        self.clear_issues()
        
        if not sensor_data or not sensor_data.readings:
            logger.warning(f"泳池 {pool.pool_id} 没有传感器数据，跳超窗检查")
            return []
        
        sensor_data.sort_readings()
        
        self._check_ph_out_of_window(pool, sensor_data)
        self._check_orp_out_of_window(pool, sensor_data)
        
        return self.get_issues()
    
    def _check_ph_out_of_window(self, pool: Pool, sensor_data: SensorData):
        """检查pH超窗"""
        ph_min, ph_max = pool.target_ph
        if ph_min is None or ph_max is None:
            ph_min, ph_max = self.rules.ph_window
        
        out_of_window_periods = self._find_out_of_window_periods(
            sensor_data.readings,
            'ph',
            ph_min,
            ph_max
        )
        
        for period in out_of_window_periods:
            duration_minutes = period['duration_minutes']
            avg_value = period['avg_value']
            
            details = {
                'metric': 'ph',
                'min_threshold': ph_min,
                'max_threshold': ph_max,
                'avg_value': avg_value,
                'duration_minutes': duration_minutes,
                'min_value': period['min_value'],
                'max_value': period['max_value']
            }
            
            if duration_minutes >= self.rules.critical_outage_duration_minutes:
                self.add_issue(Issue(
                    issue_type=IssueType.PH_OUT_OF_WINDOW,
                    severity=SeverityLevel.CRITICAL,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=period['start_time'],
                    end_time=period['end_time'],
                    description=(
                        f"pH严重超窗: 持续 {duration_minutes} 分钟, "
                        f"平均值 {avg_value:.2f}, 正常范围 [{ph_min}, {ph_max}]"
                    ),
                    details=details
                ))
            elif duration_minutes >= self.rules.out_of_window_duration_minutes:
                self.add_issue(Issue(
                    issue_type=IssueType.PH_OUT_OF_WINDOW,
                    severity=SeverityLevel.WARNING,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=period['start_time'],
                    end_time=period['end_time'],
                    description=(
                        f"pH超窗: 持续 {duration_minutes} 分钟, "
                        f"平均值 {avg_value:.2f}, 正常范围 [{ph_min}, {ph_max}]"
                    ),
                    details=details
                ))
    
    def _check_orp_out_of_window(self, pool: Pool, sensor_data: SensorData):
        """检查ORP超窗"""
        orp_min, orp_max = pool.target_orp
        if orp_min is None or orp_max is None:
            orp_min, orp_max = self.rules.orp_window
        
        out_of_window_periods = self._find_out_of_window_periods(
            sensor_data.readings,
            'orp',
            orp_min,
            orp_max
        )
        
        for period in out_of_window_periods:
            duration_minutes = period['duration_minutes']
            avg_value = period['avg_value']
            
            details = {
                'metric': 'orp',
                'min_threshold': orp_min,
                'max_threshold': orp_max,
                'avg_value': avg_value,
                'duration_minutes': duration_minutes,
                'min_value': period['min_value'],
                'max_value': period['max_value']
            }
            
            if duration_minutes >= self.rules.critical_outage_duration_minutes:
                self.add_issue(Issue(
                    issue_type=IssueType.ORP_OUT_OF_WINDOW,
                    severity=SeverityLevel.CRITICAL,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=period['start_time'],
                    end_time=period['end_time'],
                    description=(
                        f"ORP严重超窗: 持续 {duration_minutes} 分钟, "
                        f"平均值 {avg_value:.0f}, 正常范围 [{orp_min}, {orp_max}]"
                    ),
                    details=details
                ))
            elif duration_minutes >= self.rules.out_of_window_duration_minutes:
                self.add_issue(Issue(
                    issue_type=IssueType.ORP_OUT_OF_WINDOW,
                    severity=SeverityLevel.WARNING,
                    pool_id=pool.pool_id,
                    pool_name=pool.pool_name,
                    start_time=period['start_time'],
                    end_time=period['end_time'],
                    description=(
                        f"ORP超窗: 持续 {duration_minutes} 分钟, "
                        f"平均值 {avg_value:.0f}, 正常范围 [{orp_min}, {orp_max}]"
                    ),
                    details=details
                ))
    
    def _find_out_of_window_periods(
        self,
        readings: List[Any],
        metric: str,
        min_val: float,
        max_val: float
    ) -> List[Dict[str, Any]]:
        """查找超窗时间段"""
        periods = []
        current_period = None
        out_of_window_values = []
        
        for reading in readings:
            value = getattr(reading, metric)
            
            if value is None:
                if current_period:
                    periods.append(self._finalize_period(current_period, out_of_window_values))
                    current_period = None
                    out_of_window_values = []
                continue
            
            is_out_of_window = value < min_val or value > max_val
            
            if is_out_of_window:
                if current_period is None:
                    current_period = {
                        'start_time': reading.timestamp,
                        'start_value': value
                    }
                    out_of_window_values = [value]
                else:
                    out_of_window_values.append(value)
            else:
                if current_period:
                    current_period['end_time'] = reading.timestamp
                    periods.append(self._finalize_period(current_period, out_of_window_values))
                    current_period = None
                    out_of_window_values = []
        
        if current_period and out_of_window_values:
            last_reading = readings[-1]
            current_period['end_time'] = last_reading.timestamp
            periods.append(self._finalize_period(current_period, out_of_window_values))
        
        return periods
    
    def _finalize_period(
        self,
        period: Dict[str, Any],
        values: List[float]
    ) -> Dict[str, Any]:
        """完成时间段计算"""
        duration = period['end_time'] - period['start_time']
        duration_minutes = duration.total_seconds() / 60
        
        return {
            'start_time': period['start_time'],
            'end_time': period['end_time'],
            'duration_minutes': duration_minutes,
            'avg_value': sum(values) / len(values) if values else 0,
            'min_value': min(values) if values else 0,
            'max_value': max(values) if values else 0,
            'values_count': len(values)
        }
