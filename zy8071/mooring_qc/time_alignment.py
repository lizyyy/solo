"""Time alignment module for cross-midnight berthing handling."""

from datetime import datetime, timedelta
from typing import Any, List, Dict, Optional


def align_by_berth_window(
    berth_plan: Dict[str, Any],
    sensor_data: List[Dict[str, Any]],
    tidewind_data: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Align sensor data to berth window, handling cross-midnight berthing.

    For cross-midnight berthing, the arrival and departure may span across
    midnight. This function handles time continuity properly.

    Args:
        berth_plan: Berth plan record with arrival_time and departure_time
        sensor_data: List of sensor readings
        tidewind_data: List of tide/wind readings

    Returns:
        Aligned data with matched sensor readings, tide, and wind for each timestamp
    """
    arrival = berth_plan["arrival_time"]
    departure = berth_plan["departure_time"]

    if departure < arrival:
        departure += timedelta(days=1)

    aligned = []
    for sensor in sensor_data:
        ts = sensor["timestamp"]
        if ts < arrival or ts > departure:
            continue

        tide = find_nearest(tidewind_data, ts, "tide_m")
        wind = find_nearest(tidewind_data, ts, "wind_speed_kn")

        aligned.append({
            "timestamp": ts,
            "sensor_id": sensor["sensor_id"],
            "tension_kn": sensor["tension_kn"],
            "tide_m": tide,
            "wind_speed_kn": wind,
        })

    return sorted(aligned, key=lambda x: x["timestamp"])


def find_nearest(data: List[Dict[str, Any]], ts: datetime, field: str) -> Optional[float]:
    """Find nearest value for a timestamp."""
    if not data:
        return None
    nearest = min(data, key=lambda x: abs((x["timestamp"] - ts).total_seconds()))
    return nearest.get(field)
