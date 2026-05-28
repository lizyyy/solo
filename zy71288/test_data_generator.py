import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import random

from config import config


def generate_test_data(output_dir: Path = None):
    if output_dir is None:
        output_dir = config.RAW_DATA_DIR
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    base_date = datetime(2026, 5, 1)
    
    historical_data = []
    for day in range(14):
        for hour in range(24):
            date = base_date + timedelta(days=day)
            is_weekend = date.weekday() >= 5
            
            base_traffic = 50 if is_weekend else 30
            
            if 10 <= hour <= 18:
                peak_factor = 1.5 if 14 <= hour <= 16 else 1.2
            else:
                peak_factor = 0.3 if hour < 9 or hour > 20 else 0.8
            
            visitors = int(base_traffic * peak_factor * (0.8 + np.random.random() * 0.4))
            
            historical_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'hour': hour,
                'actual_visitors': visitors,
                'exhibition_id': 'EXH_001',
                'is_weekend': is_weekend,
                'is_holiday': day == 0,
                'manual_notes': f"第{day+1}天运营记录" if hour == 0 else None
            })
    
    historical_df = pd.DataFrame(historical_data)
    historical_df.to_csv(output_dir / 'historical_visitors.csv', index=False, encoding='utf-8-sig')
    
    forecast_date = base_date + timedelta(days=14)
    weather_data = []
    for day in range(3):
        for hour in range(24):
            date = forecast_date + timedelta(days=day)
            temp = 15 + np.random.random() * 10
            rain_prob = 0.1 + np.random.random() * 0.4
            
            if day == 1 and 14 <= hour <= 18:
                rain_prob = 0.9
                temp = 12
            
            weather_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'hour': hour,
                'temperature': round(temp, 1),
                'rain_probability': round(rain_prob, 2),
                'weather_condition': 'rainy' if rain_prob > 0.7 else 'sunny' if rain_prob < 0.3 else 'cloudy',
                'wind_speed': round(np.random.random() * 20, 1)
            })
    
    weather_df = pd.DataFrame(weather_data)
    weather_df.to_csv(output_dir / 'weather_forecast.csv', index=False, encoding='utf-8-sig')
    
    reservation_data = []
    booking_id = 1
    for day in range(3):
        for hour in range(10, 19):
            date = forecast_date + timedelta(days=day)
            count = random.randint(5, 30)
            status = 'confirmed' if random.random() > 0.2 else 'pending'
            
            reservation_data.append({
                'booking_id': f'BK{booking_id:05d}',
                'date': date.strftime('%Y-%m-%d'),
                'hour': hour,
                'people_count': count,
                'status': status,
                'visitor_type': 'group' if count > 10 else 'individual',
                'group_id': f'GRP{booking_id:05d}' if count > 10 else None,
                '备注': f"团体预约" if count > 15 else None
            })
            booking_id += 1
    
    reservation_df = pd.DataFrame(reservation_data)
    reservation_df.to_csv(output_dir / 'reservations.csv', index=False, encoding='utf-8-sig')
    
    event_data = [
        {
            'event_id': 'EVT_001',
            'date': forecast_date.strftime('%Y-%m-%d'),
            'hour': 14,
            'event_type': 'VIP开幕式',
            'expected_attendance': 600,
            'event_name': '艺术展开幕仪式',
            'is_vip': True,
            'location': '主展厅',
            'manual_notes': '重要嘉宾出席，需特别安排'
        },
        {
            'event_id': 'EVT_002',
            'date': (forecast_date + timedelta(days=1)).strftime('%Y-%m-%d'),
            'hour': 15,
            'event_type': '艺术家讲座',
            'expected_attendance': 150,
            'event_name': '当代艺术创作分享',
            'is_vip': False,
            'location': '多功能厅'
        },
        {
            'event_id': 'EVT_003',
            'date': (forecast_date + timedelta(days=1)).strftime('%Y-%m-%d'),
            'hour': 15,
            'event_type': '工作坊',
            'expected_attendance': 80,
            'event_name': '亲子艺术体验',
            'is_vip': False,
            'location': '教育区'
        }
    ]
    
    event_df = pd.DataFrame(event_data)
    event_df.to_csv(output_dir / 'events.csv', index=False, encoding='utf-8-sig')
    
    capacity_data = [
        {
            'area_id': 'AREA_001',
            'area_name': '主展厅',
            'max_capacity': 500,
            'current_count': 0,
            'exhibition_name': '当代艺术特展'
        },
        {
            'area_id': 'AREA_002',
            'area_name': '多功能厅',
            'max_capacity': 200,
            'current_count': 0
        },
        {
            'area_id': 'AREA_003',
            'area_name': '教育区',
            'max_capacity': 100,
            'current_count': 0
        }
    ]
    
    capacity_df = pd.DataFrame(capacity_data)
    capacity_df.to_csv(output_dir / 'capacity.csv', index=False, encoding='utf-8-sig')
    
    print(f"测试数据已生成到: {output_dir}")
    print(f"  - 历史客流: {len(historical_data)} 条")
    print(f"  - 天气数据: {len(weather_data)} 条")
    print(f"  - 预约数据: {len(reservation_data)} 条")
    print(f"  - 活动数据: {len(event_data)} 条")
    print(f"  - 容量数据: {len(capacity_data)} 条")
    
    return output_dir


def generate_edge_case_data(output_dir: Path = None):
    if output_dir is None:
        output_dir = config.RAW_DATA_DIR.parent / 'test_edge_cases'
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    dup_dir = output_dir / 'duplicate_test'
    dup_dir.mkdir(exist_ok=True)
    
    dup_reservations = pd.DataFrame([
        {'booking_id': 'DUP_001', 'date': '2026-06-01', 'hour': 10, 'people_count': 10, 'status': 'confirmed'},
        {'booking_id': 'DUP_001', 'date': '2026-06-01', 'hour': 10, 'people_count': 10, 'status': 'confirmed'},
        {'booking_id': 'DUP_002', 'date': '2026-06-01', 'hour': 11, 'people_count': 5, 'status': 'confirmed'},
    ])
    dup_reservations.to_csv(dup_dir / 'reservations.csv', index=False)
    
    dup_historical = pd.DataFrame([
        {'date': '2026-05-01', 'hour': h, 'actual_visitors': 50} for h in range(24)
    ])
    dup_historical.to_csv(dup_dir / 'historical.csv', index=False)
    
    missing_dir = output_dir / 'missing_fields_test'
    missing_dir.mkdir(exist_ok=True)
    
    missing_reservations = pd.DataFrame([
        {'booking_id': 'MISS_001', 'date': '2026-06-01', 'people_count': 10},
    ])
    missing_reservations.to_csv(missing_dir / 'reservations.csv', index=False)
    
    missing_historical = pd.DataFrame([
        {'date': '2026-05-01', 'hour': h} for h in range(24)
    ])
    missing_historical.to_csv(missing_dir / 'historical.csv', index=False)
    
    invalid_dir = output_dir / 'invalid_status_test'
    invalid_dir.mkdir(exist_ok=True)
    
    invalid_reservations = pd.DataFrame([
        {'booking_id': 'INV_001', 'date': '2026-06-01', 'hour': 10, 'people_count': 10, 'status': 'approved'},
        {'booking_id': 'INV_002', 'date': '2026-06-01', 'hour': 11, 'people_count': 5, 'status': 'confirmed'},
    ])
    invalid_reservations.to_csv(invalid_dir / 'reservations.csv', index=False)
    
    invalid_historical = pd.DataFrame([
        {'date': '2026-05-01', 'hour': h, 'actual_visitors': 50} for h in range(24)
    ])
    invalid_historical.to_csv(invalid_dir / 'historical.csv', index=False)
    
    print(f"边界测试数据已生成到: {output_dir}")
    return output_dir


if __name__ == "__main__":
    generate_test_data()
    generate_edge_case_data()
