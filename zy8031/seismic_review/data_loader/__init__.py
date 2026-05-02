import csv
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


@dataclass
class Station:
    network: str
    station: str
    latitude: float
    longitude: float
    elevation: float


@dataclass
class Event:
    event_id: str
    origin_time: str
    latitude: float
    longitude: float
    depth: float
    magnitude: float
    arrivals: List[Dict] = field(default_factory=list)


@dataclass
class WaveformData:
    network: str
    station: str
    channel: str
    start_time: str
    sampling_rate: float
    data: np.ndarray
    has_gap: bool = False
    gap_info: Optional[Dict] = None


def load_stations(csv_path: str) -> List[Station]:
    stations = []
    df = pd.read_csv(csv_path)
    required_cols = {"network", "station", "latitude", "longitude", "elevation"}
    if not required_cols.issubset(df.columns):
        missing = required_cols - set(df.columns)
        raise ValueError(f"station.csv missing columns: {missing}")

    for _, row in df.iterrows():
        stations.append(Station(
            network=str(row["network"]),
            station=str(row["station"]),
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            elevation=float(row["elevation"])
        ))
    return stations


def load_events(json_path: str) -> List[Event]:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        events_data = data.get("events", [data])
    elif isinstance(data, list):
        events_data = data
    else:
        raise ValueError("events.json format not recognized")

    events = []
    for item in events_data:
        arrivals = item.get("arrivals", [])
        events.append(Event(
            event_id=str(item["event_id"]),
            origin_time=str(item["origin_time"]),
            latitude=float(item["latitude"]),
            longitude=float(item["longitude"]),
            depth=float(item["depth"]),
            magnitude=float(item["magnitude"]),
            arrivals=arrivals
        ))
    return events


def _detect_and_handle_gaps(
    data: np.ndarray,
    times: np.ndarray,
    expected_dt: float,
    tolerance: float = 0.1
) -> Tuple[np.ndarray, np.ndarray, bool, Optional[Dict]]:
    if len(data) < 2:
        return data, times, False, None

    dt_diff = np.diff(times)
    expected_interval = expected_dt
    gap_indices = np.where(np.abs(dt_diff - expected_interval) > tolerance * expected_interval)[0]

    if len(gap_indices) == 0:
        return data, times, False, None

    gap_info = {
        "num_gaps": len(gap_indices),
        "gap_indices": gap_indices.tolist(),
        "gap_durations": (dt_diff[gap_indices] - expected_interval).tolist()
    }
    has_gap = True

    mask = np.ones(len(data), dtype=bool)
    mask[gap_indices + 1] = False
    data_clean = data[mask]
    times_clean = times[mask]

    return data_clean, times_clean, has_gap, gap_info


def _resample_to_common_rate(
    data: np.ndarray,
    times: np.ndarray,
    target_rate: float
) -> Tuple[np.ndarray, np.ndarray, float]:
    if len(data) < 2:
        return data, times, target_rate

    duration = times[-1] - times[0]
    n_points = int(duration * target_rate) + 1

    from scipy.interpolate import interp1d
    interp_func = interp1d(times, data, kind="linear", fill_value="extrapolate")
    new_times = np.linspace(times[0], times[-1], n_points)
    new_data = interp_func(new_times)

    return new_data, new_times, target_rate


def load_waveforms(
    waveform_dir: str,
    stations: List[Station],
    event: Event,
    window_before: float = 30.0,
    window_after: float = 60.0,
    common_sampling_rate: Optional[float] = None
) -> Dict[str, Dict[str, WaveformData]]:
    from datetime import datetime, timedelta
    import dateutil.parser

    event_time = dateutil.parser.parse(event.origin_time)

    waveform_dir_path = Path(waveform_dir)
    if not waveform_dir_path.exists():
        raise FileNotFoundError(f"Waveform directory not found: {waveform_dir}")

    station_dict = {f"{s.network}.{s.station}": s for s in stations}
    result: Dict[str, Dict[str, WaveformData]] = {}

    for csv_file in waveform_dir_path.glob("*.csv"):
        filename = csv_file.stem
        parts = filename.split("_")
        if len(parts) < 3:
            continue

        net_sta = f"{parts[0]}.{parts[1]}"
        channel = parts[2] if len(parts) > 2 else "UNK"

        if net_sta not in station_dict:
            continue

        df = pd.read_csv(csv_file)
        if "time" not in df.columns or "data" not in df.columns:
            continue

        times_raw = df["time"].values
        data_raw = df["data"].values

        if isinstance(times_raw[0], str):
            times_dt = np.array([dateutil.parser.parse(t).timestamp() for t in times_raw])
        else:
            times_dt = times_raw.astype(float)

        window_start = event_time.timestamp() - window_before
        window_end = event_time.timestamp() + window_after

        mask = (times_dt >= window_start) & (times_dt <= window_end)
        if not np.any(mask):
            continue

        data_window = data_raw[mask]
        times_window = times_dt[mask]

        if len(times_window) < 2:
            continue

        dt_estimate = (times_window[-1] - times_window[0]) / (len(times_window) - 1)
        sampling_rate_estimate = 1.0 / dt_estimate if dt_estimate > 0 else 100.0

        if common_sampling_rate is not None:
            data_window, times_window, actual_rate = _resample_to_common_rate(
                data_window, times_window, common_sampling_rate
            )
        else:
            actual_rate = sampling_rate_estimate

            has_gap, gap_info = False, None
            if len(times_window) >= 2:
                data_window, times_window, has_gap, gap_info = _detect_and_handle_gaps(
                    data_window, times_window, dt_estimate
                )

        start_time_str = datetime.fromtimestamp(times_window[0]).isoformat()

        if net_sta not in result:
            result[net_sta] = {}

        result[net_sta][channel] = WaveformData(
            network=parts[0],
            station=parts[1],
            channel=channel,
            start_time=start_time_str,
            sampling_rate=actual_rate,
            data=data_window,
            has_gap=has_gap,
            gap_info=gap_info
        )

    return result
