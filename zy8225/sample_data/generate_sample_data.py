#!/usr/bin/env python3
"""生成示例数据文件"""

import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

np.random.seed(42)

sample_dir = Path(__file__).parent

pump_models = {
    'PUMP-001': 'Model-A',
    'PUMP-002': 'Model-B',
    'PUMP-003': 'Model-C',
    'PUMP-004': 'Model-A',
    'PUMP-005': 'Model-B',
    'PUMP-006': 'Model-C'
}

base_rms_values = {
    'Model-A': 2.5,
    'Model-B': 3.0,
    'Model-C': 2.0
}

start_time = datetime(2024, 1, 1, 0, 0, 0)
timestamps = [start_time + timedelta(hours=i) for i in range(168)]

print("生成振动特征数据...")
vibration_records = []
for pump_id, model in pump_models.items():
    base_rms = base_rms_values[model]
    
    for ts in timestamps:
        hour = ts.hour
        is_night = hour < 6 or hour >= 22
        
        noise = np.random.normal(0, 0.3, 3)
        
        if pump_id == 'PUMP-004':
            if ts > datetime(2024, 1, 5):
                current_base = base_rms * 1.8
                noise = np.random.normal(0, 0.8, 3)
            else:
                current_base = base_rms
        else:
            current_base = base_rms
        
        record = {
            'pump_id': pump_id,
            'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
            'rms_x': round(current_base + noise[0] + (0.5 if is_night else 0), 4),
            'rms_y': round(current_base * 1.2 + noise[1] + (0.3 if is_night else 0), 4),
            'rms_z': round(current_base * 0.8 + noise[2], 4),
            'peak_x': round(current_base * 3 + np.random.normal(0, 0.5), 4),
            'peak_y': round(current_base * 3.5 + np.random.normal(0, 0.6), 4),
            'peak_z': round(current_base * 2.5 + np.random.normal(0, 0.4), 4),
            'kurtosis_x': round(3.0 + np.random.normal(0, 0.5) + (1.0 if pump_id == 'PUMP-004' and ts > datetime(2024, 1, 5) else 0), 4),
            'kurtosis_y': round(3.2 + np.random.normal(0, 0.6), 4),
            'kurtosis_z': round(2.8 + np.random.normal(0, 0.4), 4),
            'crest_factor': round(3.0 + np.random.normal(0, 0.3), 4)
        }
        vibration_records.append(record)

vibration_df = pd.DataFrame(vibration_records)
vibration_file = sample_dir / "vibration_features.csv"
vibration_df.to_csv(vibration_file, index=False, encoding='utf-8-sig')
print(f"  ✓ 已生成: {vibration_file}")

print("\n生成告警分数数据...")
alarm_records = []
for pump_id, model in pump_models.items():
    for i, ts in enumerate(timestamps[::4]):
        base_score = 0.1 + np.random.normal(0, 0.05)
        
        if pump_id == 'PUMP-004':
            if ts > datetime(2024, 1, 5):
                base_score = 0.7 + np.random.normal(0, 0.1)
            else:
                base_score = 0.2 + np.random.normal(0, 0.05)
        
        if pump_id == 'PUMP-002':
            if ts > datetime(2024, 1, 3) and ts < datetime(2024, 1, 4):
                base_score = 0.85
        
        record = {
            'pump_id': pump_id,
            'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
            'score': round(min(max(base_score, 0), 1), 4),
            'threshold': 0.6,
            'model_version': 'v1.2.0'
        }
        alarm_records.append(record)

alarm_file = sample_dir / "alarm_scores.jsonl"
with open(alarm_file, 'w', encoding='utf-8') as f:
    for record in alarm_records:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')
print(f"  ✓ 已生成: {alarm_file}")

print("\n示例数据生成完成!")
print(f"\n数据文件位于: {sample_dir}/")
print("  - pump_ledger.csv")
print("  - vibration_features.csv")
print("  - alarm_scores.jsonl")
print("  - maintenance_records.yaml")
