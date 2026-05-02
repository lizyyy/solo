import csv
import json
import yaml
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Tuple


def read_trips(file_path: Path) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    required_columns = ["trip_id", "timestamp", "floor", "direction", "door_open"]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise ValueError(f"trips.csv missing columns: {missing}")
    
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    
    if "floor" in df.columns:
        df["floor"] = df["floor"].ffill().bfill()
    
    return df


def read_vibration(file_path: Path) -> pd.DataFrame:
    records = []
    with open(file_path, "r") as f:
        for line in f:
            try:
                records.append(json.loads(line.strip()))
            except Exception:
                continue
    df = pd.DataFrame(records)
    required_columns = ["timestamp", "ax", "ay", "az"]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise ValueError(f"vibration.jsonl missing columns: {missing}")
    
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


def read_rules(file_path: Path) -> Dict:
    with open(file_path, "r") as f:
        return yaml.safe_load(f)


def load_data(trips_path: Path, vib_path: Path, rules_path: Path) -> Tuple[pd.DataFrame, pd.DataFrame, Dict]:
    trips = read_trips(trips_path)
    vibration = read_vibration(vib_path)
    rules = read_rules(rules_path)
    return trips, vibration, rules
