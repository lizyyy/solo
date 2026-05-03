import pandas as pd
import numpy as np
from datetime import datetime, timedelta

start_time = datetime(2026, 5, 3, 18, 0, 0)
hours = 24
pond_ids = ['P01', 'P02', 'P03']

records = []
for i in range(hours):
    timestamp = start_time + timedelta(hours=i)
    hour = timestamp.hour
    
    for pond_id in pond_ids:
        base_temp = 28 if 6 <= hour <= 18 else 26
        
        if 18 <= hour <= 23:
            do_base = 5.0 - (hour - 18) * 0.3
        elif 0 <= hour <= 6:
            do_base = 3.2 - hour * 0.2
        else:
            do_base = 5.0 + min((hour - 6) * 0.3, 2.0)
        
        if pond_id == 'P01':
            fish_density = 1800
            do = do_base - 1.5
            feeding_rate = 120
        elif pond_id == 'P02':
            fish_density = 1200
            do = do_base - 0.5
            feeding_rate = 80
        else:
            fish_density = 600
            do = do_base + 0.5
            feeding_rate = 40
        
        if 0 <= hour <= 6:
            weather = 'rainy'
        elif 7 <= hour <= 18:
            weather = 'cloudy'
        else:
            weather = 'rainy'
        
        records.append({
            'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'pond_id': pond_id,
            'temperature': base_temp + np.random.uniform(-0.5, 0.5),
            'dissolved_oxygen': max(2.0, round(do, 2)),
            'fish_density': fish_density,
            'feeding_rate': feeding_rate,
            'weather': weather
        })

df = pd.DataFrame(records)
df.to_csv('examples/high_risk_sample.csv', index=False)
print(f'已创建高风险场景数据: {len(records)} 条记录')
print(df.groupby('pond_id').agg({
    'dissolved_oxygen': ['min', 'max', 'mean'],
    'fish_density': 'first',
    'feeding_rate': 'first'
}))
