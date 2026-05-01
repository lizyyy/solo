"""时间轴校验器"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from ..models import SensorRecord, ThresholdSettings


@dataclass
class TimeGap:
    """时间缺口"""
    start_time: str
    end_time: str
    duration_minutes: float
    expected_samples: int
    missing_samples: int


@dataclass
class MissingSample:
    """缺采样记录"""
    gap_start: str
    gap_end: str
    gap_duration_minutes: float
    missing_count: int
    is_continuous: bool = False


@dataclass
class ValidationResult:
    """校验结果"""
    box_id: str
    sensor_id: str
    time_gaps: list[TimeGap] = field(default_factory=list)
    missing_samples: list[MissingSample] = field(default_factory=list)
    total_records: int = 0
    total_gaps: int = 0
    total_missing_samples: int = 0
    max_gap_minutes: float = 0.0
    is_valid: bool = True


class TimelineValidator:
    """时间轴校验器"""
    
    def __init__(self, thresholds: ThresholdSettings):
        self.thresholds = thresholds
    
    def validate_timeline(
        self,
        records: list[SensorRecord],
    ) -> dict[tuple[str, str], ValidationResult]:
        """
        校验传感器记录的时间连续性
        
        Args:
            records: 传感器记录列表
            
        Returns:
            按(box_id, sensor_id)分组的校验结果
        """
        grouped_records = self._group_records(records)
        results = {}
        
        for key, group_records in grouped_records.items():
            box_id, sensor_id = key
            result = self._validate_group(group_records, box_id, sensor_id)
            results[key] = result
        
        return results
    
    def _group_records(
        self,
        records: list[SensorRecord],
    ) -> dict[tuple[str, str], list[SensorRecord]]:
        """按(box_id, sensor_id)分组并排序"""
        groups: dict[tuple[str, str], list[SensorRecord]] = {}
        
        for record in records:
            key = (record.box_id, record.sensor_id)
            if key not in groups:
                groups[key] = []
            groups[key].append(record)
        
        for key in groups:
            groups[key].sort(key=lambda r: r.timestamp)
        
        return groups
    
    def _validate_group(
        self,
        records: list[SensorRecord],
        box_id: str,
        sensor_id: str,
    ) -> ValidationResult:
        """校验单个传感器的时间连续性"""
        result = ValidationResult(
            box_id=box_id,
            sensor_id=sensor_id,
            total_records=len(records),
        )
        
        if len(records) < 2:
            return result
        
        sample_interval = timedelta(seconds=self.thresholds.sample_interval_seconds)
        max_gap_tolerance = sample_interval * self.thresholds.max_missing_samples
        
        for i in range(len(records) - 1):
            current = records[i]
            next_record = records[i + 1]
            
            current_time = self._parse_iso_time(current.timestamp)
            next_time = self._parse_iso_time(next_record.timestamp)
            
            if current_time is None or next_time is None:
                continue
            
            actual_gap = next_time - current_time
            
            if actual_gap > sample_interval + timedelta(seconds=1):
                expected_samples = int(actual_gap / sample_interval)
                missing_samples = expected_samples - 1
                
                if missing_samples > 0:
                    time_gap = TimeGap(
                        start_time=current.timestamp,
                        end_time=next_record.timestamp,
                        duration_minutes=actual_gap.total_seconds() / 60.0,
                        expected_samples=expected_samples,
                        missing_samples=missing_samples,
                    )
                    result.time_gaps.append(time_gap)
                    result.total_gaps += 1
                    result.total_missing_samples += missing_samples
                    
                    if time_gap.duration_minutes > result.max_gap_minutes:
                        result.max_gap_minutes = time_gap.duration_minutes
                    
                    if actual_gap > max_gap_tolerance:
                        missing_sample = MissingSample(
                            gap_start=current.timestamp,
                            gap_end=next_record.timestamp,
                            gap_duration_minutes=actual_gap.total_seconds() / 60.0,
                            missing_count=missing_samples,
                            is_continuous=missing_samples > self.thresholds.max_missing_samples,
                        )
                        result.missing_samples.append(missing_sample)
                        result.is_valid = False
        
        return result
    
    def _parse_iso_time(self, time_str: str) -> Optional[datetime]:
        """解析ISO格式时间字符串"""
        try:
            if "T" in time_str:
                return datetime.fromisoformat(time_str)
            else:
                return datetime.fromisoformat(time_str.replace(" ", "T"))
        except (ValueError, TypeError):
            return None
    
    def validate_coverage(
        self,
        records: list[SensorRecord],
        start_time: str,
        end_time: str,
    ) -> dict[str, dict]:
        """
        校验传感器记录是否覆盖指定时间范围
        
        Args:
            records: 传感器记录列表
            start_time: 期望开始时间
            end_time: 期望结束时间
            
        Returns:
            每个传感器的覆盖情况
        """
        groups = self._group_records(records)
        expected_start = self._parse_iso_time(start_time)
        expected_end = self._parse_iso_time(end_time)
        
        coverage_report = {}
        
        if expected_start is None or expected_end is None:
            return coverage_report
        
        for (box_id, sensor_id), group_records in groups.items():
            if not group_records:
                continue
            
            actual_start = self._parse_iso_time(group_records[0].timestamp)
            actual_end = self._parse_iso_time(group_records[-1].timestamp)
            
            if actual_start is None or actual_end is None:
                continue
            
            key = f"{box_id}:{sensor_id}"
            
            coverage_report[key] = {
                "box_id": box_id,
                "sensor_id": sensor_id,
                "expected_start": start_time,
                "expected_end": end_time,
                "actual_start": group_records[0].timestamp,
                "actual_end": group_records[-1].timestamp,
                "covers_start": actual_start <= expected_start,
                "covers_end": actual_end >= expected_end,
                "start_gap_minutes": max(0, (actual_start - expected_start).total_seconds() / 60.0),
                "end_gap_minutes": max(0, (expected_end - actual_end).total_seconds() / 60.0),
            }
        
        return coverage_report
