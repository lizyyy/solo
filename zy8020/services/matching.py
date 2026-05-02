import pandas as pd
import numpy as np
from datetime import timedelta, datetime

def add_date_to_schedule(schedule_df, reference_date):
    df = schedule_df.copy()
    df['计划到站时间_full'] = pd.to_datetime(reference_date + ' ' + df['计划到站时间'])
    df['计划发车时间_full'] = pd.to_datetime(reference_date + ' ' + df['计划发车时间'])
    df['计划发车时间_full'] = df['计划发车时间_full'].fillna(df['计划到站时间_full'])
    
    mask = df['计划到站时间_full'].dt.hour < 6
    df.loc[mask, '计划到站时间_full'] += timedelta(days=1)
    mask = df['计划发车时间_full'].dt.hour < 6
    df.loc[mask, '计划发车时间_full'] += timedelta(days=1)
    
    return df

def match_schedule_with_gps(schedule_df, gps_df, max_time_diff=30):
    schedule_df = schedule_df.copy()
    gps_df = gps_df.copy()
    
    matched_results = []
    
    line_directions = schedule_df[['线路编号', '方向']].drop_duplicates()
    
    for _, (line, direction) in line_directions.iterrows():
        line_schedule = schedule_df[(schedule_df['线路编号'] == line) & (schedule_df['方向'] == direction)]
        line_gps = gps_df[(gps_df['线路编号'] == line) & (gps_df['方向'] == direction)]
        
        stations = line_schedule['站点名称'].unique()
        
        for station in stations:
            station_schedule = line_schedule[line_schedule['站点名称'] == station].sort_values('计划到站时间_full')
            station_gps = line_gps[line_gps['站点名称'] == station].sort_values('到站时间')
            
            schedule_times = station_schedule['计划到站时间_full'].values
            gps_times = station_gps['到站时间'].values
            
            assigned = set()
            
            for i, gps_time in enumerate(gps_times):
                min_diff = None
                best_idx = -1
                
                for j, schedule_time in enumerate(schedule_times):
                    if j in assigned:
                        continue
                    
                    diff_minutes = abs((gps_time - schedule_time) / timedelta(minutes=1))
                    
                    if diff_minutes <= max_time_diff:
                        if min_diff is None or diff_minutes < min_diff:
                            min_diff = diff_minutes
                            best_idx = j
                
                if best_idx >= 0:
                    assigned.add(best_idx)
                    schedule_row = station_schedule.iloc[best_idx]
                    gps_row = station_gps.iloc[i]
                    
                    matched_results.append({
                        '线路编号': line,
                        '方向': direction,
                        '站点名称': station,
                        '班次号': schedule_row['班次号'],
                        '计划到站时间': schedule_row['计划到站时间'],
                        '实际到站时间': gps_row['到站时间'],
                        '计划发车时间': schedule_row['计划发车时间'],
                        '实际发车时间': gps_row['离站时间'],
                        '车辆编号': gps_row['车辆编号'],
                        '到站偏差(分钟)': round(min_diff, 1),
                        'GPS经度': gps_row.get('GPS经度'),
                        'GPS纬度': gps_row.get('GPS纬度'),
                        '站点顺序': schedule_row['站点顺序']
                    })
    
    matched_df = pd.DataFrame(matched_results)
    return matched_df

def calculate_headways(matched_df):
    result = []
    
    for (line, direction, station), group in matched_df.groupby(['线路编号', '方向', '站点名称']):
        group = group.sort_values('实际到站时间').reset_index(drop=True)
        
        for i in range(1, len(group)):
            prev = group.iloc[i-1]
            curr = group.iloc[i]
            
            headway = (curr['实际到站时间'] - prev['实际到站时间']).total_seconds() / 60
            
            result.append({
                '线路编号': line,
                '方向': direction,
                '站点名称': station,
                '前一班次号': prev['班次号'],
                '当前班次号': curr['班次号'],
                '前一班到站时间': prev['实际到站时间'],
                '当前班到站时间': curr['实际到站时间'],
                '发车间隔(分钟)': round(headway, 1),
                '站点顺序': curr['站点顺序']
            })
    
    return pd.DataFrame(result)

def identify_missing_trips(schedule_df, matched_df, max_time_diff=30):
    missing = []
    
    for (line, direction, station), group in schedule_df.groupby(['线路编号', '方向', '站点名称']):
        matched_at_station = matched_df[
            (matched_df['线路编号'] == line) & 
            (matched_df['方向'] == direction) & 
            (matched_df['站点名称'] == station)
        ]
        
        matched_trips = set(matched_at_station['班次号'])
        
        for _, row in group.iterrows():
            if row['班次号'] not in matched_trips:
                missing.append({
                    '线路编号': line,
                    '方向': direction,
                    '站点名称': station,
                    '班次号': row['班次号'],
                    '计划到站时间': row['计划到站时间'],
                    '计划发车时间': row['计划发车时间'],
                    '站点顺序': row['站点顺序'],
                    '状态': '漏发'
                })
    
    return pd.DataFrame(missing)