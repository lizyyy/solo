import pandas as pd
from datetime import datetime
from typing import Optional

def parse_complaints_csv(file_path: str) -> pd.DataFrame:
    """
    解析投诉热线CSV文件
    
    期望的CSV字段:
    - complaint_id: 投诉ID
    - community: 小区名称
    - noise_source: 噪声源描述
    - complaint_time: 投诉时间 (格式: YYYY-MM-DD HH:MM:SS)
    - description: 投诉描述
    - reporter: 投诉人
    - phone: 联系电话
    
    返回标准化的DataFrame
    """
    df = pd.read_csv(file_path)
    
    # 标准化列名
    column_mapping = {
        'complaint_id': 'complaint_id',
        'id': 'complaint_id',
        '投诉编号': 'complaint_id',
        'community': 'community',
        '小区': 'community',
        '小区名称': 'community',
        'noise_source': 'noise_source',
        '噪声源': 'noise_source',
        '噪声来源': 'noise_source',
        'complaint_time': 'complaint_time',
        '投诉时间': 'complaint_time',
        'time': 'complaint_time',
        'description': 'description',
        '描述': 'description',
        '投诉内容': 'description',
        'reporter': 'reporter',
        '投诉人': 'reporter',
        '姓名': 'reporter',
        'phone': 'phone',
        '联系电话': 'phone',
        '电话': 'phone'
    }
    
    # 重命名列
    for old_col, new_col in column_mapping.items():
        if old_col in df.columns and new_col not in df.columns:
            df = df.rename(columns={old_col: new_col})
    
    # 确保必要的列存在
    required_columns = ['complaint_id', 'community', 'noise_source', 'complaint_time']
    for col in required_columns:
        if col not in df.columns:
            df[col] = None
    
    # 处理时间列
    if 'complaint_time' in df.columns:
        df['complaint_time'] = pd.to_datetime(df['complaint_time'], errors='coerce')
    
    # 提取日期和小时
    if 'complaint_time' in df.columns:
        df['date'] = df['complaint_time'].dt.date
        df['hour'] = df['complaint_time'].dt.hour
    
    # 标记夜间投诉 (22:00 - 06:00)
    if 'hour' in df.columns:
        df['is_night'] = df['hour'].apply(lambda x: 22 <= x < 24 or 0 <= x < 6)
    
    return df

def normalize_complaint_source(description: str) -> str:
    """
    标准化噪声源描述，用于识别重复投诉
    """
    if pd.isna(description):
        return "未知"
    
    description = str(description).lower()
    
    # 关键词匹配
    if '施工' in description or '工地' in description or '建筑' in description:
        return "施工噪声"
    elif '装修' in description:
        return "装修噪声"
    elif '商业' in description or '商铺' in description or '店铺' in description:
        return "商业噪声"
    elif '交通' in description or '车辆' in description or '汽车' in description:
        return "交通噪声"
    elif '娱乐' in description or '酒吧' in description or 'KTV' in description:
        return "娱乐场所噪声"
    elif '邻居' in description or '邻里' in description or '家庭' in description:
        return "邻里噪声"
    else:
        return "其他噪声"
