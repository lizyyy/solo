from __future__ import annotations

import csv
import json
import os
from datetime import date
from typing import Any, Dict, List, Optional

from .models import (
    DataIssue,
    ForecastResult,
    ImportResult,
)


def compare_scenarios_safe(results: Dict[str, List[ForecastResult]]) -> List[Dict[str, Any]]:
    song_platform_totals: Dict[tuple, Dict[str, float]] = {}
    for scenario_name, forecasts in results.items():
        for fr in forecasts:
            key = (fr.song_id, fr.platform)
            song_platform_totals.setdefault(key, {})[scenario_name] = fr.total_revenue

    comparison = []
    for (song_id, platform), scenario_totals in sorted(song_platform_totals.items()):
        entry: Dict[str, Any] = {
            "song_id": song_id,
            "platform": platform,
        }
        for sn in sorted(scenario_totals):
            entry[f"revenue_{sn}"] = round(scenario_totals[sn], 4)
        baseline = scenario_totals.get("baseline", 0)
        for sn in sorted(scenario_totals):
            if sn != "baseline" and baseline > 0:
                entry[f"delta_vs_baseline_{sn}"] = round(scenario_totals[sn] - baseline, 4)
                if baseline != 0:
                    entry[f"pct_vs_baseline_{sn}"] = round(
                        (scenario_totals[sn] - baseline) / baseline * 100, 2
                    )
                else:
                    entry[f"pct_vs_baseline_{sn}"] = None
        comparison.append(entry)
    return comparison


def export_forecasts_json(
    results: Dict[str, List[ForecastResult]],
    output_dir: str,
    include_points: bool = True,
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    output: Dict[str, Any] = {
        "export_time": date.today().isoformat(),
        "scenarios": {},
    }
    for scenario_name, forecasts in results.items():
        output["scenarios"][scenario_name] = [fr.to_dict() for fr in forecasts]
        if not include_points:
            for fr_dict in output["scenarios"][scenario_name]:
                if "time_series" in fr_dict and "points" in fr_dict["time_series"]:
                    del fr_dict["time_series"]["points"]

    filepath = os.path.join(output_dir, "forecasts.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    return filepath


def export_forecasts_csv(
    results: Dict[str, List[ForecastResult]],
    output_dir: str,
) -> List[str]:
    os.makedirs(output_dir, exist_ok=True)
    exported = []

    for scenario_name, forecasts in results.items():
        filepath = os.path.join(output_dir, f"forecast_{scenario_name}.csv")
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "song_id", "platform", "date", "predicted_plays",
                "decay_factor", "growth_factor", "activity_multiplier",
                "label_revenue", "trace_ids",
            ])
            for fr in forecasts:
                trace_ids = ";".join(t.trace_id() for t in fr.traces)
                for pt in fr.time_series.points:
                    writer.writerow([
                        fr.song_id,
                        fr.platform,
                        pt.date.isoformat(),
                        round(pt.components.get("predicted_plays", 0), 2),
                        round(pt.components.get("decay_factor", 1), 6),
                        round(pt.components.get("growth_factor", 1), 6),
                        round(pt.components.get("activity_multiplier", 1), 4),
                        round(pt.value, 4),
                        trace_ids,
                    ])
        exported.append(filepath)
    return exported


def export_comparison_csv(
    results: Dict[str, List[ForecastResult]],
    output_dir: str,
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    comparison = compare_scenarios_safe(results)
    filepath = os.path.join(output_dir, "scenario_comparison.csv")
    if not comparison:
        return filepath
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=comparison[0].keys())
        writer.writeheader()
        writer.writerows(comparison)
    return filepath


def export_issues_json(
    import_results: List[ImportResult],
    cross_issues: List[DataIssue],
    output_dir: str,
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    all_issues = []
    for ir in import_results:
        all_issues.extend(ir.issues)
    all_issues.extend(cross_issues)

    normal_issues = [i for i in all_issues if i.severity.value == "warning"]
    error_issues = [i for i in all_issues if i.severity.value == "error"]

    output: Dict[str, Any] = {
        "export_time": date.today().isoformat(),
        "summary": {
            "total_issues": len(all_issues),
            "warnings": len(normal_issues),
            "errors": len(error_issues),
        },
        "errors": [i.to_dict() for i in error_issues],
        "warnings": [i.to_dict() for i in normal_issues],
    }

    filepath = os.path.join(output_dir, "data_issues.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    return filepath


def export_issues_csv(
    import_results: List[ImportResult],
    cross_issues: List[DataIssue],
    output_dir: str,
    separate: bool = True,
) -> List[str]:
    os.makedirs(output_dir, exist_ok=True)
    all_issues = []
    for ir in import_results:
        all_issues.extend(ir.issues)
    all_issues.extend(cross_issues)

    exported: List[str] = []

    if separate:
        errors = [i for i in all_issues if i.severity.value == "error"]
        warnings = [i for i in all_issues if i.severity.value == "warning"]

        for label, items in [("errors", errors), ("warnings", warnings)]:
            filepath = os.path.join(output_dir, f"data_issues_{label}.csv")
            with open(filepath, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=[
                    "severity", "rule_code", "message", "source_file",
                    "original_row", "raw_line", "field_name",
                ])
                writer.writeheader()
                for i in items:
                    writer.writerow(i.to_dict())
            exported.append(filepath)
    else:
        filepath = os.path.join(output_dir, "data_issues_all.csv")
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "severity", "rule_code", "message", "source_file",
                "original_row", "raw_line", "field_name",
            ])
            writer.writeheader()
            for i in all_issues:
                writer.writerow(i.to_dict())
        exported.append(filepath)

    return exported
