import pandas as pd
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from .models import FuelRecord, VehicleType


class DataLoader:
    """数据加载器"""
    
    REQUIRED_COLUMNS = [
        'record_id', 'vehicle_id', 'vehicle_type', 'plate_number',
        'date', 'fuel_consumption', 'route_mileage', 'load_weight',
        'idle_time', 'driver_name', 'route_name'
    ]
    
    @classmethod
    def load_csv(cls, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path)
        df['date'] = pd.to_datetime(df['date']).dt.date
        return df
    
    @classmethod
    def load_excel(cls, file_path: str, sheet_name: Optional[str] = None) -> pd.DataFrame:
        if sheet_name:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
        else:
            df = pd.read_excel(file_path)
        df['date'] = pd.to_datetime(df['date']).dt.date
        return df
    
    @classmethod
    def to_records(cls, df: pd.DataFrame) -> List[FuelRecord]:
        records = []
        for _, row in df.iterrows():
            vehicle_type_map = {
                '垃圾清运车': VehicleType.WASTE_COLLECTOR,
                '道路清扫车': VehicleType.ROAD_SWEEPER,
                '洒水车': VehicleType.SPRINKLER,
            }
            
            record = FuelRecord(
                record_id=str(row.get('record_id', '')),
                vehicle_id=str(row.get('vehicle_id', '')),
                vehicle_type=vehicle_type_map.get(
                    str(row.get('vehicle_type', '垃圾清运车')),
                    VehicleType.WASTE_COLLECTOR
                ),
                plate_number=str(row.get('plate_number', '')),
                date=row.get('date', date.today()),
                fuel_consumption=float(row.get('fuel_consumption', 0)),
                route_mileage=float(row.get('route_mileage', 0)),
                load_weight=float(row.get('load_weight', 0)),
                idle_time=float(row.get('idle_time', 0)),
                driver_name=str(row.get('driver_name', '')),
                route_name=str(row.get('route_name', '')),
                notes=str(row.get('notes', '')),
                is_manual_edit=bool(row.get('is_manual_edit', False)),
            )
            records.append(record)
        return records
    
    @classmethod
    def validate_columns(cls, df: pd.DataFrame) -> List[str]:
        missing = [col for col in cls.REQUIRED_COLUMNS if col not in df.columns]
        return missing


class SampleDataGenerator:
    """样例数据生成器"""
    
    VEHICLES = [
        {'vehicle_id': 'V001', 'plate_number': '沪A-12345', 'vehicle_type': '垃圾清运车', 'driver_name': '张师傅'},
        {'vehicle_id': 'V002', 'plate_number': '沪A-23456', 'vehicle_type': '垃圾清运车', 'driver_name': '李师傅'},
        {'vehicle_id': 'V003', 'plate_number': '沪A-34567', 'vehicle_type': '道路清扫车', 'driver_name': '王师傅'},
        {'vehicle_id': 'V004', 'plate_number': '沪A-45678', 'vehicle_type': '洒水车', 'driver_name': '赵师傅'},
    ]
    
    ROUTES = [
        '东区垃圾清运路线',
        '西区垃圾清运路线',
        '南区主干道清扫',
        '北区绿化洒水',
        '工业区垃圾收集',
    ]
    
    @classmethod
    def generate_normal_data(cls, start_date: date, days: int = 7) -> pd.DataFrame:
        records = []
        record_counter = 1
        
        for day_offset in range(days):
            current_date = start_date + timedelta(days=day_offset)
            
            for vehicle in cls.VEHICLES:
                base_fuel, base_mileage, base_load, base_idle = cls._get_normal_params(
                    vehicle['vehicle_type']
                )
                
                fuel_variation = 0.1
                mileage_variation = 0.1
                load_variation = 0.2
                idle_variation = 0.2
                
                import random
                random.seed(record_counter)
                
                fuel = base_fuel * (1 + random.uniform(-fuel_variation, fuel_variation))
                mileage = base_mileage * (1 + random.uniform(-mileage_variation, mileage_variation))
                load = base_load * (1 + random.uniform(-load_variation, load_variation))
                idle = base_idle * (1 + random.uniform(-idle_variation, idle_variation))
                
                route_idx = random.randint(0, len(cls.ROUTES) - 1)
                
                records.append({
                    'record_id': f'R{record_counter:04d}',
                    'vehicle_id': vehicle['vehicle_id'],
                    'vehicle_type': vehicle['vehicle_type'],
                    'plate_number': vehicle['plate_number'],
                    'date': current_date.strftime('%Y-%m-%d'),
                    'fuel_consumption': round(fuel, 2),
                    'route_mileage': round(mileage, 2),
                    'load_weight': round(load, 2),
                    'idle_time': round(idle, 2),
                    'driver_name': vehicle['driver_name'],
                    'route_name': cls.ROUTES[route_idx],
                    'notes': '',
                    'is_manual_edit': False,
                })
                record_counter += 1
        
        return pd.DataFrame(records)
    
    @classmethod
    def generate_with_duplicates(cls, base_df: pd.DataFrame) -> pd.DataFrame:
        df = base_df.copy()
        dup_rows = df.sample(n=5, random_state=42).copy()
        df = pd.concat([df, dup_rows], ignore_index=True)
        return df
    
    @classmethod
    def generate_with_missing_fields(cls, base_df: pd.DataFrame) -> pd.DataFrame:
        df = base_df.copy()
        import numpy as np
        
        np.random.seed(42)
        rows_to_modify = np.random.choice(len(df), size=8, replace=False)
        
        missing_patterns = [
            ['fuel_consumption'],
            ['route_mileage'],
            ['load_weight'],
            ['idle_time'],
            ['fuel_consumption', 'route_mileage'],
            ['load_weight', 'driver_name'],
            ['date'],
            ['vehicle_id', 'plate_number'],
        ]
        
        for i, row_idx in enumerate(rows_to_modify):
            for col in missing_patterns[i % len(missing_patterns)]:
                if col in df.columns:
                    df.at[row_idx, col] = None
        
        return df
    
    @classmethod
    def generate_with_manual_errors(cls, base_df: pd.DataFrame) -> pd.DataFrame:
        df = base_df.copy()
        import numpy as np
        
        np.random.seed(42)
        error_rows = np.random.choice(len(df), size=6, replace=False)
        
        error_types = [
            ('fuel_consumption', 5.0, '油耗异常放大5倍'),
            ('fuel_consumption', 0.2, '油耗异常缩小5倍'),
            ('route_mileage', 0.1, '里程异常缩小10倍'),
            ('load_weight', 3.0, '载重异常放大3倍'),
            ('idle_time', 8.0, '怠速时间异常放大8倍'),
            ('fuel_consumption', 0.0, '油耗被错误清零'),
        ]
        
        for i, row_idx in enumerate(error_rows):
            col, multiplier, note = error_types[i % len(error_types)]
            original_value = df.at[row_idx, col]
            if pd.notna(original_value) and original_value > 0:
                df.at[row_idx, col] = round(original_value * multiplier, 2)
                df.at[row_idx, 'is_manual_edit'] = True
                df.at[row_idx, 'notes'] = note
        
        return df
    
    @classmethod
    def generate_all_anomalies(cls, base_df: pd.DataFrame) -> pd.DataFrame:
        df = base_df.copy()
        df = cls.generate_with_duplicates(df)
        df = cls.generate_with_missing_fields(df)
        df = cls.generate_with_manual_errors(df)
        return df
    
    @staticmethod
    def _get_normal_params(vehicle_type: str):
        params = {
            '垃圾清运车': (45.0, 80.0, 6000.0, 45.0),
            '道路清扫车': (35.0, 60.0, 3500.0, 60.0),
            '洒水车': (55.0, 50.0, 9000.0, 30.0),
        }
        return params.get(vehicle_type, (40.0, 70.0, 5000.0, 40.0))