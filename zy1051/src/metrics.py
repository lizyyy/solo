import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

@dataclass
class RouteMetrics:
    route_name: str
    total_trips: int
    on_time_trips: int
    on_time_rate: float
    avg_delay_minutes: float
    max_delay_minutes: float
    min_delay_minutes: float
    delay_std: float
    avg_seat_utilization: float
    overloaded_trips: int
    overload_rate: float

@dataclass
class StationMetrics:
    station_name: str
    route_name: str
    total_trips: int
    on_time_rate: float
    avg_delay_minutes: float
    avg_passengers: float
    avg_seats: float

ONTIME_THRESHOLD_MINUTES = 3
SEVERE_DELAY_THRESHOLD = 10
OVERLOAD_THRESHOLD_RATIO = 0.95

def calculate_delay_minutes(planned_time, actual_time) -> Optional[float]:
    if planned_time is None or actual_time is None:
        return None
    if pd.isna(planned_time) or pd.isna(actual_time):
        return None
    
    try:
        if isinstance(planned_time, str):
            planned_time = pd.to_datetime(planned_time)
        if isinstance(actual_time, str):
            actual_time = pd.to_datetime(actual_time)
        
        delta = actual_time - planned_time
        return max(0, delta.total_seconds() / 60)
    except:
        return None

def is_on_time(delay_minutes: Optional[float], threshold: int = ONTIME_THRESHOLD_MINUTES) -> bool:
    if delay_minutes is None:
        return False
    return delay_minutes <= threshold

def calculate_seat_utilization(passengers: int, seats: int) -> Optional[float]:
    if seats <= 0:
        return None
    if pd.isna(passengers) or pd.isna(seats):
        return None
    return passengers / seats

def is_overloaded(passengers: int, seats: int) -> bool:
    if seats <= 0:
        return False
    return passengers > seats

def is_high_utilization(passengers: int, seats: int, threshold: float = OVERLOAD_THRESHOLD_RATIO) -> bool:
    if seats <= 0:
        return False
    return passengers >= seats * threshold

def add_metrics_columns(df: pd.DataFrame) -> pd.DataFrame:
    result_df = df.copy()
    
    result_df['发车延误_分钟'] = result_df.apply(
        lambda row: calculate_delay_minutes(
            row.get('计划发车时间_parsed'),
            row.get('实际发车时间_parsed')
        ),
        axis=1
    )
    
    result_df['到站延误_分钟'] = result_df.apply(
        lambda row: calculate_delay_minutes(
            row.get('计划到站时间_parsed'),
            row.get('实际到站时间_parsed')
        ),
        axis=1
    )
    
    result_df['最大延误_分钟'] = result_df.apply(
        lambda row: max(
            row['发车延误_分钟'] if pd.notna(row['发车延误_分钟']) else 0,
            row['到站延误_分钟'] if pd.notna(row['到站延误_分钟']) else 0
        ),
        axis=1
    )
    
    result_df['是否准点'] = result_df['最大延误_分钟'].apply(
        lambda x: is_on_time(x) if pd.notna(x) else False
    )
    
    result_df['是否严重延误'] = result_df['最大延误_分钟'].apply(
        lambda x: x > SEVERE_DELAY_THRESHOLD if pd.notna(x) else False
    )
    
    result_df['座位利用率'] = result_df.apply(
        lambda row: calculate_seat_utilization(
            row.get('签到人数', 0),
            row.get('座位数', 0)
        ),
        axis=1
    )
    
    result_df['是否超载'] = result_df.apply(
        lambda row: is_overloaded(
            row.get('签到人数', 0),
            row.get('座位数', 0)
        ),
        axis=1
    )
    
    result_df['是否高满载'] = result_df.apply(
        lambda row: is_high_utilization(
            row.get('签到人数', 0),
            row.get('座位数', 0)
        ),
        axis=1
    )
    
    result_df['时段'] = result_df.apply(
        lambda row: categorize_time_period(row),
        axis=1
    )
    
    result_df['是否工作日'] = result_df['日期'].apply(
        lambda x: is_weekday(x)
    )
    
    return result_df

def categorize_time_period(row) -> str:
    planned_time = row.get('计划发车时间_parsed')
    if planned_time is None or pd.isna(planned_time):
        return '其他'
    
    hour = planned_time.hour
    
    if 7 <= hour <= 9:
        return '早高峰'
    elif 17 <= hour <= 19:
        return '晚高峰'
    elif 12 <= hour <= 14:
        return '午间'
    elif 21 <= hour <= 23:
        return '夜间'
    else:
        return '平峰'

def is_weekday(date_str: str) -> bool:
    try:
        date = pd.to_datetime(date_str)
        return date.weekday() < 5
    except:
        return True

def calculate_route_metrics(df: pd.DataFrame) -> Dict[str, RouteMetrics]:
    if df.empty:
        return {}
    
    route_metrics = {}
    routes = df['线路'].unique()
    
    for route in routes:
        route_df = df[df['线路'] == route]
        
        valid_delays = route_df[route_df['最大延误_分钟'].notna()]['最大延误_分钟']
        valid_utilization = route_df[route_df['座位利用率'].notna()]['座位利用率']
        
        total_trips = len(route_df)
        on_time_trips = route_df['是否准点'].sum()
        overloaded_trips = route_df['是否超载'].sum()
        
        metrics = RouteMetrics(
            route_name=route,
            total_trips=total_trips,
            on_time_trips=on_time_trips,
            on_time_rate=on_time_trips / total_trips if total_trips > 0 else 0,
            avg_delay_minutes=valid_delays.mean() if len(valid_delays) > 0 else 0,
            max_delay_minutes=valid_delays.max() if len(valid_delays) > 0 else 0,
            min_delay_minutes=valid_delays.min() if len(valid_delays) > 0 else 0,
            delay_std=valid_delays.std() if len(valid_delays) > 0 else 0,
            avg_seat_utilization=valid_utilization.mean() if len(valid_utilization) > 0 else 0,
            overloaded_trips=overloaded_trips,
            overload_rate=overloaded_trips / total_trips if total_trips > 0 else 0
        )
        
        route_metrics[route] = metrics
    
    return route_metrics

def calculate_time_period_metrics(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    
    period_groups = df.groupby('时段').agg({
        '最大延误_分钟': ['count', 'mean', 'std', 'max'],
        '是否准点': 'mean',
        '是否严重延误': 'mean',
        '座位利用率': 'mean',
        '是否超载': 'mean',
        '签到人数': 'mean',
        '座位数': 'mean'
    }).round(3)
    
    period_groups.columns = ['_'.join(col).strip() for col in period_groups.columns.values]
    period_groups = period_groups.rename(columns={
        '最大延误_分钟_count': '记录数',
        '最大延误_分钟_mean': '平均延误_分钟',
        '最大延误_分钟_std': '延误标准差',
        '最大延误_分钟_max': '最大延误_分钟',
        '是否准点_mean': '准点率',
        '是否严重延误_mean': '严重延误率',
        '座位利用率_mean': '平均座位利用率',
        '是否超载_mean': '超载率',
        '签到人数_mean': '平均签到人数',
        '座位数_mean': '平均座位数'
    })
    
    return period_groups

def calculate_daily_metrics(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    
    daily_groups = df.groupby('日期').agg({
        '最大延误_分钟': ['count', 'mean', 'std', 'max'],
        '是否准点': 'mean',
        '是否严重延误': 'sum',
        '座位利用率': 'mean',
        '是否超载': 'sum',
        '签到人数': 'sum'
    }).round(3)
    
    daily_groups.columns = ['_'.join(col).strip() for col in daily_groups.columns.values]
    daily_groups = daily_groups.rename(columns={
        '最大延误_分钟_count': '记录数',
        '最大延误_分钟_mean': '平均延误_分钟',
        '最大延误_分钟_std': '延误标准差',
        '最大延误_分钟_max': '最大延误_分钟',
        '是否准点_mean': '准点率',
        '是否严重延误_sum': '严重延误次数',
        '座位利用率_mean': '平均座位利用率',
        '是否超载_sum': '超载次数',
        '签到人数_sum': '总签到人数'
    })
    
    return daily_groups.sort_index()

def filter_data(
    df: pd.DataFrame,
    date_range: Tuple[str, str] = None,
    routes: List[str] = None,
    stations: List[str] = None,
    time_periods: List[str] = None,
    weekdays_only: bool = False,
    remark_keyword: str = None
) -> pd.DataFrame:
    result_df = df.copy()
    
    if date_range and len(date_range) == 2:
        start_date, end_date = date_range
        if start_date and end_date:
            result_df = result_df[
                (result_df['日期'] >= start_date) & 
                (result_df['日期'] <= end_date)
            ]
    
    if routes:
        result_df = result_df[result_df['线路'].isin(routes)]
    
    if stations:
        result_df = result_df[result_df['站点'].isin(stations)]
    
    if time_periods:
        result_df = result_df[result_df['时段'].isin(time_periods)]
    
    if weekdays_only:
        result_df = result_df[result_df['是否工作日'] == True]
    
    if remark_keyword and remark_keyword.strip():
        keyword = remark_keyword.strip()
        result_df = result_df[
            result_df['司机备注'].astype(str).str.contains(keyword, case=False, na=False)
        ]
    
    return result_df

def get_overview_stats(df: pd.DataFrame) -> Dict:
    if df.empty:
        return {
            '总记录数': 0,
            '线路数': 0,
            '站点数': 0,
            '平均准点率': 0,
            '平均延误_分钟': 0,
            '平均座位利用率': 0,
            '超载次数': 0,
            '严重延误次数': 0
        }
    
    valid_delays = df[df['最大延误_分钟'].notna()]['最大延误_分钟']
    valid_utilization = df[df['座位利用率'].notna()]['座位利用率']
    
    return {
        '总记录数': len(df),
        '线路数': df['线路'].nunique(),
        '站点数': df['站点'].nunique(),
        '平均准点率': df['是否准点'].mean() * 100,
        '平均延误_分钟': valid_delays.mean() if len(valid_delays) > 0 else 0,
        '平均座位利用率': valid_utilization.mean() * 100 if len(valid_utilization) > 0 else 0,
        '超载次数': df['是否超载'].sum(),
        '严重延误次数': df['是否严重延误'].sum()
    }
