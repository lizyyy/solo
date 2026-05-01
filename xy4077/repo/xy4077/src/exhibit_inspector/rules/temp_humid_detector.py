"""温湿度超限检测器"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from ..models import (
    SensorRecord,
    SensorType,
    UnitType,
    ThresholdSettings,
    IssueType,
    IssueSeverity,
    TemperatureIssue,
    HumidityIssue,
)
from .base import BaseRule, RuleResult


@dataclass
class ThresholdResult:
    """阈值检测结果"""
    box_id: str
    sensor_id: str
    issue_type: IssueType
    start_time: str
    end_time: str
    max_value: float
    min_value: float
    threshold_high: Optional[float]
    threshold_low: Optional[float]
    duration_minutes: float
    sample_count: int
    severity: IssueSeverity


class TempHumidDetector(BaseRule[list[SensorRecord]]):
    """温湿度超限检测器"""
    
    def __init__(self, thresholds: ThresholdSettings):
        super().__init__("temp_humid_detector")
        self.thresholds = thresholds
    
    def execute(self, records: list[SensorRecord]) -> RuleResult:
        """执行温湿度超限检测"""
        result = RuleResult(
            rule_name=self.name,
            executed_at=datetime.now().isoformat(),
        )
        
        temp_records = [r for r in records if self._has_temp_data(r)]
        humid_records = [r for r in records if self._has_humid_data(r)]
        
        temp_issues = self._detect_temperature_issues(temp_records)
        humid_issues = self._detect_humidity_issues(humid_records)
        
        result.issues = temp_issues + humid_issues
        result.stats = {
            "total_temp_records": len(temp_records),
            "total_humid_records": len(humid_records),
            "temp_issues": len(temp_issues),
            "humid_issues": len(humid_issues),
            "temp_threshold_max": self.thresholds.temp_max_celsius,
            "temp_threshold_min": self.thresholds.temp_min_celsius,
            "humid_threshold_max": self.thresholds.humidity_max_pct,
            "humid_threshold_min": self.thresholds.humidity_min_pct,
        }
        
        return result
    
    def _has_temp_data(self, record: SensorRecord) -> bool:
        """检查记录是否包含温度数据"""
        if record.temperature_celsius is not None:
            return True
        if record.sensor_type in [SensorType.TEMPERATURE, SensorType.MULTI]:
            if record.value is not None and record.unit in [UnitType.CELSIUS, UnitType.FAHRENHEIT]:
                return True
        return False
    
    def _has_humid_data(self, record: SensorRecord) -> bool:
        """检查记录是否包含湿度数据"""
        if record.humidity_pct is not None:
            return True
        if record.sensor_type in [SensorType.HUMIDITY, SensorType.MULTI]:
            if record.value is not None and record.unit == UnitType.PERCENT:
                return True
        return False
    
    def _get_temp_value(self, record: SensorRecord) -> Optional[float]:
        """获取温度值（摄氏度）"""
        if record.temperature_celsius is not None:
            return record.temperature_celsius
        if record.sensor_type == SensorType.TEMPERATURE and record.value is not None:
            if record.unit == UnitType.CELSIUS:
                return record.value
            if record.unit == UnitType.FAHRENHEIT:
                return (record.value - 32) * 5 / 9
        if record.sensor_type == SensorType.MULTI and record.value is not None:
            if record.unit == UnitType.CELSIUS:
                return record.value
        return None
    
    def _get_humid_value(self, record: SensorRecord) -> Optional[float]:
        """获取湿度值（百分比）"""
        if record.humidity_pct is not None:
            return record.humidity_pct
        if record.sensor_type == SensorType.HUMIDITY and record.value is not None:
            if record.unit == UnitType.PERCENT:
                return record.value
        if record.sensor_type == SensorType.MULTI and record.value is not None:
            if record.unit == UnitType.PERCENT:
                return record.value
        return None
    
    def _group_by_box_sensor(
        self,
        records: list[SensorRecord],
    ) -> dict[tuple[str, str], list[SensorRecord]]:
        """按箱号和传感器分组"""
        groups: dict[tuple[str, str], list[SensorRecord]] = {}
        
        for record in records:
            key = (record.box_id, record.sensor_id)
            if key not in groups:
                groups[key] = []
            groups[key].append(record)
        
        for key in groups:
            groups[key].sort(key=lambda r: r.timestamp)
        
        return groups
    
    def _detect_temperature_issues(
        self,
        records: list[SensorRecord],
    ) -> list[TemperatureIssue]:
        """检测温度超限问题"""
        issues: list[TemperatureIssue] = []
        grouped = self._group_by_box_sensor(records)
        
        max_temp = self.thresholds.temp_max_celsius
        min_temp = self.thresholds.temp_min_celsius
        duration_threshold = self.thresholds.temp_duration_minutes
        
        for (box_id, sensor_id), group_records in grouped.items():
            valid_records = [
                r for r in group_records
                if self._get_temp_value(r) is not None
            ]
            
            if not valid_records:
                continue
            
            over_periods = self._find_continuous_violations(
                valid_records,
                lambda v: v > max_temp,
                self._get_temp_value,
            )
            under_periods = self._find_continuous_violations(
                valid_records,
                lambda v: v < min_temp,
                self._get_temp_value,
            )
            
            for period in over_periods:
                if period["duration_minutes"] >= duration_threshold:
                    issue = self._create_temp_issue(
                        period,
                        box_id,
                        sensor_id,
                        IssueType.TEMPERATURE_OVER,
                        max_temp,
                        None,
                    )
                    issues.append(issue)
            
            for period in under_periods:
                if period["duration_minutes"] >= duration_threshold:
                    issue = self._create_temp_issue(
                        period,
                        box_id,
                        sensor_id,
                        IssueType.TEMPERATURE_UNDER,
                        None,
                        min_temp,
                    )
                    issues.append(issue)
        
        return issues
    
    def _detect_humidity_issues(
        self,
        records: list[SensorRecord],
    ) -> list[HumidityIssue]:
        """检测湿度超限问题"""
        issues: list[HumidityIssue] = []
        grouped = self._group_by_box_sensor(records)
        
        max_humid = self.thresholds.humidity_max_pct
        min_humid = self.thresholds.humidity_min_pct
        duration_threshold = self.thresholds.humidity_duration_minutes
        
        for (box_id, sensor_id), group_records in grouped.items():
            valid_records = [
                r for r in group_records
                if self._get_humid_value(r) is not None
            ]
            
            if not valid_records:
                continue
            
            over_periods = self._find_continuous_violations(
                valid_records,
                lambda v: v > max_humid,
                self._get_humid_value,
            )
            under_periods = self._find_continuous_violations(
                valid_records,
                lambda v: v < min_humid,
                self._get_humid_value,
            )
            
            for period in over_periods:
                if period["duration_minutes"] >= duration_threshold:
                    issue = self._create_humid_issue(
                        period,
                        box_id,
                        sensor_id,
                        IssueType.HUMIDITY_OVER,
                        max_humid,
                        None,
                    )
                    issues.append(issue)
            
            for period in under_periods:
                if period["duration_minutes"] >= duration_threshold:
                    issue = self._create_humid_issue(
                        period,
                        box_id,
                        sensor_id,
                        IssueType.HUMIDITY_UNDER,
                        None,
                        min_humid,
                    )
                    issues.append(issue)
        
        return issues
    
    def _find_continuous_violations(
        self,
        records: list[SensorRecord],
        violation_check,
        value_extractor,
    ) -> list[dict]:
        """查找连续的超限时段"""
        periods: list[dict] = []
        
        in_violation = False
        start_idx = 0
        values_in_period: list[float] = []
        
        for i, record in enumerate(records):
            value = value_extractor(record)
            if value is None:
                continue
            
            is_violation = violation_check(value)
            
            if is_violation:
                if not in_violation:
                    in_violation = True
                    start_idx = i
                    values_in_period = [value]
                else:
                    values_in_period.append(value)
            else:
                if in_violation:
                    end_idx = i - 1
                    period_records = records[start_idx:end_idx + 1]
                    
                    if period_records:
                        start_time = self._parse_iso_time(period_records[0].timestamp)
                        end_time = self._parse_iso_time(period_records[-1].timestamp)
                        
                        duration_minutes = 0.0
                        if start_time and end_time:
                            duration_minutes = (end_time - start_time).total_seconds() / 60.0
                        
                        period = {
                            "start_time": period_records[0].timestamp,
                            "end_time": period_records[-1].timestamp,
                            "duration_minutes": duration_minutes,
                            "sample_count": len(period_records),
                            "max_value": max(values_in_period),
                            "min_value": min(values_in_period),
                        }
                        periods.append(period)
                    
                    in_violation = False
                    values_in_period = []
        
        if in_violation and start_idx < len(records):
            period_records = records[start_idx:]
            
            start_time = self._parse_iso_time(period_records[0].timestamp)
            end_time = self._parse_iso_time(period_records[-1].timestamp)
            
            duration_minutes = 0.0
            if start_time and end_time:
                duration_minutes = (end_time - start_time).total_seconds() / 60.0
            
            period = {
                "start_time": period_records[0].timestamp,
                "end_time": period_records[-1].timestamp,
                "duration_minutes": duration_minutes,
                "sample_count": len(period_records),
                "max_value": max(values_in_period),
                "min_value": min(values_in_period),
            }
            periods.append(period)
        
        return periods
    
    def _create_temp_issue(
        self,
        period: dict,
        box_id: str,
        sensor_id: str,
        issue_type: IssueType,
        threshold_max: Optional[float],
        threshold_min: Optional[float],
    ) -> TemperatureIssue:
        """创建温度问题"""
        if issue_type == IssueType.TEMPERATURE_OVER:
            severity = self._calculate_severity(
                period["max_value"] - (threshold_max or 0),
                5.0,
                period["duration_minutes"],
            )
            description = (
                f"展箱 {box_id} 温度超限: 最高 {period['max_value']:.1f}°C "
                f"(阈值: {threshold_max}°C), 持续 {period['duration_minutes']:.1f}分钟"
            )
        else:
            severity = self._calculate_severity(
                (threshold_min or 0) - period["min_value"],
                5.0,
                period["duration_minutes"],
            )
            description = (
                f"展箱 {box_id} 温度过低: 最低 {period['min_value']:.1f}°C "
                f"(阈值: {threshold_min}°C), 持续 {period['duration_minutes']:.1f}分钟"
            )
        
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        return TemperatureIssue(
            issue_id=issue_id,
            issue_type=issue_type,
            severity=severity,
            box_id=box_id,
            sensor_id=sensor_id,
            start_time=period["start_time"],
            end_time=period["end_time"],
            description=description,
            detected_at=now,
            source_data={
                "max_value": period["max_value"],
                "min_value": period["min_value"],
                "duration_minutes": period["duration_minutes"],
                "sample_count": period["sample_count"],
            },
            max_value_celsius=period["max_value"] if issue_type == IssueType.TEMPERATURE_OVER else None,
            min_value_celsius=period["min_value"] if issue_type == IssueType.TEMPERATURE_UNDER else None,
            threshold_max_celsius=threshold_max,
            threshold_min_celsius=threshold_min,
            duration_minutes=period["duration_minutes"],
            sample_count=period["sample_count"],
        )
    
    def _create_humid_issue(
        self,
        period: dict,
        box_id: str,
        sensor_id: str,
        issue_type: IssueType,
        threshold_max: Optional[float],
        threshold_min: Optional[float],
    ) -> HumidityIssue:
        """创建湿度问题"""
        if issue_type == IssueType.HUMIDITY_OVER:
            severity = self._calculate_severity(
                period["max_value"] - (threshold_max or 0),
                15.0,
                period["duration_minutes"],
            )
            description = (
                f"展箱 {box_id} 湿度过高: 最高 {period['max_value']:.1f}% "
                f"(阈值: {threshold_max}%), 持续 {period['duration_minutes']:.1f}分钟"
            )
        else:
            severity = self._calculate_severity(
                (threshold_min or 0) - period["min_value"],
                15.0,
                period["duration_minutes"],
            )
            description = (
                f"展箱 {box_id} 湿度过低: 最低 {period['min_value']:.1f}% "
                f"(阈值: {threshold_min}%), 持续 {period['duration_minutes']:.1f}分钟"
            )
        
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        return HumidityIssue(
            issue_id=issue_id,
            issue_type=issue_type,
            severity=severity,
            box_id=box_id,
            sensor_id=sensor_id,
            start_time=period["start_time"],
            end_time=period["end_time"],
            description=description,
            detected_at=now,
            source_data={
                "max_value": period["max_value"],
                "min_value": period["min_value"],
                "duration_minutes": period["duration_minutes"],
                "sample_count": period["sample_count"],
            },
            max_value_pct=period["max_value"] if issue_type == IssueType.HUMIDITY_OVER else None,
            min_value_pct=period["min_value"] if issue_type == IssueType.HUMIDITY_UNDER else None,
            threshold_max_pct=threshold_max,
            threshold_min_pct=threshold_min,
            duration_minutes=period["duration_minutes"],
            sample_count=period["sample_count"],
        )
    
    def _calculate_severity(
        self,
        deviation: float,
        critical_deviation: float,
        duration_minutes: float,
    ) -> IssueSeverity:
        """根据偏差和持续时间计算严重程度"""
        if deviation >= critical_deviation * 2 or duration_minutes >= 60:
            return IssueSeverity.CRITICAL
        elif deviation >= critical_deviation or duration_minutes >= 30:
            return IssueSeverity.HIGH
        elif deviation >= critical_deviation / 2 or duration_minutes >= 15:
            return IssueSeverity.MEDIUM
        else:
            return IssueSeverity.LOW
