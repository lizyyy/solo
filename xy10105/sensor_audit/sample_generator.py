"""
示例数据生成器
生成包含各种问题的传感器测试数据
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from pathlib import Path
from typing import List, Dict


class SampleDataGenerator:
    """
    示例数据生成器
    生成包含真实场景问题的温湿度传感器数据
    """
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        random.seed(seed)
    
    def generate(
        self,
        num_sensors: int = 5,
        num_days: int = 30,
        samples_per_day: int = 24,
        output_file: str = 'sample_sensor_data.csv'
    ) -> str:
        print("正在生成示例数据...")
        
        sensors = [f'SENSOR_{i:03d}' for i in range(num_sensors)]
        locations = ['Room_A', 'Room_B', 'Room_C', 'Basement', 'Rooftop']
        batches = ['BATCH_2024_Q1', 'BATCH_2024_Q2']
        
        base_start = datetime(2024, 6, 1)
        
        records = []
        
        for sensor_idx, sensor_id in enumerate(sensors):
            location = random.choice(locations)
            batch = random.choice(batches)
            
            base_temp = 22.0 + random.uniform(-3, 3)
            base_humidity = 55.0 + random.uniform(-10, 10)
            
            temp_drift = random.uniform(-0.02, 0.02)
            hum_drift = random.uniform(-0.05, 0.05)
            
            is_reference = sensor_idx == 0
            is_drifting = sensor_idx in [2, 3]
            is_noisy = sensor_idx == 4
            
            for day in range(num_days):
                for hour in range(24):
                    if hour >= samples_per_day:
                        continue
                    
                    timestamp = base_start + timedelta(days=day, hours=hour)
                    sample_num = day * 24 + hour
                    
                    diurnal_temp = 3 * np.sin(hour * np.pi / 12 - np.pi/2)
                    diurnal_hum = -10 * np.sin(hour * np.pi / 12 - np.pi/2)
                    
                    temp_noise = np.random.normal(0, 0.3) if not is_noisy else np.random.normal(0, 1.0)
                    hum_noise = np.random.normal(0, 1.5) if not is_noisy else np.random.normal(0, 4.0)
                    
                    drift_factor = temp_drift * sample_num if is_drifting else 0
                    hum_drift_factor = hum_drift * sample_num if is_drifting else 0
                    
                    temperature = base_temp + diurnal_temp + temp_noise + drift_factor
                    humidity = base_humidity + diurnal_hum + hum_noise + hum_drift_factor
                    
                    if not is_reference:
                        temperature += random.uniform(-0.5, 0.5)
                        humidity += random.uniform(-2, 2)
                    
                    unit_temp = 'C'
                    unit_hum = '%RH'
                    
                    if random.random() < 0.02:
                        temperature = temperature * 9/5 + 32
                        unit_temp = 'F'
                    if random.random() < 0.03:
                        unit_temp = '°C'
                    
                    record = {
                        'sensor_id': sensor_id,
                        'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                        'temperature': f"{temperature:.2f}{unit_temp}",
                        'humidity': f"{humidity:.1f}",
                        'location': location,
                        'batch_id': batch,
                        'temperature_unit': unit_temp,
                        'humidity_unit': unit_hum
                    }
                    
                    records.append(record)
        
        df = pd.DataFrame(records)
        
        num_nulls = int(len(df) * 0.02)
        null_indices = np.random.choice(df.index, size=num_nulls, replace=False)
        df.loc[null_indices, 'temperature'] = None
        
        num_nulls_hum = int(len(df) * 0.015)
        null_indices_hum = np.random.choice(df.index, size=num_nulls_hum, replace=False)
        df.loc[null_indices_hum, 'humidity'] = None
        
        num_duplicates = int(len(df) * 0.01)
        dup_indices = np.random.choice(df.index, size=num_duplicates, replace=False)
        duplicates = df.loc[dup_indices].copy()
        df = pd.concat([df, duplicates], ignore_index=True)
        
        num_outliers = int(len(df) * 0.005)
        outlier_indices = np.random.choice(df.index, size=num_outliers, replace=False)
        for idx in outlier_indices:
            if df.loc[idx, 'temperature'] is not None:
                df.loc[idx, 'temperature'] = f"{100.0 + random.uniform(-20, 20)}C"
        num_outliers_hum = int(len(df) * 0.003)
        outlier_indices_hum = np.random.choice(df.index, size=num_outliers_hum, replace=False)
        for idx in outlier_indices_hum:
            if df.loc[idx, 'humidity'] is not None:
                df.loc[idx, 'humidity'] = f"{120.0 + random.uniform(0, 30)}"
        
        num_invalid_ts = int(len(df) * 0.002)
        invalid_ts_indices = np.random.choice(df.index, size=num_invalid_ts, replace=False)
        for idx in invalid_ts_indices:
            df.loc[idx, 'timestamp'] = 'INVALID_DATE'
        
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(output_path, index=False)
        
        print(f"✓ 示例数据已生成: {output_path}")
        print(f"  - 总行数: {len(df)}")
        print(f"  - 传感器数量: {num_sensors}")
        print(f"  - 时间跨度: {num_days} 天")
        print(f"  - 包含问题: 缺失值 {num_nulls+num_nulls_hum}, 重复 {num_duplicates}, 异常值 {num_outliers+num_outliers_hum}")
        
        return str(output_path)


def generate_default_sample():
    generator = SampleDataGenerator(seed=42)
    return generator.generate(
        num_sensors=5,
        num_days=30,
        samples_per_day=12,
        output_file='data/sample_sensor_data.csv'
    )


if __name__ == '__main__':
    generate_default_sample()
