from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum


class AnomalyType(Enum):
    OVER_THRESHOLD = 'over_threshold'  # 超标
    SUDDEN_PEAK = 'sudden_peak'  # 突增峰值
    SENSOR_OFFLINE = 'sensor_offline'  # 传感器离线
    MISSING_DATA = 'missing_data'  # 缺测数据
    WEATHER_INTERFERENCE = 'weather_interference'  # 天气干扰


class SeverityLevel(Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    CRITICAL = 'critical'


@dataclass
class AnomalyEvent:
    event_id: str
    event_type: AnomalyType
    site_id: str
    start_time: datetime
    end_time: datetime
    severity: SeverityLevel = SeverityLevel.MEDIUM
    description: str = ''
    evidence: Dict[str, Any] = field(default_factory=dict)
    is_verified: bool = False
    verification_notes: str = ''
    related_complaints: List[str] = field(default_factory=list)  # 关联的投诉ID
    
    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'event_id': self.event_id,
            'event_type': self.event_type.value,
            'site_id': self.site_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'duration_seconds': self.duration.total_seconds(),
            'severity': self.severity.value,
            'description': self.description,
            'evidence': self.evidence,
            'is_verified': self.is_verified,
            'verification_notes': self.verification_notes,
            'related_complaints': self.related_complaints
        }


@dataclass
class OverThresholdWindow:
    window_id: str
    site_id: str
    start_time: datetime
    end_time: datetime
    threshold: float  # 超标阈值
    max_value: float  # 窗口内最大值
    mean_value: float  # 窗口内平均值
    duration_minutes: float
    is_peak_window: bool = False  # 是否为突增峰值窗口
    weather_impact: bool = False  # 是否受天气影响
    related_complaints: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'window_id': self.window_id,
            'site_id': self.site_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'threshold': self.threshold,
            'max_value': self.max_value,
            'mean_value': self.mean_value,
            'duration_minutes': self.duration_minutes,
            'is_peak_window': self.is_peak_window,
            'weather_impact': self.weather_impact,
            'related_complaints': self.related_complaints
        }


@dataclass
class SuddenPeak:
    peak_id: str
    site_id: str
    timestamp: datetime
    peak_value: float
    baseline_value: float  # 峰值前的基线值
    increase_amount: float  # 突增量
    increase_percent: float  # 突增百分比
    duration_seconds: float  # 峰值持续时间
    surrounding_window_id: Optional[str] = None
    is_weather_related: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'peak_id': self.peak_id,
            'site_id': self.site_id,
            'timestamp': self.timestamp.isoformat(),
            'peak_value': self.peak_value,
            'baseline_value': self.baseline_value,
            'increase_amount': self.increase_amount,
            'increase_percent': self.increase_percent,
            'duration_seconds': self.duration_seconds,
            'surrounding_window_id': self.surrounding_window_id,
            'is_weather_related': self.is_weather_related
        }


@dataclass
class SensorOfflinePeriod:
    period_id: str
    site_id: str
    start_time: datetime
    end_time: datetime
    duration_minutes: float
    expected_samples: int  # 预计应有采样数
    actual_samples: int  # 实际采样数
    missing_count: int
    is_planned: bool = False  # 是否为计划内离线
    reason: str = ''  # 离线原因（如果已知）
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'period_id': self.period_id,
            'site_id': self.site_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'duration_minutes': self.duration_minutes,
            'expected_samples': self.expected_samples,
            'actual_samples': self.actual_samples,
            'missing_count': self.missing_count,
            'is_planned': self.is_planned,
            'reason': self.reason
        }


@dataclass
class ComplaintEvidence:
    evidence_id: str
    complaint_id: str
    site_id: str
    complaint_time: datetime
    analysis_window_start: datetime
    analysis_window_end: datetime
    
    has_exceedance: bool = False
    exceedance_details: Dict[str, Any] = field(default_factory=dict)
    
    has_sudden_peak: bool = False
    peak_details: Dict[str, Any] = field(default_factory=dict)
    
    has_sensor_offline: bool = False
    offline_details: Dict[str, Any] = field(default_factory=dict)
    
    has_weather_interference: bool = False
    weather_details: Dict[str, Any] = field(default_factory=dict)
    
    summary: str = ''
    recommendation: str = ''  # confirmed, dismissed, further_review
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'evidence_id': self.evidence_id,
            'complaint_id': self.complaint_id,
            'site_id': self.site_id,
            'complaint_time': self.complaint_time.isoformat(),
            'analysis_window_start': self.analysis_window_start.isoformat(),
            'analysis_window_end': self.analysis_window_end.isoformat(),
            'has_exceedance': self.has_exceedance,
            'exceedance_details': self.exceedance_details,
            'has_sudden_peak': self.has_sudden_peak,
            'peak_details': self.peak_details,
            'has_sensor_offline': self.has_sensor_offline,
            'offline_details': self.offline_details,
            'has_weather_interference': self.has_weather_interference,
            'weather_details': self.weather_details,
            'summary': self.summary,
            'recommendation': self.recommendation
        }


@dataclass
class AnalysisResult:
    analysis_id: str
    analysis_time: datetime
    
    noise_data_sites: List[str] = field(default_factory=list)
    weather_data_sites: List[str] = field(default_factory=list)
    total_complaints: int = 0
    
    threshold_config: Dict[str, float] = field(default_factory=dict)  # 阈值配置
    
    anomaly_events: List[AnomalyEvent] = field(default_factory=list)
    over_threshold_windows: List[OverThresholdWindow] = field(default_factory=list)
    sudden_peaks: List[SuddenPeak] = field(default_factory=list)
    sensor_offline_periods: List[SensorOfflinePeriod] = field(default_factory=list)
    complaint_evidences: List[ComplaintEvidence] = field(default_factory=list)
    
    statistics: Dict[str, Any] = field(default_factory=dict)
    
    def get_anomalies_by_type(self, event_type: AnomalyType) -> List[AnomalyEvent]:
        return [e for e in self.anomaly_events if e.event_type == event_type]
    
    def get_anomalies_by_site(self, site_id: str) -> List[AnomalyEvent]:
        return [e for e in self.anomaly_events if e.site_id == site_id]
    
    def get_evidence_for_complaint(self, complaint_id: str) -> Optional[ComplaintEvidence]:
        for evidence in self.complaint_evidences:
            if evidence.complaint_id == complaint_id:
                return evidence
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'analysis_id': self.analysis_id,
            'analysis_time': self.analysis_time.isoformat(),
            'noise_data_sites': self.noise_data_sites,
            'weather_data_sites': self.weather_data_sites,
            'total_complaints': self.total_complaints,
            'threshold_config': self.threshold_config,
            'anomaly_events': [e.to_dict() for e in self.anomaly_events],
            'over_threshold_windows': [w.to_dict() for w in self.over_threshold_windows],
            'sudden_peaks': [p.to_dict() for p in self.sudden_peaks],
            'sensor_offline_periods': [p.to_dict() for p in self.sensor_offline_periods],
            'complaint_evidences': [e.to_dict() for e in self.complaint_evidences],
            'statistics': self.statistics
        }
