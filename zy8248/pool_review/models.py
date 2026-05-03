"""数据模型定义"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any


class SeverityLevel(Enum):
    """异常严重级别"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class IssueType(Enum):
    """问题类型"""
    CHLORINE_DECAY = "chlorine_decay"
    PH_OUT_OF_WINDOW = "ph_out_of_window"
    ORP_OUT_OF_WINDOW = "orp_out_of_window"
    POST_VISITOR_MISSING = "post_visitor_missing"
    DOSING_CONFLICT = "dosing_conflict"
    SENSOR_GAP = "sensor_gap"
    CROSS_MIDNIGHT_ISSUE = "cross_midnight_issue"


@dataclass
class PoolOperationHours:
    """泳池运营时间"""
    daily_open_time: time
    daily_close_time: time
    
    def spans_midnight(self) -> bool:
        """检查运营时间是否跨午夜"""
        return self.daily_close_time < self.daily_open_time
    
    def get_operating_period(self, date: datetime) -> Tuple[datetime, datetime]:
        """获取指定日期的运营时间段"""
        open_dt = datetime.combine(date.date(), self.daily_open_time)
        close_dt = datetime.combine(date.date(), self.daily_close_time)
        
        if self.spans_midnight():
            close_dt += timedelta(days=1)
        
        return open_dt, close_dt


@dataclass
class Pool:
    """泳池配置"""
    pool_id: str
    pool_name: str
    volume_cubic_meters: float
    target_free_chlorine: Tuple[float, float]
    target_ph: Tuple[float, float]
    target_orp: Tuple[float, float]
    operation_hours: Optional[PoolOperationHours] = None
    
    def is_in_operating_hours(self, timestamp: datetime) -> bool:
        """检查时间是否在运营时间内"""
        if not self.operation_hours:
            return True
        
        open_dt, close_dt = self.operation_hours.get_operating_period(timestamp)
        
        if self.operation_hours.spans_midnight():
            if timestamp.time() >= self.operation_hours.daily_open_time:
                check_dt = datetime.combine(timestamp.date(), self.operation_hours.daily_open_time)
            else:
                check_dt = datetime.combine(timestamp.date() - timedelta(days=1), 
                                            self.operation_hours.daily_open_time)
            open_dt = check_dt
            close_dt = open_dt + (
                datetime.combine(timestamp.date(), self.operation_hours.daily_close_time) -
                datetime.combine(timestamp.date(), time(0))
            )
            if self.operation_hours.daily_close_time < self.operation_hours.daily_open_time:
                close_dt += timedelta(days=1)
        
        return open_dt <= timestamp < close_dt


@dataclass
class SensorReading:
    """传感器读数"""
    pool_id: str
    timestamp: datetime
    free_chlorine: Optional[float]
    ph: Optional[float]
    orp: Optional[float]
    
    def is_valid(self, metric: str = 'all') -> bool:
        """检查读数是否有效"""
        if metric == 'all':
            return (self.free_chlorine is not None and 
                    self.ph is not None and 
                    self.orp is not None)
        elif metric == 'free_chlorine':
            return self.free_chlorine is not None
        elif metric == 'ph':
            return self.ph is not None
        elif metric == 'orp':
            return self.orp is not None
        return False


@dataclass
class SensorData:
    """泳池传感器数据"""
    pool_id: str
    readings: List[SensorReading] = field(default_factory=list)
    
    def sort_readings(self):
        """按时间排序读数"""
        self.readings.sort(key=lambda x: x.timestamp)
    
    def get_readings_in_range(self, start: datetime, end: datetime) -> List[SensorReading]:
        """获取指定时间范围内的读数"""
        return [r for r in self.readings if start <= r.timestamp < end]
    
    def get_gaps(self, max_gap_minutes: int = 5) -> List[Tuple[datetime, datetime, timedelta]]:
        """获取数据断采间隔"""
        if len(self.readings) < 2:
            return []
        
        gaps = []
        self.sort_readings()
        max_gap = timedelta(minutes=max_gap_minutes)
        
        prev_time = self.readings[0].timestamp
        for reading in self.readings[1:]:
            gap = reading.timestamp - prev_time
            if gap > max_gap:
                gaps.append((prev_time, reading.timestamp, gap))
            prev_time = reading.timestamp
        
        return gaps


@dataclass
class DosingRecord:
    """投药记录"""
    pool_id: str
    timestamp: datetime
    chemical_type: str
    amount_kg: float
    operator: str = ""
    notes: str = ""


@dataclass
class DosingLog:
    """投药日志"""
    pool_id: str
    records: List[DosingRecord] = field(default_factory=list)
    
    def sort_records(self):
        """按时间排序记录"""
        self.records.sort(key=lambda x: x.timestamp)
    
    def get_records_in_range(self, start: datetime, end: datetime) -> List[DosingRecord]:
        """获取指定时间范围内的投药记录"""
        return [r for r in self.records if start <= r.timestamp < end]


@dataclass
class ReviewRules:
    """复盘规则配置"""
    max_decay_rate_per_hour: float = 0.3
    critical_decay_threshold: float = 0.5
    decay_window_minutes: int = 60
    
    ph_window: Tuple[float, float] = (7.2, 7.6)
    orp_window: Tuple[float, float] = (650, 850)
    out_of_window_duration_minutes: int = 15
    critical_outage_duration_minutes: int = 30
    
    post_visitor_check_delay_minutes: int = 30
    post_visitor_check_window_minutes: int = 60
    required_readings_after_visitors: int = 3
    
    cooling_minutes_after_dosing: int = 30
    forbidden_chemicals_during_cooling: List[str] = field(
        default_factory=lambda: ['chlorine', 'ph_minus']
    )
    
    max_gap_minutes: int = 5
    critical_gap_minutes: int = 30
    
    severity_thresholds: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Issue:
    """复盘发现的问题"""
    issue_type: IssueType
    severity: SeverityLevel
    pool_id: str
    pool_name: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于CSV导出）"""
        return {
            'issue_type': self.issue_type.value,
            'severity': self.severity.value,
            'pool_id': self.pool_id,
            'pool_name': self.pool_name,
            'start_time': self.start_time.isoformat() if self.start_time else '',
            'end_time': self.end_time.isoformat() if self.end_time else '',
            'description': self.description,
            'details': str(self.details)
        }


@dataclass
class PoolReviewResult:
    """单泳池复盘结果"""
    pool_id: str
    pool_name: str
    issues: List[Issue] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    
    def get_issues_by_severity(self, severity: SeverityLevel) -> List[Issue]:
        """按严重级别获取问题"""
        return [i for i in self.issues if i.severity == severity]
    
    def count_critical(self) -> int:
        """统计严重问题数量"""
        return len(self.get_issues_by_severity(SeverityLevel.CRITICAL))
    
    def count_warnings(self) -> int:
        """统计警告问题数量"""
        return len(self.get_issues_by_severity(SeverityLevel.WARNING))


@dataclass
class ReviewResult:
    """完整复盘结果"""
    review_date: datetime
    pools: Dict[str, PoolReviewResult] = field(default_factory=dict)
    all_issues: List[Issue] = field(default_factory=list)
    
    def add_pool_result(self, result: PoolReviewResult):
        """添加泳池复盘结果"""
        self.pools[result.pool_id] = result
        self.all_issues.extend(result.issues)
    
    def get_all_issues_by_severity(self) -> Dict[SeverityLevel, List[Issue]]:
        """按严重级别分类所有问题"""
        result = {level: [] for level in SeverityLevel}
        for issue in self.all_issues:
            result[issue.severity].append(issue)
        return result
    
    def count_issues_by_type(self) -> Dict[str, int]:
        """按问题类型统计"""
        counts: Dict[str, int] = {}
        for issue in self.all_issues:
            key = issue.issue_type.value
            counts[key] = counts.get(key, 0) + 1
        return counts


@dataclass
class VisitorPeriod:
    """客流时间段"""
    pool_id: str
    start_time: datetime
    end_time: datetime
    visitor_count: int
