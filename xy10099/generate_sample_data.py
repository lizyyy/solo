import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from pathlib import Path


def generate_sample_data(output_path: str = 'sample_data.xlsx'):
    np.random.seed(42)
    random.seed(42)
    
    start_date = datetime(2024, 1, 1)
    num_days = 60
    num_hours = 24
    
    dates = []
    for day in range(num_days):
        for hour in range(num_hours):
            dates.append(start_date + timedelta(days=day, hours=hour))
    
    n = len(dates)
    
    base_production = 100 + np.sin(np.linspace(0, 4 * np.pi, n)) * 30
    production = base_production + np.random.normal(0, 10, n)
    production = np.maximum(production, 10)
    
    base_specific_energy = 0.12
    specific_energy = base_specific_energy + np.random.normal(0, 0.01, n)
    
    anomaly_indices = []
    
    for i in range(n):
        if 15 <= dates[i].hour <= 23:
            if random.random() < 0.05:
                specific_energy[i] *= 1.5
                anomaly_indices.append(i)
    
    high_leak_indices = random.sample(range(n), 50)
    for idx in high_leak_indices:
        if idx not in anomaly_indices:
            specific_energy[idx] *= 1.3
            anomaly_indices.append(idx)
    
    energy = production * specific_energy
    
    pressure = 0.7 + np.random.normal(0, 0.05, n)
    for idx in high_leak_indices[:25]:
        pressure[idx] = 0.55 + np.random.normal(0, 0.02)
    
    leak = 0.02 + np.random.normal(0, 0.005, n)
    leak = np.maximum(leak, 0)
    for idx in high_leak_indices:
        leak[idx] = 0.15 + np.random.normal(0, 0.03)
    
    df = pd.DataFrame({
        '时间': dates,
        '产量': production,
        '能耗': energy,
        '压力': pressure,
        '泄漏': leak
    })
    
    insert_errors(df)
    
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    df.to_excel(output_path, index=False, engine='openpyxl')
    print(f"示例数据已生成: {output_path}")
    print(f"总记录数: {len(df)}")
    print(f"人为插入异常记录: {len(set(anomaly_indices))}")
    
    return df


def insert_errors(df):
    n = len(df)
    
    missing_indices = random.sample(range(n), 20)
    for idx in missing_indices:
        col = random.choice(['能耗', '产量', '压力', '泄漏'])
        df.loc[idx, col] = np.nan
    
    duplicate_indices = random.sample(range(5, n-5), 10)
    for idx in duplicate_indices:
        df.loc[idx] = df.loc[idx - 1].copy()
    
    negative_idx = random.randint(0, n-1)
    df.loc[negative_idx, '产量'] = -50
    
    df.loc[random.randint(0, n-1), '能耗'] = '150.5 kWh'
    df.loc[random.randint(0, n-1), '压力'] = '7 bar'
    df.loc[random.randint(0, n-1), '产量'] = '无效数据'
    
    df.loc[random.randint(0, n-1), '能耗'] = 100000
    
    df.loc[random.randint(0, n-1), '时间'] = '无效时间'


if __name__ == '__main__':
    generate_sample_data()
