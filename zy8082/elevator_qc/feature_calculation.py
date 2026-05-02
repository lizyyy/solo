import pandas as pd
import numpy as np
from typing import Dict, List


def calculate_features(trip: Dict) -> Dict:
    vib = trip["vibration"]
    features = {}
    
    if len(vib) == 0:
        return features
    
    features["trip_id"] = trip["trip_id"]
    features["start_floor"] = trip["start_floor"]
    features["end_floor"] = trip["end_floor"]
    features["direction"] = trip["direction"]
    
    ax = vib["ax"].values
    ay = vib["ay"].values
    az = vib["az"].values
    
    features["peak_ax"] = np.max(np.abs(ax))
    features["peak_ay"] = np.max(np.abs(ay))
    features["peak_az"] = np.max(np.abs(az))
    
    features["rms_ax"] = np.sqrt(np.mean(ax ** 2))
    features["rms_ay"] = np.sqrt(np.mean(ay ** 2))
    features["rms_az"] = np.sqrt(np.mean(az ** 2))
    
    if len(vib) > 1:
        dt = (vib["timestamp"].iloc[1] - vib["timestamp"].iloc[0]).total_seconds()
        if dt > 0:
            jerk_x = np.diff(ax) / dt
            jerk_y = np.diff(ay) / dt
            jerk_z = np.diff(az) / dt
            features["jerk_ax"] = np.max(np.abs(jerk_x))
            features["jerk_ay"] = np.max(np.abs(jerk_y))
            features["jerk_az"] = np.max(np.abs(jerk_z))
        else:
            features["jerk_ax"] = features["jerk_ay"] = features["jerk_az"] = 0
    else:
        features["jerk_ax"] = features["jerk_ay"] = features["jerk_az"] = 0
    
    events = trip["trip_events"]
    if len(events) > 1:
        first_floor = events["floor"].iloc[0]
        last_floor = events["floor"].iloc[-1]
        features["stop_deviation"] = abs(last_floor - trip["end_floor"]) if not pd.isna(trip["end_floor"]) else 0
    else:
        features["stop_deviation"] = 0
    
    door_open_times = trip["door_open_times"]
    door_jitters = []
    for door_ts in door_open_times:
        window_start = door_ts - pd.Timedelta(seconds=2)
        window_end = door_ts + pd.Timedelta(seconds=2)
        door_vib = vib[(vib["timestamp"] >= window_start) & (vib["timestamp"] <= window_end)]
        if len(door_vib) > 0:
            door_jitters.append(np.std(door_vib["ax"]) + np.std(door_vib["ay"]) + np.std(door_vib["az"]))
    features["door_jitter"] = np.mean(door_jitters) if door_jitters else 0
    
    features["duration"] = (trip["end_ts"] - trip["start_ts"]).total_seconds()
    
    return features


def calculate_all_features(trips: List[Dict]) -> pd.DataFrame:
    all_features = []
    for trip in trips:
        features = calculate_features(trip)
        all_features.append(features)
    return pd.DataFrame(all_features)
