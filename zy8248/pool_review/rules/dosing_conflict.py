"""投药冷却窗口冲突检查器"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from .base import BaseRule
from ..models import (
    Pool, SensorData, DosingLog, ReviewRules, Issue,
    IssueType, SeverityLevel, PoolReviewResult, VisitorPeriod,
    DosingRecord
)

logger = logging.getLogger(__name__)


class DosingConflictChecker(BaseRule):
    """投药冷却窗口冲突检查器"""
    
    def check(
        self,
        pool: Pool,
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]] = None,
        review_date: Optional[datetime] = None
    ) -> List[Issue]:
        """检查投药冷却窗口冲突"""
        self.clear_issues()
        
        if not dosing_log or not dosing_log.records:
            logger.info(f"泳池 {pool.pool_id} 没有投药记录，跳过冷却窗口冲突检查")
            return []
        
        dosing_log.sort_records()
        
        self._check_cooling_window_conflicts(pool, dosing_log)
        
        return self.get_issues()
    
    def _check_cooling_window_conflicts(self, pool: Pool, dosing_log: DosingLog):
        """检查冷却窗口内的投药冲突"""
        cooling_periods = []
        cooling_minutes = self.rules.cooling_minutes_after_dosing
        forbidden_chemicals = set(self.rules.forbidden_chemicals_during_cooling)
        
        for record in dosing_log.records:
            if record.chemical_type in forbidden_chemicals:
                cooling_start = record.timestamp
                cooling_end = cooling_start + timedelta(minutes=cooling_minutes)
                cooling_periods.append({
                    'start': cooling_start,
                    'end': cooling_end,
                    'initial_chemical': record.chemical_type,
                    'initial_record': record
                })
        
        for i, record in enumerate(dosing_log.records):
            for cooling in cooling_periods:
                if (cooling['start'] < record.timestamp <= cooling['end'] and 
                    record is not cooling['initial_record']):
                    
                    if record.chemical_type in forbidden_chemicals:
                        details = {
                            'conflicting_chemical': record.chemical_type,
                            'conflicting_amount': record.amount_kg,
                            'conflicting_time': record.timestamp.isoformat(),
                            'initial_chemical': cooling['initial_chemical'],
                            'cooling_window_start': cooling['start'].isoformat(),
                            'cooling_window_end': cooling['end'].isoformat(),
                            'cooling_minutes': cooling_minutes
                        }
                        
                        self.add_issue(Issue(
                            issue_type=IssueType.DOSING_CONFLICT,
                            severity=SeverityLevel.WARNING,
                            pool_id=pool.pool_id,
                            pool_name=pool.pool_name,
                            start_time=cooling['start'],
                            end_time=cooling['end'],
                            description=(
                                f"投药冷却窗口冲突: "
                                f"{cooling['initial_chemical']} 投药后 {cooling_minutes} 分钟内, "
                                f"又投加了 {record.chemical_type}"
                            ),
                            details=details
                        ))
        
        self._check_too_frequent_dosing(pool, dosing_log, forbidden_chemicals)
    
    def _check_too_frequent_dosing(
        self,
        pool: Pool,
        dosing_log: DosingLog,
        forbidden_chemicals: set
    ):
        """检查同一化学品投药过于频繁"""
        cooling_minutes = self.rules.cooling_minutes_after_dosing
        
        for chemical in forbidden_chemicals:
            chemical_records = [
                r for r in dosing_log.records
                if r.chemical_type == chemical
            ]
            
            if len(chemical_records) < 2:
                continue
            
            for i in range(1, len(chemical_records)):
                prev_record = chemical_records[i-1]
                curr_record = chemical_records[i]
                
                time_diff = curr_record.timestamp - prev_record.timestamp
                time_diff_minutes = time_diff.total_seconds() / 60
                
                if time_diff_minutes < cooling_minutes:
                    details = {
                        'chemical': chemical,
                        'first_dosing_time': prev_record.timestamp.isoformat(),
                        'first_dosing_amount': prev_record.amount_kg,
                        'second_dosing_time': curr_record.timestamp.isoformat(),
                        'second_dosing_amount': curr_record.amount_kg,
                        'interval_minutes': time_diff_minutes,
                        'minimum_interval': cooling_minutes
                    }
                    
                    self.add_issue(Issue(
                        issue_type=IssueType.DOSING_CONFLICT,
                        severity=SeverityLevel.WARNING,
                        pool_id=pool.pool_id,
                        pool_name=pool.pool_name,
                        start_time=prev_record.timestamp,
                        end_time=curr_record.timestamp,
                        description=(
                            f"投药过于频繁: {chemical} 两次投药间隔 "
                            f"{time_diff_minutes:.1f} 分钟, 小于建议的 {cooling_minutes} 分钟"
                        ),
                        details=details
                    ))
