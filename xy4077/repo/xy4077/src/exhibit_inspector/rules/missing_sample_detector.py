"""缺采样检测器"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from ..models import (
    SensorRecord,
    IssueType,
    IssueSeverity,
    MissingSampleIssue,
)
from .base import BaseRule, RuleResult


@dataclass
class SampleGap:
    """采样缺口"""
    box_id: str
    sensor_id: str
    gap_start_time: str
    gap_end_time: str
    gap_duration_minutes: float
    expected_interval_minutes: float
    expected_sample_count: int
    actual_sample_count: int


class MissingSampleDetector(BaseRule[list[SensorRecord]]):
    """缺采样检测器"""
    
    def __init__(
        self,
        expected_interval_minutes: float = 5.0,
        max_gap_minutes: float = 15.0,
    ):
        super().__init__("missing_sample_detector")
        self.expected_interval_minutes = expected_interval_minutes
        self.max_gap_minutes = max_gap_minutes
    
    def execute(self, records: list[SensorRecord]) -> RuleResult:
        """执行缺采样检测"""
        result = RuleResult(
            rule_name=self.name,
            executed_at=datetime.now().isoformat(),
        )
        
        if not records:
            result.stats["warning"] = "未找到传感器记录"
            return result
        
        grouped = self._group_by_box_sensor(records)
        
        total_gaps = 0
        critical_gaps = 0
        
        for (box_id, sensor_id), group_records in grouped.items():
            gaps = self._detect_gaps(group_records, box_id, sensor_id)
            
            for gap in gaps:
                issue = self._create_missing_sample_issue(gap)
                result.issues.append(issue)
                total_gaps += 1
                if gap.gap_duration_minutes >= self.max_gap_minutes * 2:
                    critical_gaps += 1
        
        result.stats = {
            "total_records": len(records),
            "total_sensors": len(grouped),
            "total_gaps": total_gaps,
            "critical_gaps": critical_gaps,
            "expected_interval_minutes": self.expected_interval_minutes,
            "max_gap_minutes": self.max_gap_minutes,
        }
        
        return result
    
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
    
    def _detect_gaps(
        self,
        records: list[SensorRecord],
        box_id: str,
        sensor_id: str,
    ) -> list[SampleGap]:
        """检测采样缺口"""
        gaps: list[SampleGap] = []
        
        if len(records) < 2:
            return gaps
        
        for i in range(len(records) - 1):
            current = records[i]
            next_record = records[i + 1]
            
            current_time = self._parse_iso_time(current.timestamp)
            next_time = self._parse_iso_time(next_record.timestamp)
            
            if current_time is None or next_time is None:
                continue
            
            actual_gap_minutes = (next_time - current_time).total_seconds() / 60.0
            
            if actual_gap_minutes > self.max_gap_minutes:
                expected_samples = int(actual_gap_minutes / self.expected_interval_minutes)
                
                gap = SampleGap(
                    box_id=box_id,
                    sensor_id=sensor_id,
                    gap_start_time=current.timestamp,
                    gap_end_time=next_record.timestamp,
                    gap_duration_minutes=actual_gap_minutes,
                    expected_interval_minutes=self.expected_interval_minutes,
                    expected_sample_count=expected_samples,
                    actual_sample_count=0,
                )
                gaps.append(gap)
        
        return gaps
    
    def _create_missing_sample_issue(self, gap: SampleGap) -> MissingSampleIssue:
        """创建缺采样问题"""
        if gap.gap_duration_minutes >= self.max_gap_minutes * 2:
            severity = IssueSeverity.CRITICAL
            description = (
                f"展箱 {gap.box_id} 传感器 {gap.sensor_id} 检测到严重采样缺口: "
                f"{gap.gap_duration_minutes:.1f}分钟 (最大允许: {self.max_gap_minutes}分钟)"
            )
        elif gap.gap_duration_minutes >= self.max_gap_minutes:
            severity = IssueSeverity.HIGH
            description = (
                f"展箱 {gap.box_id} 传感器 {gap.sensor_id} 检测到采样缺口: "
                f"{gap.gap_duration_minutes:.1f}分钟 (最大允许: {self.max_gap_minutes}分钟)"
            )
        else:
            severity = IssueSeverity.MEDIUM
            description = (
                f"展箱 {gap.box_id} 传感器 {gap.sensor_id} 检测到采样间隔异常: "
                f"{gap.gap_duration_minutes:.1f}分钟 (预期: {self.expected_interval_minutes}分钟)"
            )
        
        issue_id = self._generate_issue_id()
        now = datetime.now().isoformat()
        
        missing_count = max(0, int(gap.gap_duration_minutes / self.expected_interval_minutes) - 1)
        
        return MissingSampleIssue(
            issue_id=issue_id,
            severity=severity,
            box_id=gap.box_id,
            sensor_id=gap.sensor_id,
            start_time=gap.gap_start_time,
            end_time=gap.gap_end_time,
            description=description,
            detected_at=now,
            source_data={
                "gap_duration_minutes": gap.gap_duration_minutes,
                "expected_interval_minutes": gap.expected_interval_minutes,
                "max_gap_minutes": self.max_gap_minutes,
            },
            gap_start_time=gap.gap_start_time,
            gap_end_time=gap.gap_end_time,
            gap_duration_minutes=gap.gap_duration_minutes,
            expected_sample_count=gap.expected_sample_count,
            actual_sample_count=gap.actual_sample_count,
            missing_count=missing_count,
        )
    
    def _parse_iso_time(self, time_str: str) -> Optional[datetime]:
        """解析ISO格式时间字符串"""
        try:
            if "T" in time_str:
                return datetime.fromisoformat(time_str)
            else:
                return datetime.fromisoformat(time_str.replace(" ", "T"))
        except (ValueError, TypeError):
            return None
