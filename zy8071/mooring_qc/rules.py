"""Rule determination module for mooring quality check."""

from datetime import datetime, timedelta
from typing import Any, List, Dict


def detect_tension_peaks(
    aligned_data: List[Dict[str, Any]],
    threshold_kn: float,
    min_duration_sec: int = 10,
) -> List[Dict[str, Any]]:
    """Detect tension peaks exceeding threshold.

    Args:
        aligned_data: Time-aligned sensor data
        threshold_kn: Peak detection threshold in kN
        min_duration_sec: Minimum duration to count as peak event

    Returns:
        List of peak events with start, end, max_tension, duration
    """
    peaks = []
    in_peak = False
    peak_start = None
    peak_max = 0

    for record in aligned_data:
        ts = record["timestamp"]
        tension = record["tension_kn"]

        if tension > threshold_kn:
            if not in_peak:
                in_peak = True
                peak_start = ts
                peak_max = tension
            else:
                peak_max = max(peak_max, tension)
        else:
            if in_peak:
                duration = (ts - peak_start).total_seconds()
                if duration >= min_duration_sec:
                    peaks.append({
                        "start_time": peak_start,
                        "end_time": ts,
                        "max_tension_kn": peak_max,
                        "duration_sec": duration,
                    })
                in_peak = False

    if in_peak and aligned_data:
        duration = (aligned_data[-1]["timestamp"] - peak_start).total_seconds()
        if duration >= min_duration_sec:
            peaks.append({
                "start_time": peak_start,
                "end_time": aligned_data[-1]["timestamp"],
                "max_tension_kn": peak_max,
                "duration_sec": duration,
            })

    return peaks


def detect_overlimit_duration(
    aligned_data: List[Dict[str, Any]],
    max_tension_kn: float,
    overlimit_threshold_pct: float = 1.1,
) -> List[Dict[str, Any]]:
    """Detect sustained overlimit conditions.

    Args:
        aligned_data: Time-aligned sensor data
        max_tension_kn: Maximum allowed tension in kN
        overlimit_threshold_pct: Percentage above max to count as overlimit

    Returns:
        List of overlimit events
    """
    threshold = max_tension_kn * overlimit_threshold_pct
    overlimits = []
    in_overlimit = False
    overlimit_start = None

    for record in aligned_data:
        ts = record["timestamp"]
        tension = record["tension_kn"]

        if tension > threshold:
            if not in_overlimit:
                in_overlimit = True
                overlimit_start = ts
        else:
            if in_overlimit:
                overlimits.append({
                    "start_time": overlimit_start,
                    "end_time": ts,
                    "max_tension_kn": threshold,
                    "duration_sec": (ts - overlimit_start).total_seconds(),
                })
                in_overlimit = False

    if in_overlimit:
        overlimits.append({
            "start_time": overlimit_start,
            "end_time": aligned_data[-1]["timestamp"],
            "max_tension_kn": threshold,
            "duration_sec": (aligned_data[-1]["timestamp"] - overlimit_start).total_seconds(),
        })

    return overlimits


def detect_sensor_drift(
    aligned_data: List[Dict[str, Any]],
    drift_threshold_pct: float = 0.05,
    window_minutes: int = 30,
) -> List[Dict[str, Any]]:
    """Detect sensor drift over time.

    Args:
        aligned_data: Time-aligned sensor data
        drift_threshold_pct: Drift threshold as percentage of mean tension
        window_minutes: Time window for drift calculation

    Returns:
        List of drift events
    """
    if len(aligned_data) < 2:
        return []

    sensor_groups = {}
    for record in aligned_data:
        sid = record["sensor_id"]
        if sid not in sensor_groups:
            sensor_groups[sid] = []
        sensor_groups[sid].append(record)

    drifts = []
    window = timedelta(minutes=window_minutes)

    for sensor_id, records in sensor_groups.items():
        records = sorted(records, key=lambda x: x["timestamp"])
        tensions = [r["tension_kn"] for r in records]
        mean_tension = sum(tensions) / len(tensions)
        drift_threshold = mean_tension * drift_threshold_pct

        for i in range(len(records) - 1):
            t1 = records[i]["timestamp"]
            t2 = records[i + 1]["timestamp"]
            if (t2 - t1) > window:
                drift = abs(tensions[i + 1] - tensions[i])
                if drift > drift_threshold:
                    drifts.append({
                        "sensor_id": sensor_id,
                        "time": t1,
                        "drift_kn": drift,
                        "threshold_kn": drift_threshold,
                    })

    return drifts


def detect_missing_intervals(
    aligned_data: List[Dict[str, Any]],
    max_gap_seconds: int = 300,
) -> List[Dict[str, Any]]:
    """Detect missing data intervals in sensor readings.

    Args:
        aligned_data: Time-aligned sensor data
        max_gap_seconds: Maximum allowed gap between readings

    Returns:
        List of missing intervals
    """
    if len(aligned_data) < 2:
        return []

    missing = []
    for i in range(len(aligned_data) - 1):
        gap = (aligned_data[i + 1]["timestamp"] - aligned_data[i]["timestamp"]).total_seconds()
        if gap > max_gap_seconds:
            missing.append({
                "start_time": aligned_data[i]["timestamp"],
                "end_time": aligned_data[i + 1]["timestamp"],
                "gap_seconds": gap,
            })

    return missing
