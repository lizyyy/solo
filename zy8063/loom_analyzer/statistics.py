import pandas as pd
from typing import Dict, Any


def calculate_summary_statistics(events_df: pd.DataFrame) -> Dict[str, Any]:
    total_events = len(events_df)
    total_downtime = events_df['duration_minutes'].sum()
    
    by_machine = events_df.groupby('machine_id').agg({
        'duration_minutes': ['sum', 'count'],
    }).round(2)
    by_machine.columns = ['total_downtime_min', 'event_count']
    
    by_cause = events_df.groupby(['root_cause_category', 'root_cause']).agg({
        'duration_minutes': ['sum', 'count'],
    }).round(2)
    by_cause.columns = ['total_downtime_min', 'event_count']
    
    by_shift = events_df.groupby(['shift_date', 'shift_name']).agg({
        'duration_minutes': ['sum', 'count'],
    }).round(2)
    by_shift.columns = ['total_downtime_min', 'event_count']
    
    return {
        'total_events': total_events,
        'total_downtime_min': round(total_downtime, 2),
        'by_machine': by_machine.to_dict('index'),
        'by_cause': by_cause.to_dict('index'),
        'by_shift': by_shift.to_dict('index'),
    }


def create_downtime_summary_df(events_df: pd.DataFrame) -> pd.DataFrame:
    summary_cols = [
        'machine_id', 'shift_name', 'shift_date',
        'root_cause_category', 'root_cause',
        'start_time', 'end_time', 'duration_minutes',
        'event_code', 'description'
    ]
    available_cols = [col for col in summary_cols if col in events_df.columns]
    return events_df[available_cols].copy()
