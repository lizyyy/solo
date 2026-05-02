import pandas as pd
from typing import List, Dict, Any


def classify_root_causes(events_df: pd.DataFrame, sensor_data: List[Dict[str, Any]]) -> pd.DataFrame:
    events_df['root_cause'] = None
    events_df['root_cause_category'] = None
    
    for idx, event in events_df.iterrows():
        event_code = str(event.get('event_code', ''))
        description = str(event.get('description', '')).lower()
        machine_id = event['machine_id']
        event_start = event['start_time']
        event_end = event['end_time']
        
        root_cause, category = _classify_single_event(
            event_code, description, machine_id, event_start, event_end, sensor_data
        )
        events_df.at[idx, 'root_cause'] = root_cause
        events_df.at[idx, 'root_cause_category'] = category
    
    return events_df


def _classify_single_event(event_code: str, description: str, machine_id: str, 
                          event_start, event_end, sensor_data: List[Dict[str, Any]]) -> tuple:
    warp_keywords = ['断经', '经停', 'warp', '经纱']
    weft_keywords = ['纬停', '断纬', 'weft', '引纬']
    beam_keywords = ['换轴', '经轴', 'beam', '上轴']
    sensor_keywords = ['传感器', 'sensor', '误报', '误动作']
    mechanical_keywords = ['机械', '机械故障', 'mechanical', '齿轮', '轴承']
    
    for kw in warp_keywords:
        if kw in description or kw in event_code:
            return '断经停台', '断经'
    
    for kw in weft_keywords:
        if kw in description or kw in event_code:
            return '纬纱停台', '纬停'
    
    for kw in beam_keywords:
        if kw in description or kw in event_code:
            return '经轴更换', '换轴'
    
    for kw in sensor_keywords:
        if kw in description or kw in event_code:
            return '传感器误报', '传感器误报'
    
    sensor_anomaly = _check_sensor_anomaly(machine_id, event_start, event_end, sensor_data)
    if sensor_anomaly:
        return '传感器异常触发', '传感器误报'
    
    for kw in mechanical_keywords:
        if kw in description or kw in event_code:
            return '机械故障', '机械'
    
    return '其他原因', '其他'


def _check_sensor_anomaly(machine_id: str, event_start, event_end, 
                         sensor_data: List[Dict[str, Any]]) -> bool:
    relevant_sensors = [
        s for s in sensor_data 
        if s.get('machine_id') == machine_id 
        and event_start <= s['timestamp'] <= event_end
    ]
    
    if len(relevant_sensors) < 2:
        return False
    
    values = [s.get('value', 0) for s in relevant_sensors]
    max_val = max(values)
    min_val = min(values)
    
    if max_val - min_val > 50 and len(set(values)) > len(values) * 0.5:
        return True
    
    return False
