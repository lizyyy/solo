"""CLI module for Formation QC."""

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from formation_qc.exporter import CsvExporter, HtmlExporter, MarkdownExporter
from formation_qc.parser import ChannelReadingsParser, RecipeParser, TrayMapParser
from formation_qc.rule_engine import Issue, RuleEngine
from formation_qc.statistics import OutlierDetector, StepStatistics


def run_qc(
    csv_path: str,
    recipe_path: str,
    tray_map_path: Optional[str],
    output_dir: str = "output",
) -> dict:
    csv_parser = ChannelReadingsParser(csv_path)
    channel_data = csv_parser.parse()

    recipe_parser = RecipeParser(recipe_path)
    recipe = recipe_parser.parse()

    tray_map = {}
    if tray_map_path:
        tray_parser = TrayMapParser(tray_map_path)
        tray_map = tray_parser.parse()

    first_ts = channel_data[0]["data"][0]["timestamp"] if channel_data else datetime.now()

    engine = RuleEngine(recipe)
    all_issues: list[Issue] = []
    channel_issues_map: dict[int, list[Issue]] = {}
    channel_capacities: dict[int, float] = {}
    step_stats_agg: dict[int, dict] = {}

    for ch_info in channel_data:
        ch = ch_info["channel"]
        data = ch_info["data"]
        if not data:
            continue
        channel_capacities[ch] = data[-1]["capacity"]
        issues = engine.run_all(ch, data, first_ts)
        if issues:
            channel_issues_map[ch] = issues
            all_issues.extend(issues)

        for i, seg in enumerate(ch_info.get("segments", [])):
            seg_data = data[seg.start_idx : seg.end_idx + 1]
            if seg_data:
                stats = StepStatistics.compute_step_stats(seg_data)
                if i not in step_stats_agg:
                    step_stats_agg[i] = {"voltage": [], "temp": [], "capacity": []}
                step_stats_agg[i]["voltage"].append(stats.get("voltage_mean", 0))
                step_stats_agg[i]["temp"].append(stats.get("temperature_mean", 0))
                step_stats_agg[i]["capacity"].append(stats.get("capacity_final", 0))

    outlier_detector = OutlierDetector()
    capacity_outliers = outlier_detector.detect_capacity_outliers(channel_capacities)

    exec_summary = {
        "offline_count": sum(1 for i in all_issues if i.issue_type.value == "offline"),
        "reverse_count": sum(1 for i in all_issues if i.issue_type.value == "reverse"),
        "temp_issue_count": sum(1 for i in all_issues if i.issue_type.value == "temperature_rise"),
        "missing_sample_count": sum(1 for i in all_issues if i.issue_type.value == "missing_sample"),
        "capacity_outlier_count": sum(1 for cs in capacity_outliers if cs.is_outlier),
    }

    step_summary = []
    for step_idx in sorted(step_stats_agg.keys()):
        agg = step_stats_agg[step_idx]
        step_summary.append({
            "step_index": step_idx,
            "step_name": recipe["stages"][step_idx].get("name", f"step_{step_idx}") if step_idx < len(recipe["stages"]) else f"step_{step_idx}",
            "channel_count": len(agg["voltage"]),
            "avg_voltage": sum(agg["voltage"]) / len(agg["voltage"]),
            "avg_temperature": sum(agg["temp"]) / len(agg["temp"]),
            "avg_capacity": sum(agg["capacity"]) / len(agg["capacity"]),
        })

    report = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_channels": len(channel_data),
        "problem_channels": len(channel_issues_map),
        "executive_summary": exec_summary,
        "all_issues": all_issues,
        "capacity_outliers": capacity_outliers,
        "step_summary": step_summary,
    }

    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    md_exporter = MarkdownExporter()
    md_exporter.export(report, str(output_path / "batch_report.md"))

    csv_exporter = CsvExporter()
    csv_exporter.export(all_issues, capacity_outliers, str(output_path / "bad_channels.csv"))

    channels_for_html = []
    for ch_info in channel_data:
        ch = ch_info["channel"]
        channels_for_html.append({
            "channel": ch,
            "data": [
                {"timestamp": d["timestamp"].isoformat() if isinstance(d["timestamp"], datetime) else d["timestamp"],
                 "voltage": d["voltage"], "current": d["current"],
                 "temperature": d["temperature"], "capacity": d["capacity"]}
                for d in ch_info["data"]
            ],
            "segments": [{"step_name": s.step_name, "start_idx": s.start_idx, "end_idx": s.end_idx, "channel": ch} for s in ch_info.get("segments", [])],
            "hasIssues": ch in channel_issues_map,
            "issues": [{"issue_type": i.issue_type.value, "message": i.message} for i in channel_issues_map.get(ch, [])],
        })

    html_exporter = HtmlExporter()
    html_exporter.export({"channels": channels_for_html, "segments": []}, str(output_path / "curves.html"))

    return report


def create_demo_data(output_dir: str = "demo_sample") -> None:
    import csv
    import json
    import yaml
    from datetime import timedelta

    demo_path = Path(output_dir)
    demo_path.mkdir(exist_ok=True)

    base_time = datetime(2025, 1, 15, 8, 0, 0)
    intervals = 10

    with open(demo_path / "channel_readings.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["channel", "timestamp", "voltage", "current", "temperature", "capacity"])
        for ch in range(1, 9):
            voltage = 3.0 + ch * 0.1
            capacity = 0.0
            for step in range(4):
                for i in range(20):
                    t = base_time + timedelta(seconds=(step * 20 + i) * intervals)
                    if ch == 3 and step == 2 and i == 5:
                        t += timedelta(seconds=120)
                    temp = 25.0 + step * 2 + (i % 5) * 0.5
                    if ch == 5 and step == 1:
                        temp += 10
                    capacity += 0.01
                    writer.writerow([ch, t.strftime("%Y-%m-%d %H:%M:%S"), f"{voltage:.3f}", "1.0", f"{temp:.1f}", f"{capacity:.4f}"])
                    voltage += 0.02

    recipe_data = {
        "stages": [
            {"name": "formation", "duration_min": 60},
            {"name": "rest", "duration_min": 30},
            {"name": "grading", "duration_min": 90},
            {"name": "final_rest", "duration_min": 30},
        ],
        "sampling_interval": 10,
        "temperature_threshold": {"max_rise_per_step": 15.0, "max_rate_C_per_min": 2.0},
        "voltage_threshold": {"min": 2.5, "max": 4.3},
        "current_threshold": {"max": 5.0},
        "capacity_threshold": {"min": 0.5, "max": 2.0},
    }
    with open(demo_path / "recipe.yaml", "w", encoding="utf-8") as f:
        yaml.dump(recipe_data, f)

    tray_data = {
        "trays": [
            {
                "tray_id": "A1",
                "cells": [
                    {"channel": i, "position": f"A{i}", "type": "NMC811"}
                    for i in range(1, 9)
                ],
            }
        ]
    }
    with open(demo_path / "tray_map.json", "w", encoding="utf-8") as f:
        json.dump(tray_data, f, indent=2)

    print(f"Demo data created in: {demo_path}")
    print(f"  - channel_readings.csv")
    print(f"  - recipe.yaml")
    print(f"  - tray_map.json")
    print(f"\nRun with: python -m formation_qc demo")


def main():
    parser = argparse.ArgumentParser(description="Formation QC CLI - Lithium battery batch verification")
    parser.add_argument("command", choices=["check", "demo"], help="Command to run")
    parser.add_argument("--csv", help="Path to channel_readings.csv")
    parser.add_argument("--recipe", help="Path to recipe.yaml")
    parser.add_argument("--tray-map", help="Path to tray_map.json")
    parser.add_argument("--output", default="output", help="Output directory")

    args = parser.parse_args()

    if args.command == "demo":
        demo_dir = "demo_sample"
        create_demo_data(demo_dir)
        print(f"\nRunning QC on demo data...")
        run_qc(
            csv_path=f"{demo_dir}/channel_readings.csv",
            recipe_path=f"{demo_dir}/recipe.yaml",
            tray_map_path=f"{demo_dir}/tray_map.json",
            output_dir="output",
        )
        print("\nOutputs generated in ./output/")
        print("  - batch_report.md")
        print("  - bad_channels.csv")
        print("  - curves.html")
        return

    if args.command == "check":
        if not args.csv or not args.recipe:
            parser.error("--csv and --recipe are required for 'check' command")
        result = run_qc(args.csv, args.recipe, args.tray_map, args.output)
        print(f"QC complete. {result['problem_channels']}/{result['total_channels']} channels with issues.")
        print(f"Reports written to: {args.output}/")
        return


if __name__ == "__main__":
    main()
