import pandas as pd
from typing import Tuple


def remove_duplicate_events(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    before_count = len(df)
    df = df.drop_duplicates(
        subset=['machine_id', 'start_time', 'end_time', 'event_code'],
        keep='first'
    ).reset_index(drop=True)
    removed = before_count - len(df)
    return df, removed


def validate_time_order(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(['machine_id', 'start_time']).reset_index(drop=True)
    return df


def flag_overlapping_events(df: pd.DataFrame) -> pd.DataFrame:
    df['overlap_flag'] = False
    for machine_id in df['machine_id'].unique():
        machine_df = df[df['machine_id'] == machine_id].sort_values('start_time')
        for i in range(1, len(machine_df)):
            prev_end = machine_df.iloc[i-1]['end_time']
            curr_start = machine_df.iloc[i]['start_time']
            if curr_start < prev_end:
                idx1 = machine_df.iloc[i-1].name
                idx2 = machine_df.iloc[i].name
                df.at[idx1, 'overlap_flag'] = True
                df.at[idx2, 'overlap_flag'] = True
    return df
