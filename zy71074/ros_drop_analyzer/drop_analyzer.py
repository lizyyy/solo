import numpy as np
from typing import Dict, List
from datetime import datetime
from collections import defaultdict

from rich.console import Console

from .config import AnalyzerConfig
from .types import (
    FrameRecord,
    DropGap,
    SensorAnalysisResult,
    AnalysisReport,
    SensorType,
)

console = Console()


class DropAnalyzer:
    def __init__(self, config: AnalyzerConfig):
        self.config = config

    def analyze(self, sensor_data: Dict[str, List[FrameRecord]]) -> AnalysisReport:
        report = AnalysisReport(
            bag_file=self.config.input_file,
            analysis_time=datetime.now(),
            start_time=float('inf'),
            end_time=float('-inf'),
            total_duration=0.0,
        )

        all_start_times = []
        all_end_times = []

        for sensor_name, frames in sensor_data.items():
            if not frames:
                continue

            result = self._analyze_sensor(sensor_name, frames)
            report.sensors[sensor_name] = result

            all_start_times.append(result.start_time)
            all_end_times.append(result.end_time)

        if all_start_times and all_end_times:
            report.start_time = min(all_start_times)
            report.end_time = max(all_end_times)
            report.total_duration = report.end_time - report.start_time

        total_expected = sum(
            s.expected_fps * s.duration for s in report.sensors.values() if s.duration > 0
        )
        total_actual = sum(s.total_frames for s in report.sensors.values())

        if total_expected > 0:
            report.overall_drop_rate = 1.0 - (total_actual / total_expected)

        self._add_warnings(report)

        return report

    def _analyze_sensor(
        self, sensor_name: str, frames: List[FrameRecord]
    ) -> SensorAnalysisResult:
        frames.sort(key=lambda f: f.timestamp)

        sensor_type = frames[0].sensor_type
        threshold = self.config.thresholds.get(sensor_type, 0.1)
        expected_fps = self.config.expected_fps.get(sensor_type, 10.0)

        start_time = frames[0].timestamp
        end_time = frames[-1].timestamp
        duration = end_time - start_time
        total_frames = len(frames)

        actual_fps = total_frames / duration if duration > 0 else 0

        result = SensorAnalysisResult(
            sensor_name=sensor_name,
            sensor_type=sensor_type,
            total_frames=total_frames,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            expected_fps=expected_fps,
            actual_fps=actual_fps,
        )

        frame_drops = []
        total_drop_duration = 0.0
        total_missing_frames = 0
        max_gap_duration = 0.0

        expected_interval = 1.0 / expected_fps if expected_fps > 0 else 0.1

        for i in range(1, len(frames)):
            prev_frame = frames[i - 1]
            curr_frame = frames[i]

            time_diff = curr_frame.timestamp - prev_frame.timestamp

            if self.config.detect_timestamp_rollback and time_diff < 0:
                result.timestamp_issues.append({
                    'type': 'rollback',
                    'time': curr_frame.timestamp,
                    'prev_time': prev_frame.timestamp,
                    'diff': time_diff,
                    'prev_line': prev_frame.line_number,
                    'curr_line': curr_frame.line_number,
                    'description': f'时间戳回退: {time_diff:.6f}s',
                })
                continue

            if time_diff > threshold:
                severity = self._get_severity(time_diff, threshold)

                expected_frames_in_gap = int(time_diff / expected_interval)
                missing_frames = max(0, expected_frames_in_gap - 1)

                gap = DropGap(
                    start_time=prev_frame.timestamp,
                    end_time=curr_frame.timestamp,
                    duration=time_diff,
                    expected_frames=expected_frames_in_gap,
                    missing_frames=missing_frames,
                    severity=severity,
                )

                frame_drops.append(gap)
                total_drop_duration += time_diff
                total_missing_frames += missing_frames
                max_gap_duration = max(max_gap_duration, time_diff)

        result.frame_drops = frame_drops
        result.total_drop_duration = total_drop_duration
        result.total_missing_frames = total_missing_frames
        result.max_gap_duration = max_gap_duration

        if self.config.merge_related_topics:
            topic_changes = self._detect_topic_changes(frames)
            result.topic_changes = topic_changes

        invalid_records = [
            f for f in frames if f.timestamp <= 0 or not np.isfinite(f.timestamp)
        ]
        result.invalid_records = [
            {
                'timestamp': f.timestamp,
                'topic': f.topic,
                'line_number': f.line_number,
                'raw_content': f.raw_content,
            }
            for f in invalid_records
        ]

        return result

    def _get_severity(self, duration: float, threshold: float) -> str:
        ratio = duration / threshold

        if ratio >= 10:
            return 'critical'
        elif ratio >= 5:
            return 'high'
        elif ratio >= 2:
            return 'medium'
        else:
            return 'low'

    def _detect_topic_changes(self, frames: List[FrameRecord]) -> List[Dict]:
        changes = []
        if len(frames) < 2:
            return changes

        prev_topic = frames[0].topic
        for i, frame in enumerate(frames[1:], 1):
            if frame.topic != prev_topic:
                changes.append({
                    'time': frame.timestamp,
                    'from_topic': prev_topic,
                    'to_topic': frame.topic,
                    'frame_index': i,
                    'line_number': frame.line_number,
                })
                prev_topic = frame.topic

        return changes

    def _add_warnings(self, report: AnalysisReport):
        for sensor_name, result in report.sensors.items():
            if result.max_gap_duration >= 1.0:
                report.warnings.append(
                    f'{sensor_name}: 检测到长达 {result.max_gap_duration:.2f}s 的长时间空窗'
                )

            if result.timestamp_issues:
                rollback_count = sum(
                    1 for issue in result.timestamp_issues
                    if issue['type'] == 'rollback'
                )
                if rollback_count > 0:
                    report.warnings.append(
                        f'{sensor_name}: 检测到 {rollback_count} 次时间戳回退'
                    )

            if result.topic_changes:
                report.warnings.append(
                    f'{sensor_name}: 检测到 {len(result.topic_changes)} 次 topic 变化'
                )

            if result.invalid_records:
                report.warnings.append(
                    f'{sensor_name}: 存在 {len(result.invalid_records)} 条无效记录'
                )

            drop_rate = result.total_missing_frames / result.total_frames if result.total_frames > 0 else 0
            if drop_rate > 0.1:
                report.warnings.append(
                    f'{sensor_name}: 掉帧率较高 ({drop_rate:.1%})'
                )
