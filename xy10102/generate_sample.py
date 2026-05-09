import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os


def generate_sample_data(output_path: str, n_days: int = 30, n_stations: int = 5):
    np.random.seed(42)
    
    timestamps = []
    charging_powers = []
    energies = []
    durations = []
    prices = []
    station_ids = []
    charger_ids = []
    
    start_date = datetime(2024, 1, 1)
    
    for day in range(n_days):
        for station in range(n_stations):
            for hour in range(24):
                ts = start_date + timedelta(days=day, hours=hour)
                weekday = ts.weekday()
                
                base_power = 30 + station * 10
                
                if 17 <= hour <= 22:
                    power_multiplier = 2.5 + np.random.normal(0, 0.5)
                elif 8 <= hour <= 10:
                    power_multiplier = 1.8 + np.random.normal(0, 0.3)
                elif 0 <= hour <= 6:
                    power_multiplier = 0.3 + np.random.normal(0, 0.1)
                else:
                    power_multiplier = 1.0 + np.random.normal(0, 0.3)
                
                if weekday >= 5:
                    power_multiplier *= 1.2
                
                power = base_power * power_multiplier
                power = max(5, min(150, power))
                
                duration = 30 + np.random.normal(0, 10)
                duration = max(5, duration)
                
                energy = power * (duration / 60) + np.random.normal(0, 5)
                energy = max(1, energy)
                
                if 17 <= hour <= 22:
                    price = 1.2 + np.random.normal(0, 0.1)
                elif 0 <= hour <= 6:
                    price = 0.4 + np.random.normal(0, 0.05)
                else:
                    price = 0.8 + np.random.normal(0, 0.08)
                
                timestamps.append(ts)
                charging_powers.append(round(power, 2))
                energies.append(round(energy, 2))
                durations.append(round(duration, 2))
                prices.append(round(price, 3))
                station_ids.append(f"ST{station + 1:03d}")
                charger_ids.append(f"CH{np.random.randint(1, 11):03d}")
    
    df = pd.DataFrame({
        'timestamp': timestamps,
        'charging_power': charging_powers,
        'energy_consumed': energies,
        'charging_duration': durations,
        'station_id': station_ids,
        'charger_id': charger_ids,
        'electricity_price': prices
    })
    
    n_anomalies = int(len(df) * 0.05)
    anomaly_indices = np.random.choice(len(df), n_anomalies, replace=False)
    
    for idx in anomaly_indices[:n_anomalies // 5]:
        df.loc[idx, 'charging_power'] = np.nan
    
    for idx in anomaly_indices[n_anomalies // 5:2 * n_anomalies // 5]:
        df.loc[idx, 'charging_power'] = -50
    
    for idx in anomaly_indices[2 * n_anomalies // 5:3 * n_anomalies // 5]:
        df.loc[idx, 'charging_power'] = 1000
    
    for idx in anomaly_indices[3 * n_anomalies // 5:4 * n_anomalies // 5]:
        df.loc[idx, 'energy_consumed'] = df.loc[idx, 'energy_consumed'] * 2
    
    df = pd.concat([df, df.iloc[:100]], ignore_index=True)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False, encoding='utf-8')
    print(f"✓ 示例数据已生成: {output_path}")
    print(f"  总记录数: {len(df)}")
    print(f"  时间范围: {df['timestamp'].min()} ~ {df['timestamp'].max()}")
    print(f"  包含的异常类型: 缺失值、负值、超出范围、不一致、重复")


if __name__ == "__main__":
    generate_sample_data("data/sample_data.csv", n_days=60, n_stations=3)
