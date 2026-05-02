import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any


def align_events_to_shifts(events_df: pd.DataFrame, shifts: List[Dict[str, Any]]) -> pd.DataFrame:
    events_df['shift_id'] = None
    events_df['shift_name'] = None
    events_df['shift_date'] = None
    
    for _, event in events_df.iterrows():
        event_start = event['start_time']
        event_midpoint = event_start + (event['end_time'] - event_start) / 2
        
        for shift in shifts:
            shift_start = shift['start_time']
            shift_end = shift['end_time']
            
            if shift_start <= event_midpoint < shift_end:
                events_df.at[_, 'shift_id'] = shift['id']
                events_df.at[_, 'shift_name'] = shift['name']
                events_df.at[_, 'shift_date'] = shift['date']
                break
    
    return events_df


def get_shifts_for_date(shifts: List[Dict[str, Any]], target_date: str) -> List[Dict[str, Any]]:
    date_shifts = []
    target_dt = datetime.fromisoformat(target_date).date()
    
    for shift in shifts:
        shift_date = datetime.fromisoformat(shift['date']).date()
        if shift_date == target_dt:
            date_shifts.append(shift)
    
    return sorted(date_shifts, key=lambda x: x['start_time'])
