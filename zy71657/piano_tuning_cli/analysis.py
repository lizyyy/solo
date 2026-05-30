from __future__ import annotations

import math
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from .models import (
    DeviationResult,
    ToneZone,
    TrendComparison,
    TuningPhase,
    TuningRecord,
    ZoneAggregate,
    freq_to_cents,
)


def compute_deviations(records: List[TuningRecord]) -> List[DeviationResult]:
    results: List[DeviationResult] = []
    for rec in records:
        if rec.note_parsed is None:
            continue

        standard_freq = rec.note_parsed.standard_freq
        measured_freq = rec.measured_freq
        deviation_cents = rec.deviation_cents
        deviation_hz = None

        if measured_freq is not None and measured_freq > 0 and standard_freq > 0:
            computed_cents = freq_to_cents(measured_freq, standard_freq)
            if deviation_cents is None:
                deviation_cents = computed_cents
            deviation_hz = measured_freq - standard_freq

        if deviation_cents is not None and measured_freq is None and standard_freq > 0:
            measured_freq = standard_freq * (2 ** (deviation_cents / 1200.0))
            deviation_hz = measured_freq - standard_freq

        results.append(DeviationResult(
            note=rec.note_parsed.name,
            octave=rec.note_parsed.octave,
            canonical=rec.note_parsed.canonical,
            tone_zone=rec.note_parsed.tone_zone,
            measured_freq=measured_freq,
            standard_freq=standard_freq,
            deviation_cents=deviation_cents,
            deviation_hz=deviation_hz,
        ))

    return results


def aggregate_by_zone(deviations: List[DeviationResult]) -> Dict[ToneZone, ZoneAggregate]:
    zone_map: Dict[ToneZone, List[DeviationResult]] = defaultdict(list)
    for d in deviations:
        zone_map[d.tone_zone].append(d)

    result: Dict[ToneZone, ZoneAggregate] = {}
    for zone, devs in zone_map.items():
        cents_list = [d.deviation_cents for d in devs if d.deviation_cents is not None]
        note_count = len(devs)

        if not cents_list:
            result[zone] = ZoneAggregate(
                zone=zone,
                note_count=note_count,
                avg_deviation_cents=None,
                max_deviation_cents=None,
                min_deviation_cents=None,
                std_deviation_cents=None,
                unstable_notes=[],
            )
            continue

        avg_c = sum(cents_list) / len(cents_list)
        max_c = max(cents_list, key=abs)
        min_c = min(cents_list)
        if len(cents_list) > 1:
            variance = sum((c - avg_c) ** 2 for c in cents_list) / (len(cents_list) - 1)
            std_c = math.sqrt(variance)
        else:
            std_c = 0.0

        threshold = 5.0
        unstable = [d.canonical for d in devs if d.deviation_cents is not None and abs(d.deviation_cents) > threshold]

        result[zone] = ZoneAggregate(
            zone=zone,
            note_count=note_count,
            avg_deviation_cents=round(avg_c, 2),
            max_deviation_cents=round(max_c, 2),
            min_deviation_cents=round(min_c, 2),
            std_deviation_cents=round(std_c, 2),
            unstable_notes=unstable,
        )

    return result


def compare_trends(
    before_records: List[TuningRecord],
    after_records: List[TuningRecord],
) -> List[TrendComparison]:
    before_devs = compute_deviations(before_records)
    after_devs = compute_deviations(after_records)

    before_by_zone: Dict[ToneZone, List[DeviationResult]] = defaultdict(list)
    after_by_zone: Dict[ToneZone, List[DeviationResult]] = defaultdict(list)

    for d in before_devs:
        before_by_zone[d.tone_zone].append(d)
    for d in after_devs:
        after_by_zone[d.tone_zone].append(d)

    all_zones = set(before_by_zone.keys()) | set(after_by_zone.keys())
    comparisons: List[TrendComparison] = []

    for zone in sorted(all_zones, key=lambda z: z.value):
        b_devs = before_by_zone.get(zone, [])
        a_devs = after_by_zone.get(zone, [])

        b_cents = [d.deviation_cents for d in b_devs if d.deviation_cents is not None]
        a_cents = [d.deviation_cents for d in a_devs if d.deviation_cents is not None]

        b_avg = round(sum(b_cents) / len(b_cents), 2) if b_cents else None
        a_avg = round(sum(a_cents) / len(a_cents), 2) if a_cents else None

        b_max = round(max(b_cents, key=abs), 2) if b_cents else None
        a_max = round(max(a_cents, key=abs), 2) if a_cents else None

        improvement = None
        if b_avg is not None and a_avg is not None:
            improvement = round(abs(b_avg) - abs(a_avg), 2)

        notes: List[str] = []
        if improvement is not None:
            if improvement > 2:
                notes.append(f"调律后改善 {improvement} 音分")
            elif improvement < -2:
                notes.append(f"调律后恶化 {abs(improvement)} 音分，需关注")
            else:
                notes.append("调律前后变化不大")
        elif b_avg is not None and a_avg is None:
            notes.append("调律后无数据")
        elif b_avg is None and a_avg is not None:
            notes.append("调律前无数据")

        comparisons.append(TrendComparison(
            zone=zone,
            before_avg_cents=b_avg,
            after_avg_cents=a_avg,
            improvement_cents=improvement,
            before_max_cents=b_max,
            after_max_cents=a_max,
            notes=notes,
        ))

    return comparisons


def rank_zones_by_instability(
    aggregates: Dict[ToneZone, ZoneAggregate],
) -> List[Tuple[ToneZone, ZoneAggregate]]:
    def sort_key(item: Tuple[ToneZone, ZoneAggregate]) -> float:
        agg = item[1]
        if agg.avg_deviation_cents is None:
            return 0.0
        return abs(agg.avg_deviation_cents)

    return sorted(aggregates.items(), key=sort_key, reverse=True)
