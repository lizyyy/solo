import pandas as pd
import json
from datetime import datetime
from typing import List, Dict

def parse_decibel_jsonl(file_path: str) -> pd.DataFrame:
    """
    解析分贝仪JSONL文件
    
    期望的JSONL每行格式:
    {
        "timestamp": "2023-05-01T22:30:00",
        "location": "幸福小区1号楼",
        "db_value": 75.5,
        "is_peak": false,
        "measurement_type": "continuous"
    }
    
    或者简化格式:
    {
        "time": "2023-05-01 22:30:00",
        "location": "幸福小区",
        "db": 75.5,
        "area": "住宅区"
    }
    """
    records: List[Dict] = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                records.append(record)
            except json.JSONDecodeError:
                continue
    
    if not records:
        return pd.DataFrame()
    
    df = pd.DataFrame(records)
    
    # 标准化列名
    column_mapping = {
        'timestamp': 'timestamp',
        'time': 'timestamp',
        'measurement_time': 'timestamp',
        'location': 'location',
        '社区': 'location',
        '地点': 'location',
        'db_value': 'db_value',
        'db': 'db_value',
        '分贝': 'db_value',
        'noise_level': 'db_value',
        'is_peak': 'is_peak',
        'peak': 'is_peak',
        'measurement_type': 'measurement_type',
        'type': 'measurement_type'
    }
    
    # 重命名列
    for old_col, new_col in column_mapping.items():
        if old_col in df.columns and new_col not in df.columns:
            df = df.rename(columns={old_col: new_col})
    
    # 确保必要的列存在
    required_columns = ['timestamp', 'location', 'db_value']
    for col in required_columns:
        if col not in df.columns:
            df[col] = None
    
    # 处理时间列
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    
    # 提取日期、小时、时间段
    if 'timestamp' in df.columns:
        df['date'] = df['timestamp'].dt.date
        df['hour'] = df['timestamp'].dt.hour
        df['minute'] = df['timestamp'].dt.minute
    
    # 标记夜间测量 (22:00 - 06:00)
    if 'hour' in df.columns:
        df['is_night'] = df['hour'].apply(lambda x: 22 <= x < 24 or 0 <= x < 6)
    
    # 计算是否超标 (夜间标准: 55分贝, 昼间标准: 70分贝)
    if 'db_value' in df.columns and 'is_night' in df.columns:
        df['exceeds_standard'] = df.apply(
            lambda row: row['db_value'] > (55 if row.get('is_night', False) else 70),
            axis=1
        )
    
    return df

def get_noise_category(db_value: float) -> str:
    """
    根据分贝值分类噪声等级
    """
    if pd.isna(db_value):
        return "未知"
    
    if db_value < 40:
        return "安静"
    elif db_value < 55:
        return "正常"
    elif db_value < 70:
        return "轻度超标"
    elif db_value < 85:
        return "中度超标"
    else:
        return "严重超标"

def aggregate_decibel_data(df: pd.DataFrame, freq: str = '1H') -> pd.DataFrame:
    """
    按时间段聚合分贝数据
    
    freq: 聚合频率, 如 '15T' (15分钟), '1H' (1小时), '1D' (1天)
    """
    if df.empty or 'timestamp' not in df.columns or 'db_value' not in df.columns:
        return pd.DataFrame()
    
    # 设置时间索引
    df_with_index = df.set_index('timestamp').copy()
    
    # 聚合统计
    agg_df = df_with_index.resample(freq).agg({
        'db_value': ['mean', 'max', 'min', 'count'],
        'exceeds_standard': ['sum', 'mean']
    }).reset_index()
    
    # 展平列名
    agg_df.columns = ['_'.join(col).strip('_') for col in agg_df.columns.values]
    
    # 计算超标时长比例
    if 'exceeds_standard_sum' in agg_df.columns and 'db_value_count' in agg_df.columns:
        agg_df['exceedance_ratio'] = agg_df['exceeds_standard_sum'] / agg_df['db_value_count']
    
    return agg_df
