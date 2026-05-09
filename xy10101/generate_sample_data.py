import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from config import DATA_DIR


def generate_sample_data():
    np.random.seed(42)
    
    stations = ['A001', 'A002', 'A003']
    
    base_time = datetime(2024, 6, 1, 0, 0, 0)
    time_points = [base_time + timedelta(minutes=5 * i) for i in range(288)]
    
    records = []
    
    for station in stations:
        for i, time in enumerate(time_points):
            hour = time.hour
            day_of_year = time.timetuple().tm_yday
            
            base_rain = 0.0
            if 6 <= hour < 18:
                base_rain = np.random.gamma(shape=0.5, scale=2)
            else:
                base_rain = np.random.gamma(shape=0.2, scale=1)
                
            station_offset = {'A001': 0, 'A002': 1.5, 'A003': -0.5}
            base_rain += station_offset.get(station, 0)
            
            if np.random.random() < 0.9:
                if base_rain < 0.1:
                    rainfall = 0.0
                else:
                    rainfall = np.clip(base_rain + np.random.normal(0, 0.3), 0, 100)
            else:
                rainfall = np.nan
                
            if (station == 'A001' and i > 100 and i < 103) or \
               (station == 'A002' and i > 50 and i < 54):
                rainfall = 999.0
                
            if station == 'A003' and i > 200 and i < 206:
                rainfall = 50.0
                
            if i > 250 and i < 253:
                rainfall = np.nan
                
            records.append({
                'time': time.strftime('%Y-%m-%d %H:%M:%S'),
                'station': station,
                'rainfall': rainfall
            })
            
    df = pd.DataFrame(records)
    
    sample_csv_path = os.path.join(DATA_DIR, 'sample_rainfall_data.csv')
    df.to_csv(sample_csv_path, index=False, encoding='utf-8-sig')
    
    print(f"示例数据已生成: {sample_csv_path}")
    print(f"总记录数: {len(df)}")
    print(f"站点: {df['station'].unique().tolist()}")
    print(f"时间范围: {df['time'].min()} ~ {df['time'].max()}")
    print(f"缺失值数: {df['rainfall'].isna().sum()}")
    print(f"异常值(>100): {len(df[df['rainfall'] > 100])}")
    
    return sample_csv_path


if __name__ == '__main__':
    generate_sample_data()
