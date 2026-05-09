import os
import pandas as pd
import numpy as np
from datetime import datetime
from dateutil import parser
from config import DATE_FORMATS, DATA_DIR


class DataLoader:
    def __init__(self, data_dir=None):
        self.data_dir = data_dir or DATA_DIR
        os.makedirs(self.data_dir, exist_ok=True)
    
    def load_data(self, file_path):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"数据文件不存在: {file_path}")
        
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.csv':
            df = pd.read_csv(file_path, encoding='utf-8')
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
        
        df = self._standardize_columns(df)
        return df
    
    def _standardize_columns(self, df):
        column_mapping = {
            '时间': 'timestamp',
            '日期': 'timestamp',
            'datetime': 'timestamp',
            'time': 'timestamp',
            'date': 'timestamp',
            '湿度': 'humidity',
            'humidity': 'humidity',
            'rh': 'humidity',
            '相对湿度': 'humidity',
            '温度': 'temperature',
            'temperature': 'temperature',
            'temp': 'temperature',
            '灌溉': 'irrigation',
            'irrigated': 'irrigation',
            'watered': 'irrigation',
            '单位': 'unit',
            'unit': 'unit',
            '传感器': 'sensor_id',
            'sensor': 'sensor_id',
            'sensor_id': 'sensor_id'
        }
        
        df.columns = df.columns.str.strip().str.lower()
        df = df.rename(columns=column_mapping)
        return df
    
    def load_sample_data(self):
        np.random.seed(42)
        n = 100
        timestamps = pd.date_range(start='2024-01-01 08:00', periods=n, freq='H')
        
        base_humidity = 50 + np.sin(np.linspace(0, 20, n)) * 10
        base_temperature = 25 + np.cos(np.linspace(0, 10, n)) * 5
        
        humidity = base_humidity + np.random.normal(0, 8, n)
        temperature = base_temperature + np.random.normal(0, 3, n)
        
        humidity[np.random.choice(n, 10)] = np.nan
        humidity[np.random.choice(n, 3)] = [150, -5, 200]
        temperature[np.random.choice(n, 5)] = np.nan
        temperature[np.random.choice(n, 2)] = [-10, 60]
        
        units = ['%'] * 80 + ['°C'] * 10 + ['°F'] * 10
        np.random.shuffle(units)
        
        irrigation = np.zeros(n)
        irrigation[humidity < 30] = 1
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'humidity': humidity,
            'temperature': temperature,
            'unit': units,
            'sensor_id': ['S001'] * 40 + ['S002'] * 30 + ['S001'] * 30,
            'irrigation': irrigation
        })
        
        duplicates = df.sample(5)
        df = pd.concat([df, duplicates], ignore_index=True)
        
        return df
