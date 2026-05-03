"""余氯衰减计算器"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from .base import BaseRule
from ..models import (
    Pool, SensorData, DosingLog, ReviewRules, Issue,
    IssueType, SeverityLevel, PoolReviewResult, VisitorPeriod
)

logger = logging.getLogger(__name__)


class ChlorineDecayCalculator(BaseRule):
    """余氯衰减计算器"""
    
    def check(
        self,
        pool: Pool,
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]] = None,
        review_date: Optional[datetime] = None
    ) -> List[Issue]:
        """检查余氯衰减情况"""
        self.clear_issues()
        
        if not sensor_data or not sensor_data.readings:
            logger.warning(f"泳池 {pool.pool_id} 没有传感器数据，跳过余氯衰减检查")
            return []
        
        sensor_data.sort_readings()
        
        valid_readings = [
            r for r in sensor_data.readings 
            if r.is_valid('free_chlorine') and r.free_chlorine is not None
        ]
        
        if len(valid_readings) < 2:
            logger.warning(f"泳池 {pool.pool_id} 有效余氯读数不足")
            return []
        
        decay_windows = self._identify_decay_windows(
            valid_readings, 
            dosing_log,
            visitor_periods
        )
        
        for window in decay_windows:
            self._analyze_decay_window(pool, window)
        
        return self.get_issues()
    
    def _identify_decay_windows(
        self,
        readings: List[Any],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]]
    ) -> List[Dict[str, Any]]:
        """识别衰减分析窗口（投药后或客流后）"""
        windows = []
        window_duration = timedelta(minutes=self.rules.decay_window_minutes)
        
        if dosing_log and dosing_log.records:
            for record in dosing_log.records:
                if record.chemical_type == 'chlorine':
                    window_start = record.timestamp
                    window_end = window_start + window_duration
                    
                    window_readings = [
                        r for r in readings
                        if window_start <= r.timestamp <= window_end
                    ]
                    
                    if len(window_readings) >= 2:
                        windows.append({
                            'start_time': window_start,
                            'end_time': window_end,
                            'readings': window_readings,
                            'trigger': 'dosing',
                            'dosing_record': record
                        })
        
        if visitor_periods:
            for period in visitor_periods:
                window_start = period.end_time
                window_end = window_start + window_duration
                
                window_readings = [
                    r for r in readings
                    if window_start <= r.timestamp <= window_end
                ]
                
                if len(window_readings) >= 2:
                    windows.append({
                        'start_time': window_start,
                        'end_time': window_end,
                        'readings': window_readings,
                        'trigger': 'visitor',
                        'visitor_period': period
                    })
        
        if not windows:
            first_reading = readings[0].timestamp
            last_reading = readings[-1].timestamp
            current = first_reading
            
            while current < last_reading:
                window_end = current + window_duration
                window_readings = [
                    r for r in readings
                    if current <= r.timestamp <= window_end
                ]
                
                if len(window_readings) >= 2:
                    windows.append({
                        'start_time': current,
                        'end_time': window_end,
                        'readings': window_readings,
                        'trigger': 'regular'
                    })
                
                current = window_end
        
        return windows
    
    def _analyze_decay_window(self, pool: Pool, window: Dict[str, Any]):
        """分析单个衰减窗口"""
        readings = window['readings']
        readings.sort(key=lambda x: x.timestamp)
        
        start_fc = readings[0].free_chlorine
        end_fc = readings[-1].free_chlorine
        
        if start_fc is None or end_fc is None:
            return
        
        time_delta_hours = (readings[-1].timestamp - readings[0].timestamp).total_seconds() / 3600
        
        if time_delta_hours <= 0:
            return
        
        decay_amount = start_fc - end_fc
        decay_rate_per_hour = decay_amount / time_delta_hours
        
        details = {
            'start_fc': start_fc,
            'end_fc': end_fc,
            'decay_amount': decay_amount,
            'decay_rate_per_hour': decay_rate_per_hour,
            'window_duration_hours': time_delta_hours,
            'trigger': window['trigger']
        }
        
        if decay_rate_per_hour > self.rules.critical_decay_threshold:
            self.add_issue(Issue(
                issue_type=IssueType.CHLORINE_DECAY,
                severity=SeverityLevel.CRITICAL,
                pool_id=pool.pool_id,
                pool_name=pool.pool_name,
                start_time=window['start_time'],
                end_time=window['end_time'],
                description=(
                    f"余氯异常快速衰减: 衰减率 {decay_rate_per_hour:.3f} mg/L/hour, "
                    f"超过临界阈值 {self.rules.critical_decay_threshold}"
                ),
                details=details
            ))
        elif decay_rate_per_hour > self.rules.max_decay_rate_per_hour:
            self.add_issue(Issue(
                issue_type=IssueType.CHLORINE_DECAY,
                severity=SeverityLevel.WARNING,
                pool_id=pool.pool_id,
                pool_name=pool.pool_name,
                start_time=window['start_time'],
                end_time=window['end_time'],
                description=(
                    f"余氯衰减偏快: 衰减率 {decay_rate_per_hour:.3f} mg/L/hour, "
                    f"超过正常阈值 {self.rules.max_decay_rate_per_hour}"
                ),
                details=details
            ))
