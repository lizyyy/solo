"""
示例数据生成器
用于生成测试用的噪声、天气和投诉数据
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any
import pandas as pd
import numpy as np
import os


def generate_noise_data(site_id: str, 
                        start_time: datetime,
                        duration_hours: int = 4,
                        base_level: float = 45.0,
                        include_anomalies: bool = True,
                        include_offline: bool = True) -> pd.DataFrame:
    """
    生成噪声监测数据
    
    Args:
        site_id: 站点ID
        start_time: 开始时间
        duration_hours: 持续小时数
        base_level: 基础噪声水平
        include_anomalies: 是否包含异常（超标、突增峰值）
        include_offline: 是否包含离线时段
    """
    records = []
    current_time = start_time
    end_time = start_time + timedelta(hours=duration_hours)
    
    offline_periods = []
    if include_offline:
        offline_start = start_time + timedelta(hours=1, minutes=30)
        offline_end = offline_start + timedelta(minutes=45)
        offline_periods.append((offline_start, offline_end))
    
    anomaly_periods = []
    if include_anomalies:
        anomaly_periods.append({
            'start': start_time + timedelta(hours=0, minutes=45),
            'end': start_time + timedelta(hours=1, minutes=15),
            'type': 'exceedance',
            'level': 62.0
        })
        
        anomaly_periods.append({
            'start': start_time + timedelta(hours=2, minutes=15),
            'end': start_time + timedelta(hours=2, minutes=45),
            'type': 'exceedance',
            'level': 58.0
        })
        
        anomaly_periods.append({
            'start': start_time + timedelta(hours=3, minutes=0),
            'end': start_time + timedelta(hours=3, minutes=2),
            'type': 'peak',
            'level': 85.0
        })
    
    while current_time < end_time:
        is_offline = False
        for off_start, off_end in offline_periods:
            if off_start <= current_time <= off_end:
                is_offline = True
                break
        
        if is_offline:
            current_time += timedelta(seconds=1)
            continue
        
        noise_level = base_level + np.random.normal(0, 3)
        
        for anomaly in anomaly_periods:
            if anomaly['start'] <= current_time <= anomaly['end']:
                if anomaly['type'] == 'exceedance':
                    noise_level = anomaly['level'] + np.random.normal(0, 2)
                elif anomaly['type'] == 'peak':
                    time_in_peak = (current_time - anomaly['start']).total_seconds()
                    peak_duration = (anomaly['end'] - anomaly['start']).total_seconds()
                    ratio = time_in_peak / peak_duration
                    if ratio < 0.3:
                        factor = ratio / 0.3
                    elif ratio > 0.7:
                        factor = (1 - ratio) / 0.3
                    else:
                        factor = 1.0
                    noise_level = base_level + (anomaly['level'] - base_level) * factor
                break
        
        if 22 <= current_time.hour or current_time.hour < 6:
            noise_level -= 2.0
        
        records.append({
            'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S'),
            'site_id': site_id,
            'laeq': round(noise_level, 1),
            'lmax': round(noise_level + np.random.uniform(2, 5), 1),
            'lmin': round(noise_level - np.random.uniform(2, 5), 1),
            'l10': round(noise_level + np.random.uniform(1, 3), 1),
            'l50': round(noise_level, 1),
            'l90': round(noise_level - np.random.uniform(1, 3), 1)
        })
        
        current_time += timedelta(seconds=1)
    
    return pd.DataFrame(records)


def generate_weather_data(site_id: str,
                          start_time: datetime,
                          duration_hours: int = 4,
                          include_weather_event: bool = True) -> pd.DataFrame:
    """
    生成气象监测数据
    """
    records = []
    current_time = start_time
    end_time = start_time + timedelta(hours=duration_hours)
    
    wind_event_start = start_time + timedelta(hours=1, minutes=45)
    wind_event_end = start_time + timedelta(hours=2, minutes=15)
    
    rain_event_start = start_time + timedelta(hours=2, minutes=30)
    rain_event_end = start_time + timedelta(hours=2, minutes=50)
    
    while current_time < end_time:
        base_temp = 15.0
        base_humidity = 65.0
        base_wind = 3.0
        base_rain = 0.0
        
        if wind_event_start <= current_time <= wind_event_end and include_weather_event:
            wind_speed = 12.0 + np.random.normal(0, 2)
        else:
            wind_speed = base_wind + np.random.normal(0, 1)
        
        if rain_event_start <= current_time <= rain_event_end and include_weather_event:
            rainfall = 0.3 + np.random.normal(0, 0.1)
        else:
            rainfall = base_rain
        
        hour_factor = 1.0
        if 0 <= current_time.hour < 6:
            hour_factor = 0.8
        elif 6 <= current_time.hour < 12:
            hour_factor = 1.1
        elif 12 <= current_time.hour < 18:
            hour_factor = 1.2
        else:
            hour_factor = 0.9
        
        records.append({
            'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S'),
            'site_id': site_id,
            'temperature': round(base_temp * hour_factor + np.random.normal(0, 0.5), 1),
            'humidity': round(base_humidity + np.random.normal(0, 3), 1),
            'wind_speed': round(max(0, wind_speed), 1),
            'wind_direction': round(np.random.uniform(0, 360), 0),
            'rainfall': round(max(0, rainfall), 2),
            'barometric_pressure': round(1013 + np.random.normal(0, 2), 1)
        })
        
        current_time += timedelta(seconds=60)
    
    return pd.DataFrame(records)


def generate_complaint_data(start_time: datetime) -> pd.DataFrame:
    """
    生成投诉数据
    """
    complaints = [
        {
            'complaint_id': 'CMPL-2026-001',
            'timestamp': (start_time + timedelta(hours=1, minutes=0)).strftime('%Y-%m-%d %H:%M:%S'),
            'site_id': 'SITE-001',
            'complainant_name': '张三',
            'complainant_phone': '13800138001',
            'complainant_address': '幸福小区1号楼',
            'complaint_type': 'noise',
            'complaint_content': '楼下工地夜间施工，噪声很大，无法入睡',
            'expected_noise_source': '建筑工地',
            'review_status': 'pending',
            'severity': 'high'
        },
        {
            'complaint_id': 'CMPL-2026-002',
            'timestamp': (start_time + timedelta(hours=2, minutes=30)).strftime('%Y-%m-%d %H:%M:%S'),
            'site_id': 'SITE-001',
            'complainant_name': '李四',
            'complainant_phone': '13800138002',
            'complainant_address': '幸福小区2号楼',
            'complaint_type': 'noise',
            'complaint_content': '听到突然的巨响，像是爆炸声',
            'expected_noise_source': '未知',
            'review_status': 'pending',
            'severity': 'critical'
        },
        {
            'complaint_id': 'CMPL-2026-003',
            'timestamp': (start_time + timedelta(hours=3, minutes=15)).strftime('%Y-%m-%d %H:%M:%S'),
            'site_id': 'SITE-002',
            'complainant_name': '王五',
            'complainant_phone': '13800138003',
            'complainant_address': '阳光小区3号楼',
            'complaint_type': 'noise',
            'complaint_content': '持续的机械噪声，像是有设备在运行',
            'expected_noise_source': '工厂',
            'review_status': 'pending',
            'severity': 'normal'
        }
    ]
    
    return pd.DataFrame(complaints)


def main():
    """
    主函数：生成所有示例数据
    """
    base_date = datetime(2026, 5, 1, 22, 0, 0)
    duration_hours = 4
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("正在生成示例数据...")
    
    print(f"\n生成站点 SITE-001 的噪声数据...")
    noise_site1 = generate_noise_data(
        site_id='SITE-001',
        start_time=base_date,
        duration_hours=duration_hours,
        base_level=45.0,
        include_anomalies=True,
        include_offline=True
    )
    noise1_path = os.path.join(script_dir, 'noise_site_001.csv')
    noise_site1.to_csv(noise1_path, index=False, encoding='utf-8-sig')
    print(f"  已保存: {noise1_path}")
    print(f"  记录数: {len(noise_site1)}")
    
    print(f"\n生成站点 SITE-002 的噪声数据...")
    noise_site2 = generate_noise_data(
        site_id='SITE-002',
        start_time=base_date,
        duration_hours=duration_hours,
        base_level=42.0,
        include_anomalies=True,
        include_offline=False
    )
    noise2_path = os.path.join(script_dir, 'noise_site_002.csv')
    noise_site2.to_csv(noise2_path, index=False, encoding='utf-8-sig')
    print(f"  已保存: {noise2_path}")
    print(f"  记录数: {len(noise_site2)}")
    
    print(f"\n生成站点 SITE-001 的气象数据...")
    weather_site1 = generate_weather_data(
        site_id='SITE-001',
        start_time=base_date,
        duration_hours=duration_hours,
        include_weather_event=True
    )
    weather1_path = os.path.join(script_dir, 'weather_site_001.csv')
    weather_site1.to_csv(weather1_path, index=False, encoding='utf-8-sig')
    print(f"  已保存: {weather1_path}")
    print(f"  记录数: {len(weather_site1)}")
    
    print(f"\n生成站点 SITE-002 的气象数据...")
    weather_site2 = generate_weather_data(
        site_id='SITE-002',
        start_time=base_date,
        duration_hours=duration_hours,
        include_weather_event=False
    )
    weather2_path = os.path.join(script_dir, 'weather_site_002.csv')
    weather_site2.to_csv(weather2_path, index=False, encoding='utf-8-sig')
    print(f"  已保存: {weather2_path}")
    print(f"  记录数: {len(weather_site2)}")
    
    print(f"\n生成投诉数据...")
    complaints = generate_complaint_data(base_date)
    complaints_path = os.path.join(script_dir, 'complaints.csv')
    complaints.to_csv(complaints_path, index=False, encoding='utf-8-sig')
    print(f"  已保存: {complaints_path}")
    print(f"  记录数: {len(complaints)}")
    
    print("\n" + "="*50)
    print("示例数据生成完成！")
    print("="*50)
    print(f"\n数据时间范围: {base_date.strftime('%Y-%m-%d %H:%M')} - {(base_date + timedelta(hours=duration_hours)).strftime('%Y-%m-%d %H:%M')}")
    print(f"\n噪声数据:")
    print(f"  - SITE-001: {len(noise_site1)} 条记录（包含超标、突增峰值和离线时段）")
    print(f"  - SITE-002: {len(noise_site2)} 条记录（包含超标）")
    print(f"\n气象数据:")
    print(f"  - SITE-001: {len(weather_site1)} 条记录（包含强风、降雨事件）")
    print(f"  - SITE-002: {len(weather_site2)} 条记录（正常天气）")
    print(f"\n投诉数据:")
    print(f"  - 共 {len(complaints)} 条投诉")
    print(f"    - CMPL-2026-001: SITE-001 夜间施工噪声（高危）")
    print(f"    - CMPL-2026-002: SITE-001 突增峰值（严重）")
    print(f"    - CMPL-2026-003: SITE-002 持续噪声（普通）")


if __name__ == '__main__':
    main()
