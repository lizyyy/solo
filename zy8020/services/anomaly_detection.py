import pandas as pd
from datetime import timedelta

def detect_bunching(headway_df, bunching_threshold=3):
    anomalies = headway_df[headway_df['发车间隔(分钟)'] <= bunching_threshold].copy()
    anomalies['异常类型'] = '串车'
    anomalies['异常描述'] = f'发车间隔小于{bunching_threshold}分钟，可能发生串车'
    return anomalies

def detect_large_headway(headway_df, large_threshold=20):
    anomalies = headway_df[headway_df['发车间隔(分钟)'] >= large_threshold].copy()
    anomalies['异常类型'] = '大间隔'
    anomalies['异常描述'] = f'发车间隔大于{large_threshold}分钟，存在大间隔'
    return anomalies

def detect_headway_deviation(headway_df, schedule_df, normal_headway_range=(8, 12)):
    anomalies = []
    
    for (line, direction), group in headway_df.groupby(['线路编号', '方向']):
        avg_headway = group['发车间隔(分钟)'].mean()
        
        for _, row in group.iterrows():
            if row['发车间隔(分钟)'] < normal_headway_range[0]:
                anomalies.append({
                    **row.to_dict(),
                    '异常类型': '发车间隔偏小',
                    '异常描述': f'发车间隔{row["发车间隔(分钟)"]}分钟，低于正常范围{normal_headway_range[0]}-{normal_headway_range[1]}分钟'
                })
            elif row['发车间隔(分钟)'] > normal_headway_range[1]:
                anomalies.append({
                    **row.to_dict(),
                    '异常类型': '发车间隔偏大',
                    '异常描述': f'发车间隔{row["发车间隔(分钟)"]}分钟，高于正常范围{normal_headway_range[0]}-{normal_headway_range[1]}分钟'
                })
    
    return pd.DataFrame(anomalies)

def detect_missing_trips(missing_df):
    anomalies = missing_df.copy()
    anomalies['异常类型'] = '漏发'
    anomalies['异常描述'] = '计划班次未匹配到实际到站记录'
    return anomalies

def detect_arrival_deviation(matched_df, deviation_threshold=5):
    anomalies = matched_df[matched_df['到站偏差(分钟)'] >= deviation_threshold].copy()
    anomalies['异常类型'] = '到站偏差'
    anomalies['异常描述'] = anomalies['到站偏差(分钟)'].apply(
        lambda x: f'到站偏差{x}分钟，超过阈值{deviation_threshold}分钟'
    )
    return anomalies

def find_event_causes(anomalies_df, events_data):
    result = []
    
    for _, anomaly in anomalies_df.iterrows():
        causes = []
        
        for event in events_data:
            if event['事件类型'] == '正常':
                continue
            
            if event['线路编号'] != anomaly['线路编号']:
                continue
            
            if event['方向'] != anomaly.get('方向', ''):
                continue
            
            if '实际到站时间' in anomaly and pd.notna(anomaly['实际到站时间']):
                anomaly_time = anomaly['实际到站时间']
                if isinstance(anomaly_time, str):
                    anomaly_time = pd.to_datetime(anomaly_time)
                event_start = pd.to_datetime(event['开始时间'])
                event_end = pd.to_datetime(event['结束时间']) if event.get('结束时间') else anomaly_time + timedelta(hours=1)
                
                if event_start <= anomaly_time <= event_end:
                    causes.append({
                        '事件类型': event['事件类型'],
                        '事件描述': event['事件描述'],
                        '影响站点': event.get('影响站点', ''),
                        '车辆编号': event['车辆编号']
                    })
            
            elif '班次号' in anomaly:
                if '车辆编号' in anomaly and anomaly['车辆编号'] == event['车辆编号']:
                    causes.append({
                        '事件类型': event['事件类型'],
                        '事件描述': event['事件描述'],
                        '影响站点': event.get('影响站点', ''),
                        '车辆编号': event['车辆编号']
                    })
        
        result.append({
            **anomaly.to_dict(),
            '可能原因': str(causes) if causes else '未找到相关事件原因'
        })
    
    return pd.DataFrame(result)

def detect_midnight_crossing(matched_df):
    anomalies = []
    
    for (line, direction, vehicle), group in matched_df.groupby(['线路编号', '方向', '车辆编号']):
        group = group.sort_values('实际到站时间')
        
        for i in range(1, len(group)):
            prev_time = group.iloc[i-1]['实际到站时间']
            curr_time = group.iloc[i]['实际到站时间']
            
            if prev_time.date() != curr_time.date():
                time_diff = (curr_time - prev_time).total_seconds() / 60
                
                if time_diff > 120:
                    anomalies.append({
                        '线路编号': line,
                        '方向': direction,
                        '车辆编号': vehicle,
                        '站点名称': group.iloc[i]['站点名称'],
                        '班次号': group.iloc[i]['班次号'],
                        '实际到站时间': curr_time,
                        '前一班到站时间': prev_time,
                        '站点顺序': group.iloc[i]['站点顺序'],
                        '异常类型': '跨午夜数据',
                        '异常描述': f'跨午夜运行，间隔{round(time_diff, 1)}分钟',
                        '可能原因': '跨午夜数据，需确认数据完整性'
                    })
    
    return pd.DataFrame(anomalies)

def run_all_detection(matched_df, headway_df, missing_df, events_data, config):
    all_anomalies = []
    
    bunching = detect_bunching(headway_df, config.get('bunching_threshold', 3))
    all_anomalies.append(bunching)
    
    large_headway = detect_large_headway(headway_df, config.get('large_threshold', 20))
    all_anomalies.append(large_headway)
    
    headway_dev = detect_headway_deviation(headway_df, None, config.get('normal_headway_range', (8, 12)))
    all_anomalies.append(headway_dev)
    
    missing = detect_missing_trips(missing_df)
    all_anomalies.append(missing)
    
    arrival_dev = detect_arrival_deviation(matched_df, config.get('deviation_threshold', 5))
    all_anomalies.append(arrival_dev)
    
    midnight = detect_midnight_crossing(matched_df)
    all_anomalies.append(midnight)
    
    combined = pd.concat(all_anomalies, ignore_index=True)
    
    if events_data:
        combined = find_event_causes(combined, events_data)
    else:
        combined['可能原因'] = '无事件数据'
    
    return combined