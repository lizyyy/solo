"""复盘引擎 - 整合所有规则检查器"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, time
import logging

from .base import BaseRule
from .decay_calculator import ChlorineDecayCalculator
from .window_checker import OutOfWindowChecker
from .visitor_checker import PostVisitorChecker
from .dosing_conflict import DosingConflictChecker
from .sensor_gap import SensorGapChecker

from ..models import (
    Pool, SensorData, DosingLog, ReviewRules, Issue,
    PoolReviewResult, ReviewResult, VisitorPeriod,
    PoolOperationHours, SeverityLevel
)

logger = logging.getLogger(__name__)


class ReviewEngine:
    """复盘引擎"""
    
    def __init__(self, rules: ReviewRules):
        self.rules = rules
        self.checkers = [
            ChlorineDecayCalculator(rules),
            OutOfWindowChecker(rules),
            PostVisitorChecker(rules),
            DosingConflictChecker(rules),
            SensorGapChecker(rules),
        ]
    
    def run_review(
        self,
        pools: Dict[str, Pool],
        sensor_data: Dict[str, SensorData],
        dosing_logs: Dict[str, DosingLog],
        visitor_periods: Optional[Dict[str, List[VisitorPeriod]]] = None,
        review_date: Optional[datetime] = None
    ) -> ReviewResult:
        """执行完整复盘"""
        if review_date is None:
            review_date = datetime.now()
        
        logger.info(f"开始复盘: {review_date.date()}")
        
        result = ReviewResult(review_date=review_date)
        
        for pool_id, pool in pools.items():
            pool_sensor = sensor_data.get(pool_id)
            pool_dosing = dosing_logs.get(pool_id)
            pool_visitors = (visitor_periods or {}).get(pool_id)
            
            pool_sensor = self._filter_data_by_review_date(
                pool_sensor, pool, review_date
            )
            pool_dosing = self._filter_dosing_by_review_date(
                pool_dosing, pool, review_date
            )
            
            pool_result = self._review_single_pool(
                pool, pool_sensor, pool_dosing, pool_visitors, review_date
            )
            
            result.add_pool_result(pool_result)
        
        self._generate_summary(result)
        
        logger.info(f"复盘完成: 共发现 {len(result.all_issues)} 个问题")
        
        return result
    
    def _filter_data_by_review_date(
        self,
        sensor_data: Optional[SensorData],
        pool: Pool,
        review_date: datetime
    ) -> Optional[SensorData]:
        """根据复盘日期过滤传感器数据，处理跨午夜情况"""
        if not sensor_data:
            return None
        
        start_dt, end_dt = self._get_review_time_range(pool, review_date)
        
        filtered_readings = [
            r for r in sensor_data.readings
            if start_dt <= r.timestamp < end_dt
        ]
        
        if not filtered_readings:
            return SensorData(pool_id=sensor_data.pool_id, readings=[])
        
        return SensorData(
            pool_id=sensor_data.pool_id,
            readings=filtered_readings
        )
    
    def _filter_dosing_by_review_date(
        self,
        dosing_log: Optional[DosingLog],
        pool: Pool,
        review_date: datetime
    ) -> Optional[DosingLog]:
        """根据复盘日期过滤投药记录，处理跨午夜情况"""
        if not dosing_log:
            return None
        
        start_dt, end_dt = self._get_review_time_range(pool, review_date)
        
        filtered_records = [
            r for r in dosing_log.records
            if start_dt <= r.timestamp < end_dt
        ]
        
        if not filtered_records:
            return DosingLog(pool_id=dosing_log.pool_id, records=[])
        
        return DosingLog(
            pool_id=dosing_log.pool_id,
            records=filtered_records
        )
    
    def _get_review_time_range(
        self,
        pool: Pool,
        review_date: datetime
    ) -> tuple:
        """获取复盘时间范围，处理跨午夜闭馆"""
        review_date_only = review_date.date()
        
        if pool.operation_hours:
            open_time = pool.operation_hours.daily_open_time
            close_time = pool.operation_hours.daily_close_time
            
            start_dt = datetime.combine(review_date_only, open_time)
            
            if pool.operation_hours.spans_midnight():
                end_dt = datetime.combine(review_date_only + timedelta(days=1), close_time)
            else:
                end_dt = datetime.combine(review_date_only, close_time)
            
            buffer = timedelta(hours=2)
            start_dt = start_dt - buffer
            end_dt = end_dt + buffer
        else:
            start_dt = datetime.combine(review_date_only, time(0, 0, 0))
            end_dt = start_dt + timedelta(days=1)
        
        return start_dt, end_dt
    
    def _review_single_pool(
        self,
        pool: Pool,
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog],
        visitor_periods: Optional[List[VisitorPeriod]],
        review_date: datetime
    ) -> PoolReviewResult:
        """复盘单个泳池"""
        logger.info(f"复盘泳池: {pool.pool_id} - {pool.pool_name}")
        
        pool_result = PoolReviewResult(
            pool_id=pool.pool_id,
            pool_name=pool.pool_name
        )
        
        for checker in self.checkers:
            issues = checker.check(
                pool=pool,
                sensor_data=sensor_data,
                dosing_log=dosing_log,
                visitor_periods=visitor_periods,
                review_date=review_date
            )
            pool_result.issues.extend(issues)
        
        pool_result.summary = self._create_pool_summary(
            pool, pool_result.issues, sensor_data, dosing_log
        )
        
        return pool_result
    
    def _create_pool_summary(
        self,
        pool: Pool,
        issues: List[Issue],
        sensor_data: Optional[SensorData],
        dosing_log: Optional[DosingLog]
    ) -> Dict[str, Any]:
        """创建泳池复盘摘要"""
        critical_count = sum(1 for i in issues if i.severity == SeverityLevel.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == SeverityLevel.WARNING)
        info_count = sum(1 for i in issues if i.severity == SeverityLevel.INFO)
        
        issue_types = {}
        for issue in issues:
            issue_type = issue.issue_type.value
            issue_types[issue_type] = issue_types.get(issue_type, 0) + 1
        
        sensor_count = len(sensor_data.readings) if sensor_data else 0
        dosing_count = len(dosing_log.records) if dosing_log else 0
        
        return {
            'pool_id': pool.pool_id,
            'pool_name': pool.pool_name,
            'volume': pool.volume_cubic_meters,
            'sensor_readings_count': sensor_count,
            'dosing_records_count': dosing_count,
            'issues_count': {
                'critical': critical_count,
                'warning': warning_count,
                'info': info_count,
                'total': len(issues)
            },
            'issues_by_type': issue_types
        }
    
    def _generate_summary(self, result: ReviewResult):
        """生成总体复盘摘要"""
        total_issues = len(result.all_issues)
        critical_count = sum(1 for i in result.all_issues if i.severity == SeverityLevel.CRITICAL)
        warning_count = sum(1 for i in result.all_issues if i.severity == SeverityLevel.WARNING)
        
        pools_with_critical = [
            pool_id for pool_id, pool_result in result.pools.items()
            if pool_result.count_critical() > 0
        ]
        
        summary_stats = {
            'review_date': result.review_date.isoformat(),
            'total_pools': len(result.pools),
            'total_issues': total_issues,
            'critical_issues': critical_count,
            'warning_issues': warning_count,
            'pools_with_critical': len(pools_with_critical),
            'pools_with_critical_list': pools_with_critical
        }
        
        result.summary_stats = summary_stats
