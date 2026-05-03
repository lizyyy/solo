import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from collections import defaultdict


def calculate_exceedance_duration(
    decibel_df: pd.DataFrame,
    night_threshold: float = 55.0,
    day_threshold: float = 70.0,
    night_start_hour: int = 22,
    night_end_hour: int = 6
) -> Dict:
    """
    计算噪声超标时长
    
    参数:
    - decibel_df: 分贝仪数据DataFrame
    - night_threshold: 夜间阈值 (分贝)
    - day_threshold: 昼间阈值 (分贝)
    - night_start_hour: 夜间开始小时
    - night_end_hour: 夜间结束小时
    
    返回:
    - 包含超标统计信息的字典
    """
    if decibel_df.empty:
        return {
            'total_measurements': 0,
            'night_measurements': 0,
            'day_measurements': 0,
            'exceedance_count': 0,
            'night_exceedance_count': 0,
            'day_exceedance_count': 0,
            'exceedance_ratio': 0.0,
            'night_exceedance_ratio': 0.0,
            'day_exceedance_ratio': 0.0,
            'by_hour': {},
            'by_location': {}
        }
    
    df = decibel_df.copy()
    
    # 确保必要的列存在
    if 'db_value' not in df.columns:
        return {'error': '缺少分贝值列'}
    
    # 计算是否夜间
    if 'hour' in df.columns:
        df['is_night'] = df['hour'].apply(
            lambda x: night_start_hour <= x < 24 or 0 <= x < night_end_hour
        )
    elif 'is_night' not in df.columns:
        df['is_night'] = False
    
    # 计算是否超标
    def check_exceedance(row):
        threshold = night_threshold if row.get('is_night', False) else day_threshold
        return row['db_value'] > threshold
    
    df['exceeds_standard'] = df.apply(check_exceedance, axis=1)
    
    # 基础统计
    total_count = len(df)
    night_count = df['is_night'].sum()
    day_count = total_count - night_count
    
    exceedance_count = df['exceeds_standard'].sum()
    night_exceedance_count = df[df['is_night']]['exceeds_standard'].sum()
    day_exceedance_count = df[~df['is_night']]['exceeds_standard'].sum()
    
    # 按小时统计
    hour_stats = {}
    if 'hour' in df.columns:
        for hour in range(24):
            hour_df = df[df['hour'] == hour]
            if len(hour_df) > 0:
                hour_exceedance = hour_df['exceeds_standard'].sum()
                hour_stats[hour] = {
                    'count': len(hour_df),
                    'exceedance_count': int(hour_exceedance),
                    'exceedance_ratio': float(hour_exceedance / len(hour_df)),
                    'avg_db': float(hour_df['db_value'].mean()),
                    'max_db': float(hour_df['db_value'].max())
                }
    
    # 按地点统计
    location_stats = {}
    if 'location' in df.columns:
        for location in df['location'].unique():
            if pd.isna(location):
                continue
            loc_df = df[df['location'] == location]
            loc_exceedance = loc_df['exceeds_standard'].sum()
            location_stats[str(location)] = {
                'count': len(loc_df),
                'exceedance_count': int(loc_exceedance),
                'exceedance_ratio': float(loc_exceedance / len(loc_df)),
                'avg_db': float(loc_df['db_value'].mean()),
                'max_db': float(loc_df['db_value'].max())
            }
    
    return {
        'total_measurements': int(total_count),
        'night_measurements': int(night_count),
        'day_measurements': int(day_count),
        'exceedance_count': int(exceedance_count),
        'night_exceedance_count': int(night_exceedance_count),
        'day_exceedance_count': int(day_exceedance_count),
        'exceedance_ratio': float(exceedance_count / total_count) if total_count > 0 else 0.0,
        'night_exceedance_ratio': float(night_exceedance_count / night_count) if night_count > 0 else 0.0,
        'day_exceedance_ratio': float(day_exceedance_count / day_count) if day_count > 0 else 0.0,
        'by_hour': hour_stats,
        'by_location': location_stats
    }


def calculate_duplicate_complaints(
    complaints_df: pd.DataFrame,
    time_window_minutes: int = 60,
    similarity_threshold: float = 0.6
) -> Tuple[pd.DataFrame, Dict]:
    """
    检测重复投诉
    
    参数:
    - complaints_df: 投诉数据DataFrame
    - time_window_minutes: 时间窗口（分钟），用于判断时间相近的投诉
    - similarity_threshold: 相似度阈值，用于判断噪声源描述相似性
    
    返回:
    - 标记了重复投诉的DataFrame
    - 重复投诉统计信息字典
    """
    if complaints_df.empty:
        return complaints_df, {
            'total_complaints': 0,
            'duplicate_groups': 0,
            'duplicate_complaints': 0,
            'unique_complaints': 0,
            'groups': []
        }
    
    df = complaints_df.copy()
    
    # 确保必要的列存在
    required_cols = ['complaint_id', 'community', 'noise_source', 'complaint_time']
    for col in required_cols:
        if col not in df.columns:
            df[col] = None
    
    # 初始化标记列
    df['is_duplicate'] = False
    df['duplicate_group_id'] = None
    df['primary_complaint_id'] = None
    
    # 按小区分组
    duplicate_groups = []
    group_id_counter = 0
    
    communities = df['community'].dropna().unique()
    
    for community in communities:
        community_df = df[df['community'] == community].copy()
        
        if len(community_df) < 2:
            continue
        
        # 按时间排序
        if 'complaint_time' in community_df.columns and not community_df['complaint_time'].isna().all():
            community_df = community_df.sort_values('complaint_time')
        
        # 检测重复投诉
        visited_indices = set()
        
        for idx, row in community_df.iterrows():
            if idx in visited_indices:
                continue
            
            # 查找时间窗口内的相似投诉
            group_indices = [idx]
            group_info = {
                'group_id': group_id_counter,
                'community': community,
                'primary_complaint_id': row.get('complaint_id'),
                'complaint_time': row.get('complaint_time'),
                'noise_source': row.get('noise_source'),
                'complaints_in_group': [row.get('complaint_id')]
            }
            
            # 获取当前投诉的关键信息
            current_time = row.get('complaint_time')
            current_source = str(row.get('noise_source', '')).lower()
            current_reporter = str(row.get('reporter', '')).lower()
            current_phone = str(row.get('phone', '')).lower()
            
            for other_idx, other_row in community_df.iterrows():
                if other_idx == idx or other_idx in visited_indices:
                    continue
                
                # 检查时间窗口
                other_time = other_row.get('complaint_time')
                if pd.notna(current_time) and pd.notna(other_time):
                    time_diff = abs((other_time - current_time).total_seconds() / 60)
                    if time_diff > time_window_minutes:
                        continue
                
                # 检查噪声源相似度
                other_source = str(other_row.get('noise_source', '')).lower()
                other_reporter = str(other_row.get('reporter', '')).lower()
                other_phone = str(other_row.get('phone', '')).lower()
                
                # 相同投诉人或相同电话，视为重复
                if current_reporter and current_reporter == other_reporter:
                    is_duplicate = True
                elif current_phone and current_phone == other_phone:
                    is_duplicate = True
                # 噪声源描述相似
                elif current_source and other_source:
                    # 简单的包含关系检查
                    if current_source in other_source or other_source in current_source:
                        is_duplicate = True
                    else:
                        # 计算Jaccard相似度
                        current_words = set(current_source.split())
                        other_words = set(other_source.split())
                        if current_words and other_words:
                            intersection = len(current_words & other_words)
                            union = len(current_words | other_words)
                            similarity = intersection / union if union > 0 else 0
                            is_duplicate = similarity >= similarity_threshold
                        else:
                            is_duplicate = False
                else:
                    is_duplicate = False
                
                if is_duplicate:
                    group_indices.append(other_idx)
                    group_info['complaints_in_group'].append(other_row.get('complaint_id'))
            
            # 如果有重复投诉
            if len(group_indices) > 1:
                group_id_counter += 1
                group_info['group_id'] = group_id_counter
                group_info['size'] = len(group_indices)
                duplicate_groups.append(group_info)
                
                # 标记重复投诉
                for g_idx in group_indices:
                    df.loc[g_idx, 'is_duplicate'] = True
                    df.loc[g_idx, 'duplicate_group_id'] = group_id_counter
                    # 第一个投诉作为主投诉
                    if g_idx != idx:
                        df.loc[g_idx, 'primary_complaint_id'] = row.get('complaint_id')
                    visited_indices.add(g_idx)
    
    # 统计信息
    total_complaints = len(df)
    duplicate_complaints = int(df['is_duplicate'].sum())
    unique_complaints = total_complaints - duplicate_complaints + len(duplicate_groups)
    
    stats = {
        'total_complaints': int(total_complaints),
        'duplicate_groups': int(len(duplicate_groups)),
        'duplicate_complaints': int(duplicate_complaints),
        'unique_complaints': int(unique_complaints),
        'groups': duplicate_groups
    }
    
    return df, stats


def calculate_response_delay(
    complaints_df: pd.DataFrame,
    enforcement_df: pd.DataFrame
) -> Tuple[pd.DataFrame, Dict]:
    """
    计算执法响应延迟
    
    参数:
    - complaints_df: 投诉数据DataFrame
    - enforcement_df: 执法记录DataFrame
    
    返回:
    - 合并了响应时间的DataFrame
    - 响应延迟统计信息字典
    """
    if complaints_df.empty or enforcement_df.empty:
        return pd.DataFrame(), {
            'total_complaints': 0,
            'responded_complaints': 0,
            'unresponded_complaints': 0,
            'avg_response_time_minutes': 0.0,
            'median_response_time_minutes': 0.0,
            'max_response_time_minutes': 0.0,
            'min_response_time_minutes': 0.0,
            'response_distribution': {}
        }
    
    # 合并数据
    if 'complaint_id' not in complaints_df.columns or 'complaint_id' not in enforcement_df.columns:
        return pd.DataFrame(), {'error': '缺少投诉ID列'}
    
    # 只保留有效投诉ID
    valid_complaints = complaints_df[complaints_df['complaint_id'].notna()].copy()
    valid_enforcement = enforcement_df[enforcement_df['complaint_id'].notna()].copy()
    
    # 去重执法记录（同一投诉可能有多次执法）
    valid_enforcement = valid_enforcement.sort_values('arrival_time').drop_duplicates('complaint_id', keep='first')
    
    # 合并
    merged = pd.merge(
        valid_complaints,
        valid_enforcement[['complaint_id', 'arrival_time', 'result', 'action_taken']],
        on='complaint_id',
        how='left'
    )
    
    # 计算响应时间（分钟）
    if 'complaint_time' in merged.columns and 'arrival_time' in merged.columns:
        merged['response_time_minutes'] = (
            merged['arrival_time'] - merged['complaint_time']
        ).dt.total_seconds() / 60
        
        # 过滤掉无效值
        merged = merged[
            (merged['response_time_minutes'] >= 0) | 
            (merged['response_time_minutes'].isna())
        ]
    
    # 统计
    total = len(merged)
    responded = len(merged[merged['arrival_time'].notna()])
    unresponded = total - responded
    
    response_times = merged['response_time_minutes'].dropna()
    
    # 响应时间分布
    distribution = {
        '快速响应 (<15分钟)': len(response_times[response_times < 15]),
        '正常响应 (15-30分钟)': len(response_times[(response_times >= 15) & (response_times < 30)]),
        '较慢响应 (30-60分钟)': len(response_times[(response_times >= 30) & (response_times < 60)]),
        '延迟响应 (>60分钟)': len(response_times[response_times >= 60])
    }
    
    stats = {
        'total_complaints': int(total),
        'responded_complaints': int(responded),
        'unresponded_complaints': int(unresponded),
        'response_rate': float(responded / total) if total > 0 else 0.0,
        'avg_response_time_minutes': float(response_times.mean()) if len(response_times) > 0 else 0.0,
        'median_response_time_minutes': float(response_times.median()) if len(response_times) > 0 else 0.0,
        'max_response_time_minutes': float(response_times.max()) if len(response_times) > 0 else 0.0,
        'min_response_time_minutes': float(response_times.min()) if len(response_times) > 0 else 0.0,
        'response_distribution': distribution
    }
    
    return merged, stats
