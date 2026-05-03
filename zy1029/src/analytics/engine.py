from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple, Any, Callable
from collections import defaultdict

from src.models import (
    RunRecord,
    PlannedRun,
    RiskAlert,
    RunIntensity,
    PainLocation,
    INTENSITY_LABELS
)


@dataclass
class WeeklySummary:
    week_start: date
    week_number: int
    total_distance_km: float = 0.0
    total_duration_min: float = 0.0
    total_training_load: float = 0.0
    max_distance_single_run_km: float = 0.0
    total_runs: int = 0
    intensity_distribution: Dict[RunIntensity, int] = field(default_factory=dict)
    intensity_load_distribution: Dict[RunIntensity, float] = field(default_factory=dict)
    avg_pace_min_per_km: Optional[float] = None
    avg_hr: Optional[int] = None
    total_elevation_m: float = 0.0
    run_dates: List[date] = field(default_factory=list)
    pain_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "week_start": self.week_start.isoformat(),
            "week_number": self.week_number,
            "total_distance_km": self.total_distance_km,
            "total_duration_min": self.total_duration_min,
            "total_training_load": self.total_training_load,
            "max_distance_single_run_km": self.max_distance_single_run_km,
            "total_runs": self.total_runs,
            "intensity_distribution": {k.value: v for k, v in self.intensity_distribution.items()},
            "intensity_load_distribution": {k.value: v for k, v in self.intensity_load_distribution.items()},
            "avg_pace_min_per_km": self.avg_pace_min_per_km,
            "avg_hr": self.avg_hr,
            "total_elevation_m": self.total_elevation_m,
            "run_dates": [d.isoformat() for d in self.run_dates],
            "pain_count": self.pain_count
        }


@dataclass
class RollingLoad:
    load_7d: float
    load_28d: float
    acwr: float
    daily_loads_7d: List[Tuple[date, float]]
    daily_loads_28d: List[Tuple[date, float]]
    baseline_weekly_avg: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "load_7d": self.load_7d,
            "load_28d": self.load_28d,
            "acwr": self.acwr,
            "daily_loads_7d": [(d.isoformat(), l) for d, l in self.daily_loads_7d],
            "daily_loads_28d": [(d.isoformat(), l) for d, l in self.daily_loads_28d],
            "baseline_weekly_avg": self.baseline_weekly_avg
        }


@dataclass
class PaceZone:
    zone_name: str
    min_pace: Optional[float]
    max_pace: Optional[float]
    count: int = 0
    total_distance: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "zone_name": self.zone_name,
            "min_pace": self.min_pace,
            "max_pace": self.max_pace,
            "count": self.count,
            "total_distance": self.total_distance
        }


@dataclass
class HRZone:
    zone_name: str
    min_hr: Optional[int]
    max_hr: Optional[int]
    count: int = 0
    total_distance: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "zone_name": self.zone_name,
            "min_hr": self.min_hr,
            "max_hr": self.max_hr,
            "count": self.count,
            "total_distance": self.total_distance
        }


@dataclass
class DashboardData:
    weekly_summaries: List[WeeklySummary]
    rolling_loads: Dict[date, RollingLoad]
    pace_zones: List[PaceZone]
    hr_zones: List[HRZone]
    risks: List[RiskAlert]
    key_metrics: Dict[str, Any]
    date_range: Tuple[date, date]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "weekly_summaries": [w.to_dict() for w in self.weekly_summaries],
            "rolling_loads": {k.isoformat(): v.to_dict() for k, v in self.rolling_loads.items()},
            "pace_zones": [p.to_dict() for p in self.pace_zones],
            "hr_zones": [h.to_dict() for h in self.hr_zones],
            "risks": [r.to_dict() for r in self.risks],
            "key_metrics": self.key_metrics,
            "date_range": [self.date_range[0].isoformat(), self.date_range[1].isoformat()]
        }


def get_week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def aggregate_by_week(records: List[RunRecord]) -> List[WeeklySummary]:
    if not records:
        return []

    sorted_records = sorted(records, key=lambda r: r.date)
    min_date = sorted_records[0].date
    max_date = sorted_records[-1].date
    min_week_start = get_week_start(min_date)
    max_week_start = get_week_start(max_date)

    week_map: Dict[date, WeeklySummary] = {}
    current_week = min_week_start
    week_num = 1
    while current_week <= max_week_start:
        week_map[current_week] = WeeklySummary(
            week_start=current_week,
            week_number=week_num
        )
        week_num += 1
        current_week += timedelta(days=7)

    for record in sorted_records:
        week_start = get_week_start(record.date)
        if week_start not in week_map:
            continue

        ws = week_map[week_start]
        ws.total_distance_km += record.distance_km
        ws.total_duration_min += record.duration_min
        ws.total_training_load += record.training_load
        ws.total_elevation_m += record.elevation_m
        ws.total_runs += 1
        ws.run_dates.append(record.date)

        if record.distance_km > ws.max_distance_single_run_km:
            ws.max_distance_single_run_km = record.distance_km

        intensity = record.intensity_category
        ws.intensity_distribution[intensity] = ws.intensity_distribution.get(intensity, 0) + 1
        ws.intensity_load_distribution[intensity] = (
            ws.intensity_load_distribution.get(intensity, 0.0) + record.training_load
        )

        if record.pain_location != PainLocation.NONE:
            ws.pain_count += 1

    for ws in week_map.values():
        if ws.total_runs > 0:
            paces = [r.pace_min_per_km for r in sorted_records
                     if get_week_start(r.date) == ws.week_start and r.pace_min_per_km]
            if paces:
                ws.avg_pace_min_per_km = sum(paces) / len(paces)
            hrs = [r.avg_hr for r in sorted_records
                   if get_week_start(r.date) == ws.week_start and r.avg_hr]
            if hrs:
                ws.avg_hr = int(sum(hrs) / len(hrs))

    return sorted(week_map.values(), key=lambda w: w.week_start)


def build_daily_load_map(records: List[RunRecord]) -> Dict[date, float]:
    daily_load: Dict[date, float] = defaultdict(float)
    for r in records:
        daily_load[r.date] += r.training_load
    return dict(daily_load)


def calculate_rolling_loads(
    records: List[RunRecord],
    ref_date: Optional[date] = None
) -> Dict[date, RollingLoad]:
    if not records:
        return {}

    sorted_records = sorted(records, key=lambda r: r.date)
    min_date = sorted_records[0].date
    if ref_date is None:
        max_date = sorted_records[-1].date
    else:
        max_date = ref_date

    daily_load = build_daily_load_map(records)

    results: Dict[date, RollingLoad] = {}

    current = max(min_date + timedelta(days=6), min_date)
    while current <= max_date:
        load_7d = 0.0
        daily_7d: List[Tuple[date, float]] = []
        for d_offset in range(7):
            d = current - timedelta(days=d_offset)
            ld = daily_load.get(d, 0.0)
            load_7d += ld
            daily_7d.append((d, ld))

        load_28d = 0.0
        daily_28d: List[Tuple[date, float]] = []
        for d_offset in range(28):
            d = current - timedelta(days=d_offset)
            ld = daily_load.get(d, 0.0)
            load_28d += ld
            daily_28d.append((d, ld))

        baseline_weeks = 0
        baseline_total = 0.0
        lookback_days = min(56, (current - min_date).days)
        for week_idx in range(4):
            week_end = current - timedelta(days=week_idx * 7)
            week_start = week_end - timedelta(days=6)
            week_load = 0.0
            has_data = False
            d = week_start
            while d <= week_end:
                if d >= min_date:
                    week_load += daily_load.get(d, 0.0)
                    has_data = True
                d += timedelta(days=1)
            if has_data and week_load > 0:
                baseline_weeks += 1
                baseline_total += week_load

        baseline_weekly_avg = baseline_total / baseline_weeks if baseline_weeks > 0 else load_7d
        acwr = load_7d / baseline_weekly_avg if baseline_weekly_avg > 0 else 1.0

        results[current] = RollingLoad(
            load_7d=load_7d,
            load_28d=load_28d,
            acwr=acwr,
            daily_loads_7d=sorted(daily_7d, key=lambda x: x[0]),
            daily_loads_28d=sorted(daily_28d, key=lambda x: x[0]),
            baseline_weekly_avg=baseline_weekly_avg
        )
        current += timedelta(days=1)

    return results


def calculate_pace_zones(records: List[RunRecord]) -> List[PaceZone]:
    zones = [
        PaceZone("Z1-恢复 (<6:30)", 6.5, None),
        PaceZone("Z2-轻松 (5:30-6:30)", 5.5, 6.5),
        PaceZone("Z3-马拉松配速 (4:45-5:30)", 4.75, 5.5),
        PaceZone("Z4-阈值 (4:15-4:45)", 4.25, 4.75),
        PaceZone("Z5-间歇 (<4:15)", None, 4.25)
    ]

    for record in records:
        if not record.pace_min_per_km:
            continue
        p = record.pace_min_per_km
        for z in zones:
            if z.min_pace is None and z.max_pace is not None:
                if p < z.max_pace:
                    z.count += 1
                    z.total_distance += record.distance_km
                    break
            elif z.max_pace is None and z.min_pace is not None:
                if p >= z.min_pace:
                    z.count += 1
                    z.total_distance += record.distance_km
                    break
            elif z.min_pace is not None and z.max_pace is not None:
                if z.min_pace <= p < z.max_pace:
                    z.count += 1
                    z.total_distance += record.distance_km
                    break

    return zones


def calculate_hr_zones(records: List[RunRecord]) -> List[HRZone]:
    zones = [
        HRZone("Z1-恢复 (<130)", None, 130),
        HRZone("Z2-轻松 (130-145)", 130, 145),
        HRZone("Z3-马拉松配速 (145-155)", 145, 155),
        HRZone("Z4-阈值 (155-170)", 155, 170),
        HRZone("Z5-间歇/比赛 (>170)", 170, None)
    ]

    for record in records:
        if not record.avg_hr:
            continue
        hr = record.avg_hr
        for z in zones:
            if z.min_hr is None and z.max_hr is not None:
                if hr < z.max_hr:
                    z.count += 1
                    z.total_distance += record.distance_km
                    break
            elif z.max_hr is None and z.min_hr is not None:
                if hr >= z.min_hr:
                    z.count += 1
                    z.total_distance += record.distance_km
                    break
            elif z.min_hr is not None and z.max_hr is not None:
                if z.min_hr <= hr < z.max_hr:
                    z.count += 1
                    z.total_distance += record.distance_km
                    break

    return zones


def detect_risks(
    records: List[RunRecord],
    planned_runs: List[PlannedRun],
    rolling_loads: Dict[date, RollingLoad]
) -> List[RiskAlert]:
    risks: List[RiskAlert] = []

    if not records:
        return risks

    sorted_records = sorted(records, key=lambda r: r.date)
    date_to_records: Dict[date, List[RunRecord]] = defaultdict(list)
    for r in sorted_records:
        date_to_records[r.date].append(r)

    min_date = sorted_records[0].date
    max_date = sorted_records[-1].date

    risks.extend(detect_sudden_volume_increase(sorted_records, date_to_records, min_date, max_date))

    risks.extend(detect_consecutive_high_intensity(sorted_records, date_to_records, min_date, max_date))

    risks.extend(detect_insufficient_rest(sorted_records, date_to_records, min_date, max_date))

    risks.extend(detect_pain_while_running(sorted_records))

    risks.extend(detect_load_spikes(rolling_loads))

    risks.extend(detect_plan_risks(planned_runs, rolling_loads, max_date))

    return sorted(
        risks,
        key=lambda r: {"high": 0, "medium": 1, "low": 2}.get(r.severity, 3)
    )


def detect_sudden_volume_increase(
    sorted_records: List[RunRecord],
    date_to_records: Dict[date, List[RunRecord]],
    min_date: date,
    max_date: date
) -> List[RiskAlert]:
    risks: List[RiskAlert] = []

    weekly_summaries = aggregate_by_week(sorted_records)
    if len(weekly_summaries) < 2:
        return risks

    for i in range(1, len(weekly_summaries)):
        prev_ws = weekly_summaries[i-1]
        curr_ws = weekly_summaries[i]

        if prev_ws.total_distance_km <= 0:
            continue

        increase_pct = (curr_ws.total_distance_km - prev_ws.total_distance_km) / prev_ws.total_distance_km * 100

        if increase_pct > 50:
            severity = "high"
        elif increase_pct > 30:
            severity = "medium"
        else:
            continue

        risks.append(RiskAlert(
            risk_type="sudden_volume_increase",
            severity=severity,
            message=f"第{curr_ws.week_number}周跑量比前一周增加了{increase_pct:.0f}% "
                    f"({prev_ws.total_distance_km:.1f}km → {curr_ws.total_distance_km:.1f}km)",
            related_dates=[prev_ws.week_start, curr_ws.week_start],
            related_record_ids=[],
            details={
                "prev_week_distance": prev_ws.total_distance_km,
                "curr_week_distance": curr_ws.total_distance_km,
                "increase_pct": increase_pct,
                "threshold": 30
            }
        ))

    return risks


def detect_consecutive_high_intensity(
    sorted_records: List[RunRecord],
    date_to_records: Dict[date, List[RunRecord]],
    min_date: date,
    max_date: date
) -> List[RiskAlert]:
    risks: List[RiskAlert] = []

    high_intensities = {RunIntensity.INTERVAL, RunIntensity.THRESHOLD, RunIntensity.RACE}

    streak_start: Optional[date] = None
    streak_count = 0
    streak_records: List[RunRecord] = []

    current = min_date
    while current <= max_date:
        day_records = date_to_records.get(current, [])
        day_has_high = any(r.intensity_category in high_intensities for r in day_records)

        if day_has_high:
            if streak_start is None:
                streak_start = current
            streak_count += 1
            for r in day_records:
                if r.intensity_category in high_intensities:
                    streak_records.append(r)
        else:
            if streak_count >= 3:
                risks.append(RiskAlert(
                    risk_type="consecutive_high_intensity",
                    severity="high" if streak_count >= 4 else "medium",
                    message=f"连续{streak_count}天高强度训练（{streak_start} 开始）",
                    related_dates=[streak_start, current - timedelta(days=1)] if streak_start else [],
                    related_record_ids=[r.record_id for r in streak_records],
                    details={
                        "streak_days": streak_count,
                        "intensities": list(set(INTENSITY_LABELS[r.intensity_category] for r in streak_records))
                    }
                ))
            streak_start = None
            streak_count = 0
            streak_records = []

        current += timedelta(days=1)

    if streak_count >= 3:
        risks.append(RiskAlert(
            risk_type="consecutive_high_intensity",
            severity="high" if streak_count >= 4 else "medium",
            message=f"连续{streak_count}天高强度训练（{streak_start} 开始，仍在持续）",
            related_dates=[streak_start, max_date] if streak_start else [],
            related_record_ids=[r.record_id for r in streak_records],
            details={
                "streak_days": streak_count,
                "intensities": list(set(INTENSITY_LABELS[r.intensity_category] for r in streak_records))
            }
        ))

    return risks


def detect_insufficient_rest(
    sorted_records: List[RunRecord],
    date_to_records: Dict[date, List[RunRecord]],
    min_date: date,
    max_date: date
) -> List[RiskAlert]:
    risks: List[RiskAlert] = []

    weekly_summaries = aggregate_by_week(sorted_records)

    for ws in weekly_summaries:
        unique_days = set(ws.run_dates)
        rest_days = 7 - len(unique_days)

        if ws.total_runs >= 5 and rest_days < 2:
            risks.append(RiskAlert(
                risk_type="insufficient_rest",
                severity="high" if rest_days == 0 else "medium",
                message=f"第{ws.week_number}周训练过于密集：{ws.total_runs}次跑步，仅{rest_days}天休息",
                related_dates=[ws.week_start, ws.week_start + timedelta(days=6)],
                related_record_ids=[],
                details={
                    "week_number": ws.week_number,
                    "total_runs": ws.total_runs,
                    "rest_days": rest_days,
                    "min_rest_recommended": 2
                }
            ))

    return risks


def detect_pain_while_running(
    sorted_records: List[RunRecord]
) -> List[RiskAlert]:
    risks: List[RiskAlert] = []

    pain_records = [r for r in sorted_records if r.pain_location != PainLocation.NONE]
    if not pain_records:
        return risks

    pain_locations: Dict[str, List[RunRecord]] = defaultdict(list)
    for r in pain_records:
        pain_locations[r.pain_location.value].append(r)

    for loc_val, records in pain_locations.items():
        sorted_pain_records = sorted(records, key=lambda r: r.date)
        count = len(sorted_pain_records)
        first_date = sorted_pain_records[0].date
        last_date = sorted_pain_records[-1].date

        from src.models import PAIN_LOCATION_LABELS
        loc_label = PAIN_LOCATION_LABELS.get(PainLocation(loc_val), loc_val)

        severity = "high" if count >= 3 else "medium" if count >= 2 else "low"

        risks.append(RiskAlert(
            risk_type="pain_while_running",
            severity=severity,
            message=f"在{loc_label}部位记录了{count}次疼痛（{first_date} 至 {last_date}）",
            related_dates=[r.date for r in sorted_pain_records],
            related_record_ids=[r.record_id for r in sorted_pain_records],
            details={
                "pain_location": loc_val,
                "pain_count": count,
                "records_with_severity": [(r.pain_severity or 0) for r in sorted_pain_records]
            }
        ))

    return risks


def detect_load_spikes(
    rolling_loads: Dict[date, RollingLoad]
) -> List[RiskAlert]:
    risks: List[RiskAlert] = []

    if not rolling_loads:
        return risks

    max_date = max(rolling_loads.keys())
    latest_load = rolling_loads[max_date]

    if latest_load.acwr > 1.5:
        risks.append(RiskAlert(
            risk_type="load_spike_7d",
            severity="high",
            message=f"当前7天训练负荷比基线高出{(latest_load.acwr - 1) * 100:.0f}%，"
                    f"ACWR={latest_load.acwr:.2f}（建议保持在0.8-1.3之间）",
            related_dates=[max_date],
            related_record_ids=[],
            details={
                "acwr": latest_load.acwr,
                "load_7d": latest_load.load_7d,
                "baseline_weekly_avg": latest_load.baseline_weekly_avg,
                "recommended_range": (0.8, 1.3)
            }
        ))
    elif latest_load.acwr > 1.3:
        risks.append(RiskAlert(
            risk_type="load_spike_7d",
            severity="medium",
            message=f"当前7天训练负荷比基线高出{(latest_load.acwr - 1) * 100:.0f}%，"
                    f"ACWR={latest_load.acwr:.2f}，略高于安全范围",
            related_dates=[max_date],
            related_record_ids=[],
            details={
                "acwr": latest_load.acwr,
                "load_7d": latest_load.load_7d,
                "baseline_weekly_avg": latest_load.baseline_weekly_avg,
                "recommended_range": (0.8, 1.3)
            }
        ))

    return risks


def detect_plan_risks(
    planned_runs: List[PlannedRun],
    rolling_loads: Dict[date, RollingLoad],
    latest_historical_date: date
) -> List[RiskAlert]:
    risks: List[RiskAlert] = []

    if not planned_runs:
        return risks

    sorted_plans = sorted(planned_runs, key=lambda p: p.date)

    if rolling_loads:
        latest_date = max(rolling_loads.keys())
        latest_load = rolling_loads[latest_date]

        future_14d_load = sum(p.estimated_load for p in sorted_plans
                               if p.date <= latest_historical_date + timedelta(days=14))

        baseline_daily = latest_load.baseline_weekly_avg / 7.0 if latest_load.baseline_weekly_avg > 0 else 0
        projected_7d = latest_load.load_7d + sum(p.estimated_load for p in sorted_plans
                                                   if latest_date < p.date <= latest_date + timedelta(days=7))
        projected_acwr = projected_7d / latest_load.baseline_weekly_avg if latest_load.baseline_weekly_avg > 0 else 1.0

        if projected_acwr > 1.5:
            risks.append(RiskAlert(
                risk_type="plan_overload",
                severity="high",
                message=f"按计划执行后7天负荷ACWR预计达到{projected_acwr:.2f}，超过安全阈值",
                related_dates=[p.date for p in sorted_plans],
                related_record_ids=[],
                details={
                    "projected_acwr": projected_acwr,
                    "projected_7d_load": projected_7d,
                    "future_14d_total_load": future_14d_load
                }
            ))

    for i in range(len(sorted_plans) - 1):
        current_plan = sorted_plans[i]
        next_plan = sorted_plans[i + 1]

        days_between = (next_plan.date - current_plan.date).days

        high_intensities = {RunIntensity.INTERVAL, RunIntensity.THRESHOLD, RunIntensity.RACE}
        current_is_high = current_plan.planned_intensity in high_intensities
        next_is_high = next_plan.planned_intensity in high_intensities

        if current_is_high and next_is_high and days_between < 2:
            risks.append(RiskAlert(
                risk_type="plan_rest_conflict",
                severity="medium",
                message=f"计划中{current_plan.date}和{next_plan.date}连续安排高强度训练，建议间隔至少1天",
                related_dates=[current_plan.date, next_plan.date],
                related_record_ids=[],
                details={
                    "days_between": days_between,
                    "current_intensity": current_plan.planned_intensity.value if current_plan.planned_intensity else None,
                    "next_intensity": next_plan.planned_intensity.value if next_plan.planned_intensity else None
                }
            ))

    return risks


def compute_key_metrics(
    records: List[RunRecord],
    weekly_summaries: List[WeeklySummary],
    rolling_loads: Dict[date, RollingLoad]
) -> Dict[str, Any]:
    if not records:
        return {}

    sorted_records = sorted(records, key=lambda r: r.date)
    total_distance = sum(r.distance_km for r in records)
    total_duration = sum(r.duration_min for r in records)
    total_load = sum(r.training_load for r in records)

    avg_pace = None
    paces = [r.pace_min_per_km for r in records if r.pace_min_per_km]
    if paces:
        avg_pace = sum(paces) / len(paces)

    avg_hr = None
    hrs = [r.avg_hr for r in records if r.avg_hr]
    if hrs:
        avg_hr = int(sum(hrs) / len(hrs))

    latest_acwr = None
    if rolling_loads:
        latest_date = max(rolling_loads.keys())
        latest_acwr = rolling_loads[latest_date].acwr

    current_week_load = 0.0
    current_week_distance = 0.0
    if weekly_summaries:
        latest_ws = weekly_summaries[-1]
        current_week_load = latest_ws.total_training_load
        current_week_distance = latest_ws.total_distance_km

    high_intensity_runs = sum(1 for r in records
                               if r.intensity_category in {RunIntensity.THRESHOLD, RunIntensity.INTERVAL, RunIntensity.RACE})

    pain_runs = sum(1 for r in records if r.pain_location != PainLocation.NONE)

    return {
        "total_runs": len(records),
        "total_distance_km": total_distance,
        "total_duration_min": total_duration,
        "total_training_load": total_load,
        "avg_pace_min_per_km": avg_pace,
        "avg_hr": avg_hr,
        "latest_acwr": latest_acwr,
        "current_week_load": current_week_load,
        "current_week_distance": current_week_distance,
        "high_intensity_run_count": high_intensity_runs,
        "pain_run_count": pain_runs,
        "date_range_start": sorted_records[0].date.isoformat(),
        "date_range_end": sorted_records[-1].date.isoformat()
    }


def build_dashboard(
    records: List[RunRecord],
    planned_runs: List[PlannedRun]
) -> DashboardData:
    if not records:
        return DashboardData(
            weekly_summaries=[],
            rolling_loads={},
            pace_zones=[],
            hr_zones=[],
            risks=[],
            key_metrics={},
            date_range=(date.today(), date.today())
        )

    sorted_records = sorted(records, key=lambda r: r.date)
    date_range = (sorted_records[0].date, sorted_records[-1].date)

    weekly_summaries = aggregate_by_week(records)
    rolling_loads = calculate_rolling_loads(records)
    pace_zones = calculate_pace_zones(records)
    hr_zones = calculate_hr_zones(records)
    risks = detect_risks(records, planned_runs, rolling_loads)
    key_metrics = compute_key_metrics(records, weekly_summaries, rolling_loads)

    return DashboardData(
        weekly_summaries=weekly_summaries,
        rolling_loads=rolling_loads,
        pace_zones=pace_zones,
        hr_zones=hr_zones,
        risks=risks,
        key_metrics=key_metrics,
        date_range=date_range
    )
