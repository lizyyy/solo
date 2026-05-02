"""示例数据模块 - 生成疫苗冷链质控测试数据"""

import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
from pathlib import Path


class SampleDataGenerator:
    """示例数据生成器"""
    
    def __init__(self, base_date: datetime = None):
        self.base_date = base_date or datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    def generate_temperature_data(
        self,
        device_id: str,
        duration_hours: int = 24,
        interval_minutes: int = 5,
        mean_temp: float = 5.0,
        std_temp: float = 0.3,
        add_anomalies: bool = True,
        add_missing: bool = True
    ) -> pd.DataFrame:
        """生成温度记录数据"""
        n_points = int((duration_hours * 60) / interval_minutes)
        
        timestamps = [
            self.base_date + timedelta(minutes=i * interval_minutes)
            for i in range(n_points)
        ]
        
        np.random.seed(hash(device_id) % 2**32)
        
        temperatures = np.random.normal(loc=mean_temp, scale=std_temp, size=n_points)
        
        temperatures = temperatures + np.sin(np.arange(n_points) * 0.1) * 0.2
        
        if add_anomalies:
            temperatures = self._inject_temperature_anomalies(temperatures, interval_minutes)
        
        if add_missing:
            temperatures = self._inject_missing_data(temperatures, interval_minutes)
        
        df = pd.DataFrame({
            'timestamp': [ts.strftime('%Y-%m-%d %H:%M:%S') for ts in timestamps],
            'temperature': temperatures,
            'device_id': device_id
        })
        
        return df
    
    def _inject_temperature_anomalies(
        self,
        temperatures: np.ndarray,
        interval_minutes: int
    ) -> np.ndarray:
        """注入温度异常"""
        temps = temperatures.copy()
        n = len(temps)
        
        spike_start = int(n * 0.35)
        spike_duration = int(15 / interval_minutes)
        temps[spike_start:spike_start+spike_duration] += 4.0 + np.random.rand(spike_duration) * 2.0
        
        dip_start = int(n * 0.6)
        dip_duration = int(20 / interval_minutes)
        temps[dip_start:dip_start+dip_duration] -= 3.0 + np.random.rand(dip_duration) * 1.5
        
        continuous_over_start = int(n * 0.75)
        continuous_over_duration = int(25 / interval_minutes)
        temps[continuous_over_start:continuous_over_start+continuous_over_duration] += 3.5
        
        rapid_change_idx = int(n * 0.45)
        temps[rapid_change_idx] = temps[rapid_change_idx-1] + 3.0
        
        return temps
    
    def _inject_missing_data(
        self,
        temperatures: np.ndarray,
        interval_minutes: int
    ) -> np.ndarray:
        """注入缺失数据"""
        temps = temperatures.copy()
        n = len(temps)
        
        gap_start = int(n * 0.5)
        gap_duration = int(45 / interval_minutes)
        temps[gap_start:gap_start+gap_duration] = np.nan
        
        return temps
    
    def generate_door_events(
        self,
        device_id: str,
        num_events: int = 8
    ) -> List[Dict]:
        """生成开门事件数据"""
        events = []
        np.random.seed(hash(device_id + "_door") % 2**32)
        
        for i in range(num_events):
            hour_offset = np.random.randint(8, 20)
            minute_offset = np.random.randint(0, 60)
            
            open_time = self.base_date + timedelta(hours=hour_offset, minutes=minute_offset)
            
            if i == 2:
                duration_minutes = 6
            else:
                duration_minutes = np.random.randint(1, 4)
            
            close_time = open_time + timedelta(minutes=duration_minutes)
            
            event = {
                'event_id': f"{device_id}_door_{i+1}",
                'device_id': device_id,
                'open_time': open_time.strftime('%Y-%m-%d %H:%M:%S'),
                'close_time': close_time.strftime('%Y-%m-%d %H:%M:%S'),
                'duration_seconds': duration_minutes * 60,
                'event_type': 'door',
                'notes': f"常规取放货" if i != 2 else "长时间开门检查"
            }
            events.append(event)
        
        return events
    
    def generate_calibration_records(
        self,
        device_ids: List[str]
    ) -> List[Dict]:
        """生成校准证书数据"""
        calibrations = []
        
        for device_id in device_ids:
            np.random.seed(hash(device_id + "_cal") % 2**32)
            
            offset = np.random.uniform(-0.5, 0.5)
            
            cal_date = self.base_date - timedelta(days=np.random.randint(1, 30))
            next_date = cal_date + timedelta(days=180)
            
            cal = {
                'device_id': device_id,
                'certificate_id': f"CAL-{device_id}-{cal_date.strftime('%Y%m%d')}",
                'calibration_date': cal_date.strftime('%Y-%m-%d'),
                'offset_value': round(offset, 3),
                'offset_unit': '°C',
                'calibration_method': '标准温度计比对',
                'next_calibration_date': next_date.strftime('%Y-%m-%d'),
                'is_valid': True
            }
            calibrations.append(cal)
        
        return calibrations
    
    def generate_batch_records(
        self,
        device_ids: List[str]
    ) -> pd.DataFrame:
        """生成运输批次数据"""
        batches = []
        vaccine_names = [
            '新型冠状病毒灭活疫苗',
            '重组新型冠状病毒疫苗',
            '流感疫苗',
            '肺炎疫苗',
            '乙肝疫苗',
            '麻腮风联合疫苗'
        ]
        
        np.random.seed(12345)
        
        for i, device_id in enumerate(device_ids):
            batch_start = self.base_date + timedelta(hours=np.random.randint(6, 10))
            batch_end = batch_start + timedelta(hours=np.random.randint(4, 8))
            
            batch = {
                'batch_id': f"BATCH-{2024000 + i + 1}",
                'product_name': np.random.choice(vaccine_names),
                'device_id': device_id,
                'start_time': batch_start.strftime('%Y-%m-%d %H:%M:%S'),
                'end_time': batch_end.strftime('%Y-%m-%d %H:%M:%S'),
                'quantity': np.random.randint(50, 500),
                'storage_condition': '2-8°C冷藏',
                'batch_type': '常规',
                'notes': f"{np.random.choice(['正常入库', '紧急入库', '常规出库', '抽检出库'])}"
            }
            batches.append(batch)
        
        return pd.DataFrame(batches)
    
    def generate_all_sample_data(
        self,
        device_ids: List[str] = None,
        output_dir: str = None
    ) -> Dict[str, Any]:
        """生成所有示例数据"""
        if device_ids is None:
            device_ids = ['REFRIG-001', 'REFRIG-002', 'REFRIG-003']
        
        all_data = {
            'temperature_files': {},
            'door_events': [],
            'calibration_records': [],
            'batch_records': None
        }
        
        for device_id in device_ids:
            if device_id == 'REFRIG-001':
                temp_df = self.generate_temperature_data(
                    device_id, duration_hours=24, mean_temp=5.0, std_temp=0.3,
                    add_anomalies=True, add_missing=True
                )
            elif device_id == 'REFRIG-002':
                temp_df = self.generate_temperature_data(
                    device_id, duration_hours=24, mean_temp=4.8, std_temp=0.2,
                    add_anomalies=False, add_missing=False
                )
            else:
                temp_df = self.generate_temperature_data(
                    device_id, duration_hours=24, mean_temp=5.5, std_temp=0.5,
                    add_anomalies=True, add_missing=True
                )
            
            all_data['temperature_files'][device_id] = temp_df
            
            door_events = self.generate_door_events(device_id)
            all_data['door_events'].extend(door_events)
        
        all_data['calibration_records'] = self.generate_calibration_records(device_ids)
        all_data['batch_records'] = self.generate_batch_records(device_ids)
        
        if output_dir:
            self._save_sample_data(all_data, output_dir)
        
        return all_data
    
    def _save_sample_data(self, all_data: Dict, output_dir: str):
        """保存示例数据到文件"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        for device_id, df in all_data['temperature_files'].items():
            file_path = output_path / f"{device_id}_temperature.csv"
            df.to_csv(file_path, index=False, encoding='utf-8-sig')
        
        door_file = output_path / "door_events.json"
        with open(door_file, 'w', encoding='utf-8') as f:
            json.dump({'events': all_data['door_events']}, f, ensure_ascii=False, indent=2)
        
        cal_file = output_path / "calibration_records.json"
        with open(cal_file, 'w', encoding='utf-8') as f:
            json.dump(all_data['calibration_records'], f, ensure_ascii=False, indent=2)
        
        batch_file = output_path / "batch_records.csv"
        all_data['batch_records'].to_csv(batch_file, index=False, encoding='utf-8-sig')


def create_sample_data(output_dir: str = None) -> Dict:
    """便捷函数：创建示例数据"""
    generator = SampleDataGenerator()
    return generator.generate_all_sample_data(output_dir=output_dir)
