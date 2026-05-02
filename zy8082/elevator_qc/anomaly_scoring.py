import pandas as pd
import numpy as np
from typing import Dict, List


def apply_rules(features_df: pd.DataFrame, rules: Dict) -> List[Dict]:
    alerts = []
    
    for _, row in features_df.iterrows():
        trip_alerts = check_trip_rules(row, rules)
        alerts.extend(trip_alerts)
    
    return alerts


def check_trip_rules(features: pd.Series, rules: Dict) -> List[Dict]:
    alerts = []
    
    peak_rules = rules.get("peak", {})
    if features.get("peak_ax", 0) > peak_rules.get("ax", 2.0):
        alerts.append(create_alert(features, "peak_ax", features["peak_ax"], peak_rules.get("ax", 2.0), "high"))
    if features.get("peak_ay", 0) > peak_rules.get("ay", 2.0):
        alerts.append(create_alert(features, "peak_ay", features["peak_ay"], peak_rules.get("ay", 2.0), "high"))
    if features.get("peak_az", 0) > peak_rules.get("az", 2.0):
        alerts.append(create_alert(features, "peak_az", features["peak_az"], peak_rules.get("az", 2.0), "high"))
    
    rms_rules = rules.get("rms", {})
    if features.get("rms_ax", 0) > rms_rules.get("ax", 0.5):
        alerts.append(create_alert(features, "rms_ax", features["rms_ax"], rms_rules.get("ax", 0.5), "medium"))
    if features.get("rms_ay", 0) > rms_rules.get("ay", 0.5):
        alerts.append(create_alert(features, "rms_ay", features["rms_ay"], rms_rules.get("ay", 0.5), "medium"))
    if features.get("rms_az", 0) > rms_rules.get("az", 0.5):
        alerts.append(create_alert(features, "rms_az", features["rms_az"], rms_rules.get("az", 0.5), "medium"))
    
    jerk_rules = rules.get("jerk", {})
    if features.get("jerk_ax", 0) > jerk_rules.get("ax", 10.0):
        alerts.append(create_alert(features, "jerk_ax", features["jerk_ax"], jerk_rules.get("ax", 10.0), "high"))
    
    stop_rules = rules.get("stop_deviation", {})
    if features.get("stop_deviation", 0) > stop_rules.get("max", 0.5):
        alerts.append(create_alert(features, "stop_deviation", features["stop_deviation"], stop_rules.get("max", 0.5), "high"))
    
    door_rules = rules.get("door_jitter", {})
    if features.get("door_jitter", 0) > door_rules.get("max", 1.0):
        alerts.append(create_alert(features, "door_jitter", features["door_jitter"], door_rules.get("max", 1.0), "medium"))
    
    return alerts


def create_alert(features: pd.Series, metric: str, value: float, threshold: float, severity: str) -> Dict:
    return {
        "trip_id": features["trip_id"],
        "start_floor": features["start_floor"],
        "end_floor": features["end_floor"],
        "direction": features["direction"],
        "metric": metric,
        "value": value,
        "threshold": threshold,
        "severity": severity
    }
