from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict
from ..models import (
    SampleRecord,
    SampleComparison,
    InkAdjustment,
    generate_id,
    WorkflowStatus
)


class ComparisonEngine:
    @staticmethod
    def compare_records(
        order_id: str,
        records: List[SampleRecord]
    ) -> SampleComparison:
        sorted_records = sorted(records, key=lambda r: r.sequence_number)

        delta_trend = ComparisonEngine._extract_delta_trend(sorted_records)
        adjustments_summary = ComparisonEngine._summarize_adjustments(sorted_records)
        paper_batch_changes = ComparisonEngine._track_paper_changes(sorted_records)

        return SampleComparison(
            comparison_id=generate_id("COMP_"),
            order_id=order_id,
            records=[r.record_id for r in sorted_records],
            delta_trend=delta_trend,
            adjustments_summary=adjustments_summary,
            paper_batch_changes=paper_batch_changes,
        )

    @staticmethod
    def _extract_delta_trend(records: List[SampleRecord]) -> Dict[str, List[float]]:
        trend = defaultdict(list)

        for record in records:
            if record.color_delta:
                trend["delta_e2000"].append(record.color_delta.delta_e2000)
                trend["delta_e76"].append(record.color_delta.delta_e76)
                trend["delta_l"].append(record.color_delta.delta_l)
                trend["delta_a"].append(record.color_delta.delta_a)
                trend["delta_b"].append(record.color_delta.delta_b)

        return dict(trend)

    @staticmethod
    def _summarize_adjustments(records: List[SampleRecord]) -> Dict[str, Any]:
        summary = {
            "total_adjustments": 0,
            "by_channel": defaultdict(int),
            "by_record": [],
            "cumulative_changes": defaultdict(float),
        }

        for record in records:
            record_adjustments = {
                "record_id": record.record_id,
                "sequence": record.sequence_number,
                "adjustments": []
            }

            for adjustment in record.adjustments:
                summary["total_adjustments"] += 1
                summary["by_channel"][adjustment.color_channel] += 1

                change = adjustment.after_value - adjustment.before_value
                summary["cumulative_changes"][adjustment.color_channel] += change

                record_adjustments["adjustments"].append({
                    "channel": adjustment.color_channel,
                    "change": change,
                    "reason": adjustment.adjustment_reason,
                })

            if record_adjustments["adjustments"]:
                summary["by_record"].append(record_adjustments)

        summary["by_channel"] = dict(summary["by_channel"])
        summary["cumulative_changes"] = dict(summary["cumulative_changes"])

        return summary

    @staticmethod
    def _track_paper_changes(records: List[SampleRecord]) -> List[str]:
        changes = []
        if not records:
            return changes

        prev_batch = records[0].paper_batch

        for i, record in enumerate(records[1:], start=1):
            current_batch = record.paper_batch
            if current_batch.batch_code != prev_batch.batch_code:
                changes.append(
                    f"第{i+1}次打样: {prev_batch.batch_code} -> {current_batch.batch_code}"
                )
            prev_batch = current_batch

        return changes

    @staticmethod
    def analyze_trend(delta_values: List[float]) -> Dict[str, Any]:
        if len(delta_values) < 2:
            return {"trend": "insufficient_data"}

        first_half = delta_values[:len(delta_values) // 2]
        second_half = delta_values[len(delta_values) // 2:]

        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)

        trend = {
            "first_avg": avg_first,
            "second_avg": avg_second,
            "improvement": avg_second - avg_first,
        }

        if avg_second < avg_first:
            trend["trend"] = "improving"
            trend["description"] = "色差呈下降趋势，调整有效"
        elif avg_second > avg_first:
            trend["trend"] = "worsening"
            trend["description"] = "色差呈上升趋势，需要重新评估"
        else:
            trend["trend"] = "stable"
            trend["description"] = "色差稳定"

        trend["best_value"] = min(delta_values)
        trend["worst_value"] = max(delta_values)
        trend["variance"] = sum((x - (sum(delta_values) / len(delta_values))) ** 2 for x in delta_values) / len(delta_values)

        return trend

    @staticmethod
    def get_comparison_report(comparison: SampleComparison) -> Dict[str, Any]:
        report = {
            "comparison_id": comparison.comparison_id,
            "order_id": comparison.order_id,
            "total_samples": len(comparison.records),
            "created_at": comparison.created_at.isoformat(),
        }

        if comparison.delta_trend.get("delta_e2000"):
            deltas = comparison.delta_trend["delta_e2000"]
            report["delta_analysis"] = {
                "min": min(deltas),
                "max": max(deltas),
                "avg": sum(deltas) / len(deltas),
                "trend": ComparisonEngine.analyze_trend(deltas),
            }

        report["adjustments_summary"] = comparison.adjustments_summary
        report["paper_batch_changes"] = comparison.paper_batch_changes

        return report
