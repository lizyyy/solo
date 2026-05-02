import os
from datetime import date, datetime, timedelta
from typing import List, Optional

from src.models import RunRecord, PlannedRun, Project, PainLocation, RunIntensity


SAMPLE_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "samples")


def get_sample_csv_paths() -> dict:
    return {
        "garmin": os.path.join(SAMPLE_DATA_DIR, "garmin_sample.csv"),
        "keep": os.path.join(SAMPLE_DATA_DIR, "keep_sample.csv"),
        "manual": os.path.join(SAMPLE_DATA_DIR, "manual_sample.csv")
    }


def generate_sample_project() -> Project:
    today = date(2026, 5, 3)

    records: List[RunRecord] = []

    base_date = today - timedelta(days=60)

    week_ranges = [
        {"weeks": range(-8, -4), "base_distance": 5.0, "variation": 2.0, "long_run": 8.0, "intensity_days": [1, 3]},
        {"weeks": range(-4, -2), "base_distance": 6.0, "variation": 2.5, "long_run": 12.0, "intensity_days": [1, 3, 5]},
        {"weeks": range(-2, 0), "base_distance": 6.5, "variation": 3.0, "long_run": 16.0, "intensity_days": [1, 3, 4, 5]},
    ]

    run_id = 0
    for week_group in week_ranges:
        for week_idx in week_group["weeks"]:
            week_start = base_date + timedelta(weeks=week_idx + 8)
            for day in range(7):
                run_date = week_start + timedelta(days=day)

                if run_date > today:
                    continue

                if day in [0, 6]:
                    if day == 6:
                        distance = week_group["long_run"]
                        duration = distance * 7.2
                        avg_hr = 148
                        pace = duration / distance
                        elevation = distance * 9.0

                        pain_loc = PainLocation.NONE
                        pain_sev = None
                        notes = ""

                        if week_idx >= -2 and distance >= 15:
                            pain_loc = PainLocation.KNEE_LEFT
                            pain_sev = 3 if distance >= 18 else 2
                            notes = "左膝不适，后半程减速"

                        records.append(RunRecord(
                            record_id=f"sample_run_{run_id:03d}",
                            date=run_date,
                            distance_km=distance,
                            duration_min=duration,
                            avg_hr=avg_hr,
                            pace_min_per_km=pace,
                            elevation_m=elevation,
                            rpe=6 if pain_loc == PainLocation.NONE else 7,
                            pain_location=pain_loc,
                            pain_severity=pain_sev,
                            tags=["长距离", "LSD"],
                            notes=notes,
                            data_source="GARMIN"
                        ))
                        run_id += 1
                elif day in week_group["intensity_days"]:
                    if day == 1:
                        distance = 4.5
                        duration = distance * 6.1
                        avg_hr = 162
                        pace = duration / distance
                        elevation = 25.0
                        rpe = 8
                        tags = ["间歇", "高强度"]
                        notes = "8x400m 间歇训练"
                    elif day == 3:
                        distance = 6.0
                        duration = distance * 6.8
                        avg_hr = 156
                        pace = duration / distance
                        elevation = 55.0
                        rpe = 7
                        tags = ["节奏跑", "阈值"]
                        notes = "节奏跑，配速稳定"
                    else:
                        distance = 5.0
                        duration = distance * 6.0
                        avg_hr = 158
                        pace = duration / distance
                        elevation = 30.0
                        rpe = 8
                        tags = ["阈值", "高强度"]
                        notes = "阈值训练"

                    pain_loc = PainLocation.NONE
                    pain_sev = None
                    if week_idx >= -1:
                        pain_loc = PainLocation.KNEE_LEFT
                        pain_sev = 2
                        notes += "，左膝有轻微痛感"

                    records.append(RunRecord(
                        record_id=f"sample_run_{run_id:03d}",
                        date=run_date,
                        distance_km=distance,
                        duration_min=duration,
                        avg_hr=avg_hr,
                        pace_min_per_km=pace,
                        elevation_m=elevation,
                        rpe=rpe,
                        pain_location=pain_loc,
                        pain_severity=pain_sev,
                        tags=tags,
                        notes=notes,
                        data_source="GARMIN"
                    ))
                    run_id += 1
                elif day == 2:
                    distance = 5.5
                    duration = distance * 7.0
                    avg_hr = 140
                    pace = duration / distance
                    elevation = 45.0
                    rpe = 4
                    tags = ["轻松跑", "恢复"]
                    notes = "轻松恢复跑"

                    pain_loc = PainLocation.NONE
                    pain_sev = None
                    if week_idx >= -1:
                        pain_loc = PainLocation.KNEE_LEFT
                        pain_sev = 1
                        notes = "左膝有轻微感觉，降速跑"

                    records.append(RunRecord(
                        record_id=f"sample_run_{run_id:03d}",
                        date=run_date,
                        distance_km=distance,
                        duration_min=duration,
                        avg_hr=avg_hr,
                        pace_min_per_km=pace,
                        elevation_m=elevation,
                        rpe=rpe,
                        pain_location=pain_loc,
                        pain_severity=pain_sev,
                        tags=tags,
                        notes=notes,
                        data_source="GARMIN"
                    ))
                    run_id += 1

    planned_runs: List[PlannedRun] = []
    plan_id = 0

    next_monday = today + timedelta(days=(7 - today.weekday()) % 7)
    if today.weekday() == 0:
        next_monday = today

    two_weeks_plan = [
        {"date_offset": 1, "distance": 5.0, "duration": 35.0, "intensity": RunIntensity.MODERATE, "desc": "渐快跑"},
        {"date_offset": 3, "distance": 8.0, "duration": 58.0, "intensity": RunIntensity.MODERATE, "desc": "节奏跑"},
        {"date_offset": 4, "distance": 4.5, "duration": 28.0, "intensity": RunIntensity.INTERVAL, "desc": "间歇8x400m"},
        {"date_offset": 6, "distance": 15.0, "duration": 108.0, "intensity": RunIntensity.EASY, "desc": "周末长距离LSD"},
        {"date_offset": 8, "distance": 6.0, "duration": 42.0, "intensity": RunIntensity.EASY, "desc": "恢复跑"},
        {"date_offset": 10, "distance": 7.0, "duration": 48.0, "intensity": RunIntensity.MODERATE, "desc": "渐快跑"},
        {"date_offset": 11, "distance": 5.0, "duration": 33.0, "intensity": RunIntensity.THRESHOLD, "desc": "阈值跑"},
        {"date_offset": 13, "distance": 18.0, "duration": 130.0, "intensity": RunIntensity.EASY, "desc": "周末长距离LSD（半马准备）"},
    ]

    for plan in two_weeks_plan:
        planned_runs.append(PlannedRun(
            plan_id=f"plan_{plan_id:02d}",
            date=today + timedelta(days=plan["date_offset"]),
            planned_distance_km=plan["distance"],
            planned_duration_min=plan["duration"],
            planned_intensity=plan["intensity"],
            description=plan["desc"],
            tags=[plan["intensity"].value, "训练计划"]
        ))
        plan_id += 1

    return Project(
        project_name="示例训练项目 - 膝盖不适复盘",
        created_at=datetime(2026, 5, 3, 10, 0),
        updated_at=datetime(2026, 5, 3, 10, 0),
        records=records,
        planned_runs=planned_runs,
        tags_definition={
            "轻松跑": "低强度恢复跑",
            "间歇": "高强度间歇训练",
            "节奏跑": "稳定配速的节奏跑",
            "长距离": "LSD长距离慢跑",
            "阈值": "乳酸阈值训练",
            "恢复": "主动恢复",
            "高强度": "高强度训练",
            "伤痛": "带痛跑步"
        }
    )
