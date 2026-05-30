from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from .models import (
    ActivityRecord,
    ForecastResult,
    PlaybackRecord,
    Scenario,
    SharingMatrix,
    SharingRecord,
    SourceTrace,
    TimeSeries,
    TimeSeriesPoint,
)


def _decay_factor(days_elapsed: int, scenario: Scenario) -> float:
    if days_elapsed <= 0:
        return 1.0
    if scenario.decay_model == "exponential":
        return math.exp(-scenario.decay_rate * days_elapsed)
    elif scenario.decay_model == "linear":
        return max(0.0, 1.0 - scenario.decay_rate * days_elapsed)
    elif scenario.decay_model == "logarithmic":
        return 1.0 / (1.0 + scenario.decay_rate * math.log(1 + days_elapsed))
    return math.exp(-scenario.decay_rate * days_elapsed)


def _growth_factor(days_elapsed: int, scenario: Scenario) -> float:
    if days_elapsed <= 0 or scenario.growth_rate == 0:
        return 1.0
    return (1.0 + scenario.growth_rate) ** days_elapsed


def _activity_multiplier(target_date: date, activities: List[ActivityRecord]) -> float:
    multiplier = 1.0
    for act in activities:
        if act.start_date <= target_date <= act.end_date:
            multiplier *= act.exposure_multiplier
    return multiplier


def _build_sharing_matrix(
    platform: str,
    target_date: date,
    sharings: List[SharingRecord],
    revenue_per_play: float,
    song_id: str,
) -> Optional[SharingMatrix]:
    candidates = [s for s in sharings if s.platform == platform and s.effective_date <= target_date]
    if not candidates:
        return None
    best = max(candidates, key=lambda s: s.effective_date)
    return SharingMatrix(
        song_id=song_id,
        platform=platform,
        effective_date=best.effective_date,
        artist_share=best.artist_share,
        label_share=best.label_share,
        platform_share=best.platform_share,
        revenue_per_play=revenue_per_play,
        trace=best.trace,
    )


def forecast_song_platform(
    song_id: str,
    platform: str,
    playback_records: List[PlaybackRecord],
    sharing_records: List[SharingRecord],
    activity_records: List[ActivityRecord],
    scenario: Scenario,
    forecast_days: int = 365,
    revenue_per_play: float = 0.005,
) -> Optional[ForecastResult]:
    platform_plays = [p for p in playback_records if p.song_id == song_id and p.platform == platform]
    if not platform_plays:
        return None

    sorted_plays = sorted(platform_plays, key=lambda p: p.date)
    base_date = sorted_plays[-1].date
    base_plays = sorted_plays[-1].plays

    song_activities = [a for a in activity_records if a.song_id == song_id]

    matrix = _build_sharing_matrix(platform, base_date, sharing_records, revenue_per_play, song_id)
    if matrix is None:
        return None

    points: List[TimeSeriesPoint] = []
    total_revenue = 0.0
    all_traces: List[SourceTrace] = [p.trace for p in sorted_plays] + [matrix.trace]
    for act in song_activities:
        all_traces.append(act.trace)

    for d_offset in range(forecast_days + 1):
        target = base_date + timedelta(days=d_offset)
        decay = _decay_factor(d_offset, scenario)
        growth = _growth_factor(d_offset, scenario)
        act_mult = _activity_multiplier(target, song_activities)

        predicted_plays = base_plays * decay * growth * act_mult
        daily_revenue = matrix.revenue_for(predicted_plays, "label")
        total_revenue += daily_revenue

        points.append(
            TimeSeriesPoint(
                date=target,
                value=daily_revenue,
                components={
                    "predicted_plays": predicted_plays,
                    "decay_factor": decay,
                    "growth_factor": growth,
                    "activity_multiplier": act_mult,
                    "label_share_revenue": daily_revenue,
                },
            )
        )

    ts = TimeSeries(song_id=song_id, platform=platform, scenario=scenario.name, points=points)

    return ForecastResult(
        song_id=song_id,
        platform=platform,
        scenario=scenario.name,
        time_series=ts,
        sharing_matrix=matrix,
        total_revenue=total_revenue,
        traces=all_traces,
    )


def forecast_all(
    playback_records: List[PlaybackRecord],
    sharing_records: List[SharingRecord],
    activity_records: List[ActivityRecord],
    scenarios: List[Scenario],
    forecast_days: int = 365,
    revenue_per_play: float = 0.005,
) -> Dict[str, List[ForecastResult]]:
    song_platform_pairs: Dict[Tuple[str, str], List[PlaybackRecord]] = {}
    for pb in playback_records:
        key = (pb.song_id, pb.platform)
        song_platform_pairs.setdefault(key, []).append(pb)

    results: Dict[str, List[ForecastResult]] = {s.name: [] for s in scenarios}

    for (song_id, platform), _ in song_platform_pairs.items():
        for scenario in scenarios:
            result = forecast_song_platform(
                song_id=song_id,
                platform=platform,
                playback_records=playback_records,
                sharing_records=sharing_records,
                activity_records=activity_records,
                scenario=scenario,
                forecast_days=forecast_days,
                revenue_per_play=revenue_per_play,
            )
            if result is not None:
                results[scenario.name].append(result)

    return results
