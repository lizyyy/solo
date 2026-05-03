import pandas as pd
from datetime import datetime, timedelta
from typing import Optional

def parse_enforcement_csv(file_path: str) -> pd.DataFrame:
    """
    解析执法到场记录CSV文件
    
    期望的CSV字段:
    - enforcement_id: 执法记录ID
    - complaint_id: 关联投诉ID
    - community: 小区名称
    - arrival_time: 到场时间
    - departure_time: 离场时间
    - noise_source: 噪声源
    - action_taken: 采取措施
    - result: 处理结果
    - officer_name: 执法人员
    """
    df = pd.read_csv(file_path)
    
    # 标准化列名
    column_mapping = {
        'enforcement_id': 'enforcement_id',
        'id': 'enforcement_id',
        '执法记录编号': 'enforcement_id',
        'complaint_id': 'complaint_id',
        '投诉编号': 'complaint_id',
        '关联投诉': 'complaint_id',
        'community': 'community',
        '小区': 'community',
        '小区名称': 'community',
        'arrival_time': 'arrival_time',
        '到场时间': 'arrival_time',
        '到达时间': 'arrival_time',
        'departure_time': 'departure_time',
        '离场时间': 'departure_time',
        '离开时间': 'departure_time',
        'noise_source': 'noise_source',
        '噪声源': 'noise_source',
        '噪声来源': 'noise_source',
        'action_taken': 'action_taken',
        '采取措施': 'action_taken',
        '处理措施': 'action_taken',
        'result': 'result',
        '处理结果': 'result',
        '结果': 'result',
        'officer_name': 'officer_name',
        '执法人员': 'officer_name',
        '人员': 'officer_name'
    }
    
    # 重命名列
    for old_col, new_col in column_mapping.items():
        if old_col in df.columns and new_col not in df.columns:
            df = df.rename(columns={old_col: new_col})
    
    # 确保必要的列存在
    required_columns = ['enforcement_id', 'arrival_time']
    for col in required_columns:
        if col not in df.columns:
            df[col] = None
    
    # 处理时间列
    time_columns = ['arrival_time', 'departure_time']
    for col in time_columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    
    # 提取日期
    if 'arrival_time' in df.columns:
        df['date'] = df['arrival_time'].dt.date
        df['hour'] = df['arrival_time'].dt.hour
    
    # 标记夜间执法 (22:00 - 06:00)
    if 'hour' in df.columns:
        df['is_night_enforcement'] = df['hour'].apply(lambda x: 22 <= x < 24 or 0 <= x < 6)
    
    # 计算执法时长
    if 'arrival_time' in df.columns and 'departure_time' in df.columns:
        df['enforcement_duration_minutes'] = (
            df['departure_time'] - df['arrival_time']
        ).dt.total_seconds() / 60
    
    return df

def calculate_response_time(complaints_df: pd.DataFrame, enforcement_df: pd.DataFrame) -> pd.DataFrame:
    """
    计算投诉响应时间
    
    合并投诉数据和执法数据，计算从投诉到执法到场的时间差
    """
    if complaints_df.empty or enforcement_df.empty:
        return pd.DataFrame()
    
    # 确保有投诉ID字段
    if 'complaint_id' not in complaints_df.columns or 'complaint_id' not in enforcement_df.columns:
        return pd.DataFrame()
    
    # 合并数据
    merged = pd.merge(
        complaints_df[['complaint_id', 'community', 'noise_source', 'complaint_time']],
        enforcement_df[['complaint_id', 'arrival_time', 'result', 'action_taken']],
        on='complaint_id',
        how='left'
    )
    
    # 计算响应时间（分钟）
    if 'complaint_time' in merged.columns and 'arrival_time' in merged.columns:
        merged['response_time_minutes'] = (
            merged['arrival_time'] - merged['complaint_time']
        ).dt.total_seconds() / 60
        
        # 过滤掉负值（可能是数据错误）
        merged = merged[merged['response_time_minutes'] >= 0]
    
    return merged

def categorize_response_time(response_minutes: float) -> str:
    """
    根据响应时间分类
    """
    if pd.isna(response_minutes):
        return "未响应"
    
    if response_minutes < 15:
        return "快速响应 (<15分钟)"
    elif response_minutes < 30:
        return "正常响应 (15-30分钟)"
    elif response_minutes < 60:
        return "较慢响应 (30-60分钟)"
    else:
        return "延迟响应 (>60分钟)"
