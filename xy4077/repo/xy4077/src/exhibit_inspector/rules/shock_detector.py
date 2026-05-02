"""冲击峰值检测器"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from ..models import (
    SensorRecord,
    SensorType,
    UnitType,
    ThresholdSettings,
    IssueType,
    IssueSeverity,
    ShockPeakIssue,
)
from .base import BaseRule, RuleResult


@dataclass
class ShockPeakResult:
    """冲击峰值检测结果"""
    box_id: str
    sensor_id: str
    peak_time: str
    peak_value_g: float
    threshold_g: float
    duration_seconds: float = 0.0
    sample_count: int = 1
    is_critical: bool = False
    axis: Optional[str] = None


class ShockDetector(BaseRule[list[SensorRecord]]):
    """冲击峰值检测器"""
    
    def __init__(self, thresholds: ThresholdSettings):
        super().__init__("shock_detector")
        self.thresholds = thresholds
    
    def execute(self, records: list[SensorRecord]) -> RuleResult:
        """执行冲击峰值检测"""
        result = RuleResult(
            rule_name=self.name,
            executed_at=datetime.now().isoformat(),
        )
        
        shock_records = [r for r in records if self._has_shock_data(r)]
        
        if not shock_records:
            result.stats["warning"] = "未找到冲击传感器记录"
            return result
        
        grouped = self._group_by_box_sensor(shock_records)
        
        total_peaks = 0
        critical_peaks = 0
        
        for (box_id, sensor_id), group_records in grouped.items():
            peaks = self._detect_peaks(group_records)
            
            for peak in peaks:
                issue = self._create_shock_issue(peak)
                result.issues.append(issue)
                total_peaks += 1
                if peak.is_critical:
                    critical_peaks += 1
        
        result.stats = {
            "total_shock_records": len(shock_records),
            "total_peaks_detected": total_peaks,
            "critical_peaks": critical_peaks,
            "threshold_g": self.thresholds.shock_threshold_g,
        }
        
        return result
    
    def _has_shock_data(self, record: SensorRecord) -> bool:
        """检查记录是否包含冲击数据"""
        if record.sensor_type in [SensorType.SHOCK, SensorType.MULTI]:
            if any(v is not None for v in [
                record.x_accel_g, record.y_accel_g, record.z_accel_g, record.combined_accel_g
            ]):
                return True
            if record.unit == UnitType.G and record.value is not None:
                return True
        return False
    
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
    
    def _extract_accel_values(self, records: list[SensorRecord]) -> list[tuple[str, float, str]]:
        """提取所有加速度值，返回 (timestamp, value, axis) 列表"""
        values = []
        for record in records:
            if record.x_accel_g is not None:
                values.append((record.timestamp, abs(record.x_accel_g), "X"))
            if record.y_accel_g is not None:
                values.append((record.timestamp, abs(record.y_accel_g), "Y"))
            if record.z_accel_g is not None:
                values.append((record.timestamp, abs(record.z_accel_g), "Z"))
            if record.combined_accel_g is not None:
                values.append((record.timestamp, abs(record.combined_accel_g), "combined"))
            if record.unit == UnitType.G and record.value is not None:
                values.append((record.timestamp, abs(record.value), "single"))
        return values
    
    def _detect_peaks(self, records: list[SensorRecord]) -> list[ShockPeakResult]:
        """检测冲击峰值"""
        peaks: list[ShockPeakResult] = []
        threshold = self.thresholds.shock_threshold_g
        
        accel_values = self._extract_accel_values(records)
        if not accel_values:
            return peaks
        
        accel_values.sort(key=lambda x: x[0])
        
        in_peak = False
        peak_start_idx = 0
        current_peak_value = 0.0
        current_peak_axis = None
        
        for i, (timestamp, value, axis) in enumerate(accel_values):
            if value > threshold:
                if not in_peak:
                    in_peak = True
                    peak_start_idx = i
                    current_peak_value = value
                    current_peak_axis = axis
                else:
                    if value > current_peak_value:
                        current_peak_value = value
                        current_peak_axis = axis
            else:
                if in_peak:
                    peak_end_idx = i - 1
                    
                    if peak_start_idx <= peak_end_idx:
                        peak_records = accel_values[peak_start_idx:peak_end_idx + 1]
                        
                        max_value = max(peak_records, key=lambda r: r[1])
                        
                        start_time = self._parse_iso_time(peak_records[0][0])
                        end_time = self._parse_iso_time(peak_records[-1][0])
                        
                        duration_seconds = 0.0
                        if start_time and end_time:
                            duration_seconds = (end_time - start_time).total_seconds()
                        
                        severity_threshold = threshold * 2.0
                        is_critical = current_peak_value > severity_threshold
                        
                        peak = ShockPeakResult(
                            box_id=records[0].box_id,
                            sensor_id=records[0].sensor_id,
                            peak_time=max_value[0],
                            peak_value_g=current_peak_value,
                            threshold_g=threshold,
                            duration_seconds=duration_seconds,
                            sample_count=len(peak_records),
                            is_critical=is_critical,
                            axis=current_peak_axis,
                        )
                        peaks.append(peak)
                    
                    in_peak = False
                    current_peak_value = 0.0
                    current_peak_axis = None
        
        if in_peak and peak_start_idx < len(accel_values):
            peak_records = accel_values[peak_start_idx:]
            max_value = max(peak_records, key=lambda r: r[1])
            
            start_time = self._parse_iso_time(peak_records[0][0])
            end_time = self._parse_iso_time(peak_records[-1][0])
            
            duration_seconds = 0.0
            if start_time and end_time:
                duration_seconds = (end_time - start_time).total_seconds()
            
            severity_threshold = threshold * 2.0
            is_critical = current_peak_value > severity_threshold
            
            peak = ShockPeakResult(
                box_id=records[0].box_id,
                sensor_id=records[0].sensor_id,
                peak_time=max_value[0],
                peak_value_g=current_peak_value,
                threshold_g=threshold,
                duration_seconds=duration_seconds,
                sample_count=len(peak_records),
                is_critical=is_critical,
                axis=current_peak_axis,
            )
            peaks.append(peak)
        
        return peaks
    
    def _create_shock_issue(self, peak: ShockPeakResult) -> ShockPeakIssue:
        """创建冲击峰值问题"""
        axis_info = f" ({peak.axis}轴)" if peak.axis else ""
        
        if peak.is_critical:
            severity = IssueSeverity.CRITICAL
            description = (
                f"展箱 {peak.box_id} 检测到严重冲击峰值{axis_info}: "
                f"{peak.peak_value_g:.2f}g (阈值: {peak.threshold_g}g), "
                f"持续 {peak.duration_seconds:.1f}秒"
            )
        else:
            severity = IssueSeverity.HIGH
            description = (
                f"展箱 {peak.box_id} 检测到冲击峰值{axis_info}: "
                f"{peak.peak_value_g:.2f}g (阈值: {peak.threshold_g}g)"
            )
        
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        return ShockPeakIssue(
            issue_id=issue_id,
            severity=severity,
            box_id=peak.box_id,
            sensor_id=peak.sensor_id,
            start_time=peak.peak_time,
            end_time=peak.peak_time,
            description=description,
            detected_at=now,
            source_data={
                "peak_value_g": peak.peak_value_g,
                "threshold_g": peak.threshold_g,
                "duration_seconds": peak.duration_seconds,
                "sample_count": peak.sample_count,
                "axis": peak.axis,
            },
            peak_value_g=peak.peak_value_g,
            threshold_g=peak.threshold_g,
            duration_seconds=peak.duration_seconds if peak.duration_seconds > 0 else None,
            sample_count=peak.sample_count,
        )
