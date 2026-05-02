import pandas as pd
import numpy as np
from typing import List, Dict


def segment_trips(trips_df: pd.DataFrame, vib_df: pd.DataFrame) -> List[Dict]:
    trips = []
    
    for trip_id in trips_df["trip_id"].unique():
        trip_data = trips_df[trips_df["trip_id"] == trip_id].sort_values("timestamp")
        start_ts = trip_data["timestamp"].min()
        end_ts = trip_data["timestamp"].max()
        
        trip_vib = vib_df[(vib_df["timestamp"] >= start_ts) & (vib_df["timestamp"] <= end_ts)].copy()
        
        start_floor = trip_data["floor"].iloc[0]
        end_floor = trip_data["floor"].iloc[-1]
        direction = trip_data["direction"].iloc[0]
        
        door_open_times = trip_data[trip_data["door_open"] == True]["timestamp"].tolist()
        
        trip = {
            "trip_id": trip_id,
            "start_ts": start_ts,
            "end_ts": end_ts,
            "start_floor": start_floor,
            "end_floor": end_floor,
            "direction": direction,
            "vibration": trip_vib,
            "door_open_times": door_open_times,
            "trip_events": trip_data
        }
        trips.append(trip)
    
    return trips
