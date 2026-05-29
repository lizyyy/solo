from datetime import datetime, timedelta
from typing import List, Tuple, Optional, Dict, Any
from collections import defaultdict
import math

from ..models.database import QueueMetrics
from ..models.enums import EdgeCaseType
from ..models.schemas import QueueMetricsCreate, ExplainableScore


class MetricAlignmentService:

    @staticmethod
    def _calculate_time_diff(metrics: List[QueueMetrics]) -> List[Tuple[int, int]]:
        gaps = []
        for i in range(1, len(metrics)):
            prev = metrics[i - 1].timestamp
            curr = metrics[i].timestamp
            diff_seconds = abs((curr - prev).total_seconds())
            gaps.append((i - 1, diff_seconds))
        return gaps

    @staticmethod
    def detect_time_window_misalign(
        metrics: List[QueueMetrics],
        expected_interval_seconds: int = 60
    ) -> Tuple[bool, List[ExplainableScore], List[Dict[str, Any]]]:
        if len(metrics) < 2:
            return False, [], []

        gaps = MetricAlignmentService._calculate_time_diff(metrics)
        detected = False
        scores = []
        evidence = []

        for idx, diff in gaps:
            tolerance = expected_interval_seconds * 0.5
            if abs(diff - expected_interval_seconds) > tolerance:
                detected = True
                ratio = diff / expected_interval_seconds

                score = ExplainableScore(
                    metric_name=f"time_window_gap_at_{idx}",
                    value=diff,
                    threshold=expected_interval_seconds,
                    explanation=(
                        f"时间窗错位：第{idx + 1}个与第{idx + 2}个数据点之间"
                        f"间隔{diff:.0f}秒，预期{expected_interval_seconds}秒"
                        f"（偏差{abs(diff - expected_interval_seconds):.0f}秒，"
                        f"约为{ratio:.1f}倍）"
                    ),
                    supporting_evidence=[
                        {
                            "metric_index": idx,
                            "prev_timestamp": metrics[idx].timestamp.isoformat(),
                            "curr_timestamp": metrics[idx + 1].timestamp.isoformat(),
                            "actual_gap_seconds": diff,
                            "expected_gap_seconds": expected_interval_seconds,
                            "deviation_seconds": abs(diff - expected_interval_seconds)
                        }
                    ],
                    formula_used=f"gap = |t{idx+2} - t{idx+1}|, threshold = {expected_interval_seconds}s"
                )
                scores.append(score)
                evidence.append(score.supporting_evidence[0])

        return detected, scores, evidence

    @staticmethod
    def align_metrics_to_uniform_window(
        metrics: List[QueueMetrics],
        target_interval_seconds: int = 60
    ) -> List[Dict[str, Any]]:
        if not metrics:
            return []

        sorted_metrics = sorted(metrics, key=lambda m: m.timestamp)
        start_time = sorted_metrics[0].timestamp
        end_time = sorted_metrics[-1].timestamp

        aligned = []
        current_time = start_time
        metric_idx = 0

        while current_time <= end_time:
            window_start = current_time
            window_end = current_time + timedelta(seconds=target_interval_seconds)

            window_metrics = []
            while (metric_idx < len(sorted_metrics) and
                   sorted_metrics[metric_idx].timestamp < window_end):
                window_metrics.append(sorted_metrics[metric_idx])
                metric_idx += 1

            if window_metrics:
                avg_production = sum(m.production_rate for m in window_metrics) / len(window_metrics)
                avg_consumption = sum(m.consumption_rate for m in window_metrics) / len(window_metrics)
                sum_backlog = sum(m.backlog_count for m in window_metrics)
                sum_dead_letter = sum(m.dead_letter_count for m in window_metrics)
                avg_consumers = sum(m.consumer_count for m in window_metrics) / len(window_metrics)

                aligned.append({
                    "window_start": window_start,
                    "window_end": window_end,
                    "data_points_count": len(window_metrics),
                    "production_rate": avg_production,
                    "consumption_rate": avg_consumption,
                    "backlog_count": sum_backlog // len(window_metrics),
                    "dead_letter_count": sum_dead_letter // len(window_metrics),
                    "consumer_count": avg_consumers,
                    "net_growth_rate": avg_production - avg_consumption
                })
            else:
                aligned.append({
                    "window_start": window_start,
                    "window_end": window_end,
                    "data_points_count": 0,
                    "production_rate": 0,
                    "consumption_rate": 0,
                    "backlog_count": 0,
                    "dead_letter_count": 0,
                    "consumer_count": 0,
                    "net_growth_rate": 0,
                    "note": "no_data_in_window"
                })

            current_time = window_end

        return aligned

    @staticmethod
    def get_alignment_summary(
        metrics: List[QueueMetrics],
        aligned_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        original_count = len(metrics)
        aligned_count = len(aligned_data)
        empty_windows = sum(1 for w in aligned_data if w.get("data_points_count", 0) == 0)

        return {
            "original_data_points": original_count,
            "aligned_windows": aligned_count,
            "empty_windows": empty_windows,
            "empty_window_ratio": empty_windows / aligned_count if aligned_count else 0,
            "time_span_seconds": (
                metrics[-1].timestamp - metrics[0].timestamp
            ).total_seconds() if metrics else 0,
            "average_points_per_window": (
                original_count / aligned_count if aligned_count else 0
            ),
            "human_readable_summary": (
                f"原始{original_count}个数据点已对齐到{aligned_count}个时间窗口，"
                f"其中{empty_windows}个窗口无数据（占比"
                f"{empty_windows / aligned_count * 100:.1f}%）。"
                f"请检查空白窗口是否为正常维护时段。"
            )
        }
