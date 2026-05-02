"""Rule engine for detecting offline, reverse connection, temperature rise and capacity anomalies."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Union

import numpy as np


class IssueType(Enum):
    OFFLINE = "offline"
    REVERSE = "reverse"
    TEMP_RISE = "temperature_rise"
    MISSING_SAMPLE = "missing_sample"


@dataclass
class Issue:
    channel: int
    issue_type: IssueType
    step: Optional[int]
    timestamp: Optional[datetime]
    value: Optional[float]
    threshold: Optional[float]
    message: str


@dataclass
class StepSegment:
    step_index: int
    step_name: str
    start_time: datetime
    end_time: datetime
    start_idx: int
    end_idx: int


class Segmenter:
    def segment_by_steps(
        self, data: list[dict[str, Any]], recipe: dict[str, Any], first_timestamp: datetime
    ) -> list[StepSegment]:
        stages = recipe.get("stages", [])
        if not stages:
            return [StepSegment(0, "default", data[0]["timestamp"], data[-1]["timestamp"], 0, len(data) - 1)]

        segments = []
        step_count = len(stages)
        total_points = len(data)
        points_per_step = max(1, total_points // step_count)

        for i, stage in enumerate(stages):
            start_idx = i * points_per_step
            end_idx = (i + 1) * points_per_step if i < step_count - 1 else total_points - 1
            start_time = data[start_idx]["timestamp"]
            end_time = data[end_idx]["timestamp"]
            segments.append(StepSegment(i, stage.get("name", f"step_{i}"), start_time, end_time, start_idx, end_idx))

        return segments


class RuleEngine:
    def __init__(self, recipe: dict[str, Any]):
        self.recipe = recipe
        self.seg = Segmenter()
        self.temp_threshold = recipe.get("temperature_threshold", {})
        self.voltage_threshold = recipe.get("voltage_threshold", {})
        self.current_threshold = recipe.get("current_threshold", {})

    def check_offline(self, channel: int, data: list[dict[str, Any]], interval: int) -> list[Issue]:
        issues = []
        if len(data) < 2:
            return issues
        for i in range(1, len(data)):
            diff = (data[i]["timestamp"] - data[i - 1]["timestamp"]).total_seconds()
            if diff > interval * 3:
                issues.append(Issue(
                    channel=channel,
                    issue_type=IssueType.OFFLINE,
                    step=None,
                    timestamp=data[i]["timestamp"],
                    value=diff,
                    threshold=interval * 3,
                    message=f"Offline detected: gap of {diff:.1f}s at index {i}",
                ))
        return issues

    def check_reverse(self, channel: int, data: list[dict[str, Any]]) -> list[Issue]:
        issues = []
        voltage = [d["voltage"] for d in data]
        if len(voltage) < 2:
            return issues
        drops = sum(1 for i in range(1, len(voltage)) if voltage[i] < voltage[i - 1] - 0.5)
        if drops > len(voltage) * 0.3:
            issues.append(Issue(
                channel=channel,
                issue_type=IssueType.REVERSE,
                step=None,
                timestamp=data[0]["timestamp"],
                value=drops,
                threshold=len(voltage) * 0.3,
                message=f"Reverse connection suspected: {drops} voltage drops > 0.5V",
            ))
        return issues

    def check_temperature_rise(self, channel: int, data: list[dict[str, Any]], segment: Optional[StepSegment] = None) -> list[Issue]:
        issues = []
        temps = [d["temperature"] for d in data]
        if not temps:
            return issues
        max_temp = max(temps)
        min_temp = min(temps)
        rise = max_temp - min_temp
        threshold = self.temp_threshold.get("max_rise_per_step", 15.0)
        if rise > threshold:
            issues.append(Issue(
                channel=channel,
                issue_type=IssueType.TEMP_RISE,
                step=segment.step_index if segment else None,
                timestamp=data[temps.index(max_temp)]["timestamp"],
                value=rise,
                threshold=threshold,
                message=f"Temperature rise {rise:.1f}°C exceeds threshold {threshold}°C",
            ))
        rate_threshold = self.temp_threshold.get("max_rate_C_per_min", 2.0)
        for i in range(1, len(data)):
            dt = (data[i]["timestamp"] - data[i - 1]["timestamp"]).total_seconds() / 60.0
            if dt > 0:
                drate = abs(data[i]["temperature"] - data[i - 1]["temperature"]) / dt
                if drate > rate_threshold:
                    issues.append(Issue(
                        channel=channel,
                        issue_type=IssueType.TEMP_RISE,
                        step=segment.step_index if segment else None,
                        timestamp=data[i]["timestamp"],
                        value=drate,
                        threshold=rate_threshold,
                        message=f"Temperature change rate {drate:.2f}°C/min exceeds {rate_threshold}°C/min",
                    ))
        return issues

    def check_missing_samples(self, channel: int, data: list[dict[str, Any]], interval: int) -> list[Issue]:
        issues = []
        for i in range(1, len(data)):
            diff = (data[i]["timestamp"] - data[i - 1]["timestamp"]).total_seconds()
            expected = interval
            if diff > expected * 2:
                missing = int(diff / expected) - 1
                issues.append(Issue(
                    channel=channel,
                    issue_type=IssueType.MISSING_SAMPLE,
                    step=None,
                    timestamp=data[i]["timestamp"],
                    value=missing,
                    threshold=0,
                    message=f"Missing ~{missing} sample points (gap {diff:.0f}s, expected {expected}s)",
                ))
        return issues

    def run_all(self, channel: int, data: list[dict[str, Any]], first_timestamp: datetime) -> list[Issue]:
        interval = self.recipe.get("sampling_interval", 10)
        all_issues = []
        all_issues.extend(self.check_offline(channel, data, interval))
        all_issues.extend(self.check_reverse(channel, data))
        all_issues.extend(self.check_temperature_rise(channel, data, None))
        all_issues.extend(self.check_missing_samples(channel, data, interval))
        return all_issues
