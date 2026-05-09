import pandas as pd
from datetime import datetime, timedelta
from config import HOLIDAYS_2026, HOLIDAY_MULTIPLIER, WEEKEND_MULTIPLIER, WORKDAY_MULTIPLIER


def classify_date_type(dt):
    date_str = dt.strftime('%Y-%m-%d')
    if date_str in HOLIDAYS_2026:
        return 'holiday', HOLIDAYS_2026[date_str]

    weekday = dt.weekday()
    if weekday >= 5:
        return 'weekend', '周末'

    return 'workday', '工作日'


def get_date_multiplier(date_type):
    if date_type == 'holiday':
        return HOLIDAY_MULTIPLIER
    elif date_type == 'weekend':
        return WEEKEND_MULTIPLIER
    else:
        return WORKDAY_MULTIPLIER


def enrich_records_with_holiday_features(records_df):
    if len(records_df) == 0:
        return records_df

    df = records_df.copy()

    df['date_type'] = df['drop_time'].apply(
        lambda x: classify_date_type(x)[0]
    )
    df['date_name'] = df['drop_time'].apply(
        lambda x: classify_date_type(x)[1]
    )
    df['multiplier'] = df['date_type'].apply(get_date_multiplier)
    df['adjusted_volume'] = df['volume_l'] * df['multiplier']
    df['weekday'] = df['drop_time'].apply(lambda x: x.weekday())
    df['date_only'] = df['drop_time'].apply(lambda x: x.strftime('%Y-%m-%d'))

    return df


def get_holiday_days_in_window(start_date, window_days):
    holidays = []
    start_dt = pd.to_datetime(start_date)

    for i in range(window_days):
        current_dt = start_dt + timedelta(days=i)
        date_type, date_name = classify_date_type(current_dt)
        holidays.append({
            'date': current_dt.strftime('%Y-%m-%d'),
            'date_type': date_type,
            'date_name': date_name,
            'multiplier': get_date_multiplier(date_type)
        })

    return pd.DataFrame(holidays)


def calculate_workday_baseline(records_df, bin_id=None):
    df = records_df.copy()
    if len(df) == 0:
        return 0.0

    if bin_id:
        df = df[df['bin_id'] == bin_id]

    df['date_only'] = df['drop_time'].apply(lambda x: x.strftime('%Y-%m-%d'))
    daily_totals = df.groupby('date_only')['volume_l'].sum().reset_index()
    daily_totals['dt'] = pd.to_datetime(daily_totals['date_only'])
    daily_totals['date_type'] = daily_totals['dt'].apply(
        lambda x: classify_date_type(x)[0]
    )

    workday_days = daily_totals[daily_totals['date_type'] == 'workday']
    if len(workday_days) > 0:
        return workday_days['volume_l'].mean()

    return daily_totals['volume_l'].mean()
