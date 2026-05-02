import pandas as pd
import json
from datetime import datetime

def validate_schedule(df):
    errors = []
    required_cols = ['线路编号', '方向', '站点名称', '站点顺序', '计划到站时间', '班次号']
    
    for col in required_cols:
        if col not in df.columns:
            errors.append(f"缺少必填列: {col}")
    
    if '站点顺序' in df.columns and not df['站点顺序'].dtype == int:
        errors.append("站点顺序必须为整数类型")
    
    if '计划到站时间' in df.columns:
        try:
            pd.to_datetime(df['计划到站时间'], format='%H:%M:%S', errors='raise')
        except Exception as e:
            errors.append(f"计划到站时间格式错误: {str(e)}")
    
    if '计划发车时间' in df.columns:
        try:
            mask = df['计划发车时间'].notna()
            if mask.any():
                pd.to_datetime(df.loc[mask, '计划发车时间'], format='%H:%M:%S', errors='raise')
        except Exception as e:
            errors.append(f"计划发车时间格式错误: {str(e)}")
    
    return errors

def validate_gps(df):
    errors = []
    required_cols = ['线路编号', '方向', '站点名称', '车辆编号', '到站时间']
    
    for col in required_cols:
        if col not in df.columns:
            errors.append(f"缺少必填列: {col}")
    
    if '到站时间' in df.columns:
        try:
            pd.to_datetime(df['到站时间'], errors='raise')
        except Exception as e:
            errors.append(f"到站时间格式错误: {str(e)}")
    
    if '离站时间' in df.columns:
        try:
            mask = df['离站时间'].notna()
            if mask.any():
                pd.to_datetime(df.loc[mask, '离站时间'], errors='raise')
        except Exception as e:
            errors.append(f"离站时间格式错误: {str(e)}")
    
    if 'GPS经度' in df.columns:
        if not ((df['GPS经度'] >= -180) & (df['GPS经度'] <= 180)).all():
            errors.append("GPS经度范围必须在[-180, 180]之间")
    
    if 'GPS纬度' in df.columns:
        if not ((df['GPS纬度'] >= -90) & (df['GPS纬度'] <= 90)).all():
            errors.append("GPS纬度范围必须在[-90, 90]之间")
    
    return errors

def validate_events(data):
    errors = []
    
    if not isinstance(data, list):
        errors.append("事件数据必须为JSON数组格式")
        return errors
    
    required_fields = ['车辆编号', '事件类型', '事件描述', '开始时间', '线路编号', '方向']
    
    for idx, event in enumerate(data):
        for field in required_fields:
            if field not in event:
                errors.append(f"第{idx+1}条事件缺少必填字段: {field}")
        
        if '开始时间' in event:
            try:
                datetime.strptime(event['开始时间'], '%Y-%m-%d %H:%M:%S')
            except ValueError:
                errors.append(f"第{idx+1}条事件开始时间格式错误")
        
        if '结束时间' in event and event['结束时间']:
            try:
                datetime.strptime(event['结束时间'], '%Y-%m-%d %H:%M:%S')
            except ValueError:
                errors.append(f"第{idx+1}条事件结束时间格式错误")
    
    return errors

def load_schedule(file_path):
    try:
        df = pd.read_csv(file_path, dtype={'线路编号': str, '站点顺序': int})
        errors = validate_schedule(df)
        return df, errors
    except Exception as e:
        return None, [f"文件读取失败: {str(e)}"]

def load_gps(file_path):
    try:
        df = pd.read_csv(file_path, dtype={'线路编号': str})
        df['到站时间'] = pd.to_datetime(df['到站时间'])
        if '离站时间' in df.columns:
            df['离站时间'] = pd.to_datetime(df['离站时间'])
        errors = validate_gps(df)
        return df, errors
    except Exception as e:
        return None, [f"文件读取失败: {str(e)}"]

def load_events(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        errors = validate_events(data)
        return data, errors
    except Exception as e:
        return None, [f"文件读取失败: {str(e)}"]