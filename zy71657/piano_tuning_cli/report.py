from __future__ import annotations

import csv
import io
import json
import os
from dataclasses import asdict
from typing import Dict, List, Optional

from .analysis import aggregate_by_zone, compare_trends, compute_deviations, rank_zones_by_instability
from .anomaly import detect_anomalies, explain_all
from .models import (
    AnomalyExplanation,
    DeviationResult,
    ToneZone,
    TrendComparison,
    TuningPhase,
    TuningRecord,
    ZoneAggregate,
)


def _fmt(val: Optional[float], precision: int = 2) -> str:
    if val is None:
        return "-"
    return f"{val:.{precision}f}"


def generate_text_report(
    piano_id: str,
    records: List[TuningRecord],
    deviations: List[DeviationResult],
    aggregates: Dict[ToneZone, ZoneAggregate],
    trends: List[TrendComparison],
    anomalies: List[AnomalyExplanation],
) -> str:
    lines: List[str] = []
    lines.append("=" * 60)
    lines.append(f"钢琴调律频偏统计报告 - {piano_id}")
    lines.append("=" * 60)

    lines.append(f"\n总记录数: {len(records)}")
    before = [r for r in records if r.tuning_phase == TuningPhase.BEFORE]
    after = [r for r in records if r.tuning_phase == TuningPhase.AFTER]
    lines.append(f"调律前: {len(before)} 条 | 调律后: {len(after)} 条 | 未标注阶段: {len(records) - len(before) - len(after)} 条")

    lines.append("\n" + "-" * 60)
    lines.append("【各音区频偏统计】")
    lines.append("-" * 60)
    ranked = rank_zones_by_instability(aggregates)
    lines.append(f"{'音区':<20} {'键数':>4} {'平均频偏':>10} {'最大频偏':>10} {'标准差':>8} {'稳定性':>10}")
    lines.append("-" * 70)
    for zone, agg in ranked:
        lines.append(
            f"{zone.value:<20} {agg.note_count:>4} "
            f"{_fmt(agg.avg_deviation_cents):>10} "
            f"{_fmt(agg.max_deviation_cents):>10} "
            f"{_fmt(agg.std_deviation_cents):>8} "
            f"{agg.instability_rank_label:>10}"
        )

    if aggregates:
        most_unstable_zone, most_unstable_agg = ranked[0]
        lines.append(f"\n最不稳定音区: {most_unstable_zone.value} (平均频偏 {_fmt(most_unstable_agg.avg_deviation_cents)} 音分)")
        if most_unstable_agg.unstable_notes:
            lines.append(f"  不稳定音名: {', '.join(most_unstable_agg.unstable_notes)}")

    if trends:
        lines.append("\n" + "-" * 60)
        lines.append("【调律前后趋势对比】")
        lines.append("-" * 60)
        lines.append(f"{'音区':<20} {'调律前':>10} {'调律后':>10} {'改善':>10} {'说明'}")
        lines.append("-" * 70)
        for t in trends:
            improvement = _fmt(t.improvement_cents) if t.improvement_cents is not None else "-"
            lines.append(
                f"{t.zone.value:<20} {_fmt(t.before_avg_cents):>10} "
                f"{_fmt(t.after_avg_cents):>10} {improvement:>10} "
                f"{'; '.join(t.notes) if t.notes else ''}"
            )

    if deviations:
        lines.append("\n" + "-" * 60)
        lines.append("【逐键频偏明细】")
        lines.append("-" * 60)
        lines.append(f"{'音名':<6} {'音区':<16} {'实测(Hz)':>10} {'标准(Hz)':>10} {'频偏(音分)':>10} {'频偏(Hz)':>10}")
        lines.append("-" * 70)
        for d in sorted(deviations, key=lambda x: x.canonical):
            lines.append(
                f"{d.canonical:<6} {d.tone_zone.value:<16} "
                f"{_fmt(d.measured_freq):>10} {_fmt(d.standard_freq):>10} "
                f"{_fmt(d.deviation_cents):>10} {_fmt(d.deviation_hz):>10}"
            )

    if anomalies:
        lines.append("\n" + "-" * 60)
        lines.append("【异常数据说明】")
        lines.append("-" * 60)
        lines.append(explain_all(anomalies))

    lines.append("\n" + "=" * 60)
    lines.append("报告结束")
    lines.append("=" * 60)

    return "\n".join(lines)


def export_json(
    piano_id: str,
    records: List[TuningRecord],
    deviations: List[DeviationResult],
    aggregates: Dict[ToneZone, ZoneAggregate],
    trends: List[TrendComparison],
    anomalies: List[AnomalyExplanation],
    filepath: str,
):
    data = {
        "piano_id": piano_id,
        "summary": {
            "total_records": len(records),
            "before_count": len([r for r in records if r.tuning_phase == TuningPhase.BEFORE]),
            "after_count": len([r for r in records if r.tuning_phase == TuningPhase.AFTER]),
        },
        "zone_aggregates": {
            zone.value: {
                "note_count": agg.note_count,
                "avg_deviation_cents": agg.avg_deviation_cents,
                "max_deviation_cents": agg.max_deviation_cents,
                "min_deviation_cents": agg.min_deviation_cents,
                "std_deviation_cents": agg.std_deviation_cents,
                "stability": agg.instability_rank_label,
                "unstable_notes": agg.unstable_notes,
            }
            for zone, agg in aggregates.items()
        },
        "trends": [
            {
                "zone": t.zone.value,
                "before_avg_cents": t.before_avg_cents,
                "after_avg_cents": t.after_avg_cents,
                "improvement_cents": t.improvement_cents,
                "notes": t.notes,
            }
            for t in trends
        ],
        "deviations": [
            {
                "note": d.canonical,
                "tone_zone": d.tone_zone.value,
                "measured_freq": d.measured_freq,
                "standard_freq": d.standard_freq,
                "deviation_cents": d.deviation_cents,
                "deviation_hz": d.deviation_hz,
            }
            for d in deviations
        ],
        "anomalies": [
            {
                "record_key": a.record_key,
                "type": a.anomaly_type,
                "detail": a.detail,
                "suggestion": a.suggestion,
            }
            for a in anomalies
        ],
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def export_csv(
    deviations: List[DeviationResult],
    filepath: str,
):
    with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["音名", "音区", "实测频率(Hz)", "标准频率(Hz)", "频偏(音分)", "频偏(Hz)"])
        for d in sorted(deviations, key=lambda x: x.canonical):
            writer.writerow([
                d.canonical,
                d.tone_zone.value,
                d.measured_freq if d.measured_freq is not None else "",
                d.standard_freq if d.standard_freq is not None else "",
                d.deviation_cents if d.deviation_cents is not None else "",
                d.deviation_hz if d.deviation_hz is not None else "",
            ])


def build_full_report(
    piano_id: str,
    records: List[TuningRecord],
) -> dict:
    deviations = compute_deviations(records)
    aggregates = aggregate_by_zone(deviations)

    before = [r for r in records if r.tuning_phase == TuningPhase.BEFORE]
    after = [r for r in records if r.tuning_phase == TuningPhase.AFTER]
    trends = compare_trends(before, after) if (before and after) else []

    anomalies = detect_anomalies(records, deviations)

    return {
        "piano_id": piano_id,
        "records": records,
        "deviations": deviations,
        "aggregates": aggregates,
        "trends": trends,
        "anomalies": anomalies,
    }
