import argparse
import sys
from pathlib import Path
import pandas as pd
import numpy as np
import json
import yaml
from datetime import datetime, timedelta
from .data_reader import load_data
from .trip_segmentation import segment_trips
from .feature_calculation import calculate_all_features
from .anomaly_scoring import apply_rules
from .exporter import export_alerts, export_report, export_trend_plot


def create_sample_data(output_dir: Path):
    output_dir.mkdir(exist_ok=True)
    
    trips_data = []
    base_time = datetime.now() - timedelta(hours=2)
    
    for i in range(5):
        start_time = base_time + timedelta(minutes=i*10)
        trip_id = f"TRIP-{i+1:03d}"
        
        trips_data.append({
            "trip_id": trip_id,
            "timestamp": start_time,
            "floor": 1 if i % 2 == 0 else 10,
            "direction": "up" if i % 2 == 0 else "down",
            "door_open": True
        })
        trips_data.append({
            "trip_id": trip_id,
            "timestamp": start_time + timedelta(seconds=30),
            "floor": 10 if i % 2 == 0 else 1,
            "direction": "up" if i % 2 == 0 else "down",
            "door_open": True
        })
    
    trips_df = pd.DataFrame(trips_data)
    trips_df.to_csv(output_dir / "trips.csv", index=False)
    
    vib_data = []
    i = 0
    for trip in trips_df["trip_id"].unique():
        trip_rows = trips_df[trips_df["trip_id"] == trip]
        start_ts = trip_rows["timestamp"].min()
        end_ts = trip_rows["timestamp"].max()
        
        ts = start_ts
        while ts <= end_ts:
            ax = np.random.normal(0, 0.3)
            ay = np.random.normal(0, 0.2)
            az = np.random.normal(0, 0.1)
            if i % 3 == 0:
                ax += np.sin(ts.second * 0.5) * 0.5
            vib_data.append({
                "timestamp": ts,
                "ax": ax,
                "ay": ay,
                "az": az
            })
            ts += timedelta(milliseconds=100)
        i += 1
    
    with open(output_dir / "vibration.jsonl", "w") as f:
        for record in vib_data:
            record["timestamp"] = record["timestamp"].isoformat()
            f.write(json.dumps(record) + "\n")
    
    rules = {
        "peak": {"ax": 2.0, "ay": 2.0, "az": 2.0},
        "rms": {"ax": 0.5, "ay": 0.5, "az": 0.5},
        "jerk": {"ax": 10.0},
        "stop_deviation": {"max": 0.5},
        "door_jitter": {"max": 1.0}
    }
    with open(output_dir / "maintenance_rules.yaml", "w") as f:
        yaml.dump(rules, f)


def run_analysis(trips_path: Path, vib_path: Path, rules_path: Path, output_dir: Path):
    output_dir.mkdir(exist_ok=True)
    
    print("Loading data...")
    trips, vibration, rules = load_data(trips_path, vib_path, rules_path)
    
    print("Segmenting trips...")
    segmented_trips = segment_trips(trips, vibration)
    
    print("Calculating features...")
    features_df = calculate_all_features(segmented_trips)
    
    print("Applying rules...")
    alerts = apply_rules(features_df, rules)
    
    print("Exporting results...")
    export_alerts(alerts, output_dir / "alerts.csv")
    export_report(features_df, alerts, output_dir / "trip_report.md")
    export_trend_plot(features_df, segmented_trips, output_dir / "trends.html")
    
    print(f"Analysis complete. Results saved to {output_dir}")


def main():
    parser = argparse.ArgumentParser(description="Elevator Maintenance QC Tool")
    subparsers = parser.add_subparsers(dest="command")
    
    demo_parser = subparsers.add_parser("demo", help="Run demo with sample data")
    demo_parser.add_argument("--output-dir", type=Path, default=Path("output"), help="Output directory")
    
    run_parser = subparsers.add_parser("run", help="Run analysis with custom data")
    run_parser.add_argument("--trips", type=Path, required=True, help="Path to trips.csv")
    run_parser.add_argument("--vibration", type=Path, required=True, help="Path to vibration.jsonl")
    run_parser.add_argument("--rules", type=Path, required=True, help="Path to maintenance_rules.yaml")
    run_parser.add_argument("--output-dir", type=Path, default=Path("output"), help="Output directory")
    
    args = parser.parse_args()
    
    if args.command == "demo":
        sample_dir = Path("sample_data")
        if not (sample_dir / "trips.csv").exists():
            create_sample_data(sample_dir)
        run_analysis(
            sample_dir / "trips.csv",
            sample_dir / "vibration.jsonl",
            sample_dir / "maintenance_rules.yaml",
            args.output_dir
        )
    elif args.command == "run":
        run_analysis(args.trips, args.vibration, args.rules, args.output_dir)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
