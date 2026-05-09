import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta


def generate_normal_sample_data(
    sample_id: str,
    batch_id: str,
    duration_hours: float = 48.0,
    time_interval_minutes: int = 30,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    if seed is not None:
        np.random.seed(seed)

    num_points = int(duration_hours * 60 / time_interval_minutes) + 1
    time_hours = np.linspace(0, duration_hours, num_points)

    ph_base = 7.0
    ph = ph_base - 0.5 * np.exp(-time_hours / 10) + 0.05 * np.random.randn(num_points)
    ph = np.clip(ph, 5.5, 8.0)

    temp_base = 37.0
    temp = temp_base + 0.3 * np.sin(time_hours / 5) + 0.1 * np.random.randn(num_points)
    temp = np.clip(temp, 28.0, 40.0)

    do_base = 80.0
    do = do_base - 40 * (1 - np.exp(-time_hours / 15)) + 5 * np.random.randn(num_points)
    do = np.clip(do, 0.0, 100.0)

    df = pd.DataFrame({
        "sample_id": [sample_id] * num_points,
        "batch_id": [batch_id] * num_points,
        "time": time_hours,
        "pH": ph,
        "temperature": temp,
        "dissolved_oxygen": do,
    })

    return df


def generate_drift_sample(
    sample_id: str,
    batch_id: str,
    duration_hours: float = 48.0,
    time_interval_minutes: int = 30,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    if seed is not None:
        np.random.seed(seed)

    num_points = int(duration_hours * 60 / time_interval_minutes) + 1
    time_hours = np.linspace(0, duration_hours, num_points)

    ph_base = 7.0
    ph = ph_base - 0.05 * time_hours + 0.05 * np.random.randn(num_points)

    temp_base = 37.0
    temp = temp_base + 0.08 * time_hours + 0.1 * np.random.randn(num_points)

    do_base = 80.0
    do = do_base + 0.8 * time_hours + 5 * np.random.randn(num_points)
    do = np.clip(do, 0.0, 100.0)

    df = pd.DataFrame({
        "sample_id": [sample_id] * num_points,
        "batch_id": [batch_id] * num_points,
        "time": time_hours,
        "pH": ph,
        "temperature": temp,
        "dissolved_oxygen": do,
    })

    return df


def generate_spike_sample(
    sample_id: str,
    batch_id: str,
    duration_hours: float = 48.0,
    time_interval_minutes: int = 30,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    if seed is not None:
        np.random.seed(seed)

    num_points = int(duration_hours * 60 / time_interval_minutes) + 1
    time_hours = np.linspace(0, duration_hours, num_points)

    ph_base = 7.0
    ph = ph_base - 0.5 * np.exp(-time_hours / 10) + 0.05 * np.random.randn(num_points)
    spike_indices = np.random.choice(num_points, size=5, replace=False)
    ph[spike_indices] += np.random.choice([-3.0, 3.0], size=5)
    ph = np.clip(ph, 2.0, 11.0)

    temp_base = 37.0
    temp = temp_base + 0.3 * np.sin(time_hours / 5) + 0.1 * np.random.randn(num_points)

    do_base = 80.0
    do = do_base - 40 * (1 - np.exp(-time_hours / 15)) + 5 * np.random.randn(num_points)

    df = pd.DataFrame({
        "sample_id": [sample_id] * num_points,
        "batch_id": [batch_id] * num_points,
        "time": time_hours,
        "pH": ph,
        "temperature": temp,
        "dissolved_oxygen": do,
    })

    return df


def generate_range_violation_sample(
    sample_id: str,
    batch_id: str,
    duration_hours: float = 48.0,
    time_interval_minutes: int = 30,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    if seed is not None:
        np.random.seed(seed)

    num_points = int(duration_hours * 60 / time_interval_minutes) + 1
    time_hours = np.linspace(0, duration_hours, num_points)

    ph = 4.5 + 0.01 * time_hours + 0.05 * np.random.randn(num_points)

    temp_base = 37.0
    temp = temp_base + 0.3 * np.sin(time_hours / 5) + 0.1 * np.random.randn(num_points)

    do_base = 80.0
    do = do_base - 40 * (1 - np.exp(-time_hours / 15)) + 5 * np.random.randn(num_points)

    df = pd.DataFrame({
        "sample_id": [sample_id] * num_points,
        "batch_id": [batch_id] * num_points,
        "time": time_hours,
        "pH": ph,
        "temperature": temp,
        "dissolved_oxygen": do,
    })

    return df


def add_missing_values(
    df: pd.DataFrame,
    missing_ratio: float = 0.1,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    if seed is not None:
        np.random.seed(seed)

    df = df.copy()
    numeric_cols = ["pH", "temperature", "dissolved_oxygen"]

    for col in numeric_cols:
        if col in df.columns:
            mask = np.random.choice(
                [True, False],
                size=len(df),
                p=[missing_ratio, 1 - missing_ratio],
            )
            df.loc[mask, col] = np.nan

    return df


def add_duplicates(
    df: pd.DataFrame,
    duplicate_ratio: float = 0.05,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    if seed is not None:
        np.random.seed(seed)

    num_duplicates = int(len(df) * duplicate_ratio)
    if num_duplicates > 0:
        dup_indices = np.random.choice(len(df), size=num_duplicates, replace=False)
        duplicates = df.iloc[dup_indices].copy()
        df = pd.concat([df, duplicates], ignore_index=True)

    return df.sort_values(["sample_id", "time"]).reset_index(drop=True)


def generate_test_dataset(
    output_path: Optional[str] = None,
    seed: int = 42,
) -> pd.DataFrame:
    np.random.seed(seed)

    normal1 = generate_normal_sample_data("SAMP-001", "BATCH-2024-001", seed=1)
    normal2 = generate_normal_sample_data("SAMP-002", "BATCH-2024-002", seed=2)

    drift_sample = generate_drift_sample("SAMP-003", "BATCH-2024-003", seed=3)
    spike_sample = generate_spike_sample("SAMP-004", "BATCH-2024-004", seed=4)
    range_sample = generate_range_violation_sample("SAMP-005", "BATCH-2024-005", seed=5)

    normal_with_missing = generate_normal_sample_data("SAMP-006", "BATCH-2024-006", seed=6)
    normal_with_missing = add_missing_values(normal_with_missing, missing_ratio=0.15, seed=6)

    normal_with_duplicates = generate_normal_sample_data("SAMP-007", "BATCH-2024-007", seed=7)
    normal_with_duplicates = add_duplicates(normal_with_duplicates, duplicate_ratio=0.08, seed=7)

    all_dfs = [
        normal1,
        normal2,
        drift_sample,
        spike_sample,
        range_sample,
        normal_with_missing,
        normal_with_duplicates,
    ]

    combined_df = pd.concat(all_dfs, ignore_index=True)

    if output_path:
        if output_path.endswith(".csv"):
            combined_df.to_csv(output_path, index=False)
        elif output_path.endswith((".xlsx", ".xls")):
            combined_df.to_excel(output_path, index=False)

    return combined_df
