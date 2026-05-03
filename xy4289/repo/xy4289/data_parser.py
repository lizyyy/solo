import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import config
import os


class DataParser:
    def __init__(self):
        self.machine_records: Optional[pd.DataFrame] = None
        self.water_quality: Optional[pd.DataFrame] = None
        self.patient_schedule: Optional[pd.DataFrame] = None
        self.maintenance_records: Optional[pd.DataFrame] = None

    def parse_time(self, time_str: str) -> Optional[datetime]:
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d',
        ]
        if pd.isna(time_str) or time_str == '':
            return None
        time_str = str(time_str).strip()
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt)
            except (ValueError, TypeError):
                continue
        return None

    def load_machine_records(self, filepath: str) -> pd.DataFrame:
        df = pd.read_csv(filepath)
        df['start_time'] = df['start_time'].apply(self.parse_time)
        df['end_time'] = df['end_time'].apply(self.parse_time)
        df['duration_hours'] = df.apply(
            lambda row: (row['end_time'] - row['start_time']).total_seconds() / 3600
            if pd.notna(row['start_time']) and pd.notna(row['end_time']) else 0,
            axis=1
        )
        df['date'] = df['start_time'].dt.date
        self.machine_records = df
        return df

    def load_water_quality(self, filepath: str) -> pd.DataFrame:
        df = pd.read_csv(filepath)
        df['test_time'] = df['test_time'].apply(self.parse_time)
        df['date'] = df['test_time'].dt.date
        self.water_quality = df
        return df

    def load_patient_schedule(self, filepath: str) -> pd.DataFrame:
        df = pd.read_csv(filepath)
        df['treatment_time'] = df['treatment_time'].apply(self.parse_time)
        df['date'] = df['treatment_time'].dt.date
        df['is_high_risk'] = df['infection_type'].apply(
            lambda x: x in config.RISK_PATIENT_TYPES if pd.notna(x) else False
        )
        self.patient_schedule = df
        return df

    def load_maintenance_records(self, filepath: str) -> pd.DataFrame:
        df = pd.read_csv(filepath)
        df['fault_time'] = df['fault_time'].apply(self.parse_time)
        df['repair_time'] = df['repair_time'].apply(self.parse_time)
        df['resolved_time'] = df['resolved_time'].apply(self.parse_time)
        df['downtime_hours'] = df.apply(
            lambda row: (row['resolved_time'] - row['fault_time']).total_seconds() / 3600
            if pd.notna(row['fault_time']) and pd.notna(row['resolved_time']) else 0,
            axis=1
        )
        self.maintenance_records = df
        return df

    def load_all_from_directory(self, directory: str = None) -> Dict[str, pd.DataFrame]:
        if directory is None:
            directory = config.DATA_DIR
        
        result = {}
        
        machine_files = [f for f in os.listdir(directory) if 'machine' in f.lower() and f.endswith('.csv')]
        if machine_files:
            result['machine_records'] = self.load_machine_records(os.path.join(directory, machine_files[0]))
        
        water_files = [f for f in os.listdir(directory) if 'water' in f.lower() and f.endswith('.csv')]
        if water_files:
            result['water_quality'] = self.load_water_quality(os.path.join(directory, water_files[0]))
        
        patient_files = [f for f in os.listdir(directory) if 'patient' in f.lower() and f.endswith('.csv')]
        if patient_files:
            result['patient_schedule'] = self.load_patient_schedule(os.path.join(directory, patient_files[0]))
        
        maintenance_files = [f for f in os.listdir(directory) if 'maintenance' in f.lower() and f.endswith('.csv')]
        if maintenance_files:
            result['maintenance_records'] = self.load_maintenance_records(os.path.join(directory, maintenance_files[0]))
        
        return result

    def get_all_data(self) -> Dict[str, Optional[pd.DataFrame]]:
        return {
            'machine_records': self.machine_records,
            'water_quality': self.water_quality,
            'patient_schedule': self.patient_schedule,
            'maintenance_records': self.maintenance_records
        }
