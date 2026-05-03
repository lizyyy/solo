"""
数据解析模块 - 处理多种输入格式的解析和标准化
"""

import json
import yaml
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path


class DataParser:
    """数据解析器 - 统一处理各种输入格式"""
    
    def __init__(self):
        self.pump_ledger: pd.DataFrame = pd.DataFrame()
        self.vibration_features: pd.DataFrame = pd.DataFrame()
        self.alarm_scores: pd.DataFrame = pd.DataFrame()
        self.maintenance_records: List[Dict[str, Any]] = []
    
    def parse_pump_ledger(self, filepath: str) -> pd.DataFrame:
        """
        解析泵组台账 CSV
        
        期望字段:
        - pump_id: 泵唯一标识
        - pump_name: 泵名称
        - model: 泵型号
        - location: 安装位置
        - install_date: 安装日期
        - rated_power: 额定功率(kW)
        - rated_flow: 额定流量(m³/h)
        - status: 当前状态(运行/备用/检修)
        """
        df = pd.read_csv(filepath)
        
        required_columns = ['pump_id', 'model']
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"泵组台账缺少必要字段: {missing}")
        
        df['pump_id'] = df['pump_id'].astype(str).str.strip()
        df['model'] = df['model'].astype(str).str.strip()
        
        if 'install_date' in df.columns:
            df['install_date'] = pd.to_datetime(df['install_date'], errors='coerce')
        
        self.pump_ledger = df
        return df
    
    def parse_vibration_features(self, filepath: str) -> pd.DataFrame:
        """
        解析振动特征 CSV
        
        期望字段:
        - pump_id: 泵唯一标识
        - timestamp: 时间戳
        - rms_x/rms_y/rms_z: 各方向振动有效值
        - peak_x/peak_y/peak_z: 各方向峰值
        - kurtosis_x/kurtosis_y/kurtosis_z: 峭度
        - crest_factor: 波峰因数
        - frequency_features: 频率域特征(可选)
        """
        df = pd.read_csv(filepath)
        
        required_columns = ['pump_id', 'timestamp']
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"振动特征数据缺少必要字段: {missing}")
        
        df['pump_id'] = df['pump_id'].astype(str).str.strip()
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        
        feature_columns = [
            'rms_x', 'rms_y', 'rms_z',
            'peak_x', 'peak_y', 'peak_z',
            'kurtosis_x', 'kurtosis_y', 'kurtosis_z',
            'crest_factor'
        ]
        
        for col in feature_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.dropna(subset=['timestamp'])
        df = df.sort_values(['pump_id', 'timestamp']).reset_index(drop=True)
        
        self.vibration_features = df
        return df
    
    def parse_alarm_scores(self, filepath: str) -> pd.DataFrame:
        """
        解析模型告警分数 JSONL
        
        每行JSON期望包含:
        - pump_id: 泵唯一标识
        - timestamp: 时间戳
        - score: 告警分数(0-1)
        - threshold: 告警阈值
        - features: 模型使用的特征(可选)
        - model_version: 模型版本(可选)
        """
        records = []
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    records.append(record)
                except json.JSONDecodeError as e:
                    print(f"警告: 第{line_num}行JSON解析错误: {e}")
                    continue
        
        if not records:
            raise ValueError("JSONL文件中没有有效记录")
        
        df = pd.DataFrame(records)
        
        required_columns = ['pump_id', 'timestamp', 'score']
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"告警分数数据缺少必要字段: {missing}")
        
        df['pump_id'] = df['pump_id'].astype(str).str.strip()
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df['score'] = pd.to_numeric(df['score'], errors='coerce')
        
        if 'threshold' in df.columns:
            df['threshold'] = pd.to_numeric(df['threshold'], errors='coerce')
        
        df = df.dropna(subset=['timestamp', 'score'])
        df = df.sort_values(['pump_id', 'timestamp']).reset_index(drop=True)
        
        self.alarm_scores = df
        return df
    
    def parse_maintenance_records(self, filepath: str) -> List[Dict[str, Any]]:
        """
        解析检修记录 YAML
        
        期望结构:
        maintenance_records:
          - pump_id: PUMP-001
            maintenance_date: "2024-01-15"
            maintenance_type: "预防性维护"
            description: "轴承更换，润滑检查"
            technician: "张三"
            status: "completed"
            next_maintenance_date: "2024-07-15"
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if 'maintenance_records' in data:
            records = data['maintenance_records']
        else:
            records = [data] if isinstance(data, dict) else data
        
        processed_records = []
        for record in records:
            if not isinstance(record, dict):
                continue
            
            processed = {
                'pump_id': str(record.get('pump_id', '')).strip(),
                'maintenance_date': self._parse_date(record.get('maintenance_date')),
                'maintenance_type': str(record.get('maintenance_type', '未知')).strip(),
                'description': str(record.get('description', '')).strip(),
                'technician': str(record.get('technician', '')).strip(),
                'status': str(record.get('status', 'unknown')).strip().lower(),
                'next_maintenance_date': self._parse_date(record.get('next_maintenance_date')),
                'original_record': record
            }
            processed_records.append(processed)
        
        self.maintenance_records = processed_records
        return processed_records
    
    def _parse_date(self, date_value) -> Optional[datetime]:
        """解析日期值"""
        if date_value is None:
            return None
        if isinstance(date_value, datetime):
            return date_value
        if isinstance(date_value, str):
            try:
                return pd.to_datetime(date_value).to_pydatetime()
            except:
                return None
        return None
    
    def load_sample_data(self, sample_dir: str = None) -> Dict[str, Any]:
        """
        加载示例数据
        
        如果提供sample_dir，则从该目录加载；否则使用内置示例数据
        """
        if sample_dir and Path(sample_dir).exists():
            sample_path = Path(sample_dir)
            
            ledger_file = sample_path / "pump_ledger.csv"
            features_file = sample_path / "vibration_features.csv"
            scores_file = sample_path / "alarm_scores.jsonl"
            maintenance_file = sample_path / "maintenance_records.yaml"
            
            results = {}
            
            if ledger_file.exists():
                results['pump_ledger'] = self.parse_pump_ledger(str(ledger_file))
            if features_file.exists():
                results['vibration_features'] = self.parse_vibration_features(str(features_file))
            if scores_file.exists():
                results['alarm_scores'] = self.parse_alarm_scores(str(scores_file))
            if maintenance_file.exists():
                results['maintenance_records'] = self.parse_maintenance_records(str(maintenance_file))
            
            return results
        
        return self._generate_sample_data()
    
    def _generate_sample_data(self) -> Dict[str, Any]:
        """生成内置示例数据"""
        np.random.seed(42)
        
        pump_models = ['Model-A', 'Model-B', 'Model-C']
        pump_ids = [f'PUMP-{i:03d}' for i in range(1, 7)]
        
        ledger_data = {
            'pump_id': pump_ids,
            'pump_name': [f'离心泵-{i}' for i in range(1, 7)],
            'model': [pump_models[i % 3] for i in range(6)],
            'location': ['1号车间', '1号车间', '2号车间', '2号车间', '3号车间', '3号车间'],
            'install_date': pd.date_range('2022-01-01', periods=6, freq='3M'),
            'rated_power': [75, 75, 110, 110, 55, 55],
            'rated_flow': [300, 300, 450, 450, 200, 200],
            'status': ['运行', '运行', '运行', '备用', '运行', '运行']
        }
        self.pump_ledger = pd.DataFrame(ledger_data)
        
        timestamps = pd.date_range('2024-01-01 00:00:00', periods=168, freq='1H')
        
        vibration_records = []
        for pump_id in pump_ids:
            pump_idx = int(pump_id.split('-')[1]) - 1
            model = pump_models[pump_idx % 3]
            
            base_rms = {'Model-A': 2.5, 'Model-B': 3.0, 'Model-C': 2.0}[model]
            
            for ts in timestamps:
                hour = ts.hour
                is_night = hour < 6 or hour >= 22
                
                noise = np.random.normal(0, 0.3, 3)
                
                if pump_id == 'PUMP-004':
                    if ts > pd.Timestamp('2024-01-05'):
                        base_rms *= 1.8
                        noise = np.random.normal(0, 0.8, 3)
                
                record = {
                    'pump_id': pump_id,
                    'timestamp': ts,
                    'rms_x': base_rms + noise[0] + (0.5 if is_night else 0),
                    'rms_y': base_rms * 1.2 + noise[1] + (0.3 if is_night else 0),
                    'rms_z': base_rms * 0.8 + noise[2],
                    'peak_x': base_rms * 3 + np.random.normal(0, 0.5),
                    'peak_y': base_rms * 3.5 + np.random.normal(0, 0.6),
                    'peak_z': base_rms * 2.5 + np.random.normal(0, 0.4),
                    'kurtosis_x': 3.0 + np.random.normal(0, 0.5) + (1.0 if pump_id == 'PUMP-004' and ts > pd.Timestamp('2024-01-05') else 0),
                    'kurtosis_y': 3.2 + np.random.normal(0, 0.6),
                    'kurtosis_z': 2.8 + np.random.normal(0, 0.4),
                    'crest_factor': 3.0 + np.random.normal(0, 0.3)
                }
                vibration_records.append(record)
        
        self.vibration_features = pd.DataFrame(vibration_records)
        self.vibration_features = self.vibration_features.sort_values(['pump_id', 'timestamp']).reset_index(drop=True)
        
        alarm_records = []
        for pump_id in pump_ids:
            pump_idx = int(pump_id.split('-')[1]) - 1
            
            for ts in timestamps[::4]:
                base_score = 0.1 + np.random.normal(0, 0.05)
                
                if pump_id == 'PUMP-004':
                    if ts > pd.Timestamp('2024-01-05'):
                        base_score = 0.7 + np.random.normal(0, 0.1)
                    else:
                        base_score = 0.2 + np.random.normal(0, 0.05)
                
                if pump_id == 'PUMP-002':
                    if ts > pd.Timestamp('2024-01-03') and ts < pd.Timestamp('2024-01-04'):
                        base_score = 0.85
                
                record = {
                    'pump_id': pump_id,
                    'timestamp': ts,
                    'score': min(max(base_score, 0), 1),
                    'threshold': 0.6,
                    'model_version': 'v1.2.0'
                }
                alarm_records.append(record)
        
        self.alarm_scores = pd.DataFrame(alarm_records)
        self.alarm_scores = self.alarm_scores.sort_values(['pump_id', 'timestamp']).reset_index(drop=True)
        
        self.maintenance_records = [
            {
                'pump_id': 'PUMP-004',
                'maintenance_date': datetime(2024, 1, 3),
                'maintenance_type': '预防性维护',
                'description': '常规检查，润滑脂补充',
                'technician': '李四',
                'status': 'completed',
                'next_maintenance_date': datetime(2024, 7, 3),
                'original_record': {}
            },
            {
                'pump_id': 'PUMP-002',
                'maintenance_date': datetime(2024, 1, 5),
                'maintenance_type': ' corrective',
                'description': '轴承更换，密封检查',
                'technician': '王五',
                'status': 'completed',
                'next_maintenance_date': datetime(2024, 7, 5),
                'original_record': {}
            }
        ]
        
        return {
            'pump_ledger': self.pump_ledger,
            'vibration_features': self.vibration_features,
            'alarm_scores': self.alarm_scores,
            'maintenance_records': self.maintenance_records
        }
    
    def get_pump_info(self, pump_id: str) -> Optional[Dict[str, Any]]:
        """获取指定泵的台账信息"""
        if self.pump_ledger.empty:
            return None
        
        match = self.pump_ledger[self.pump_ledger['pump_id'] == pump_id]
        if match.empty:
            return None
        
        return match.iloc[0].to_dict()
    
    def get_pumps_by_model(self, model: str) -> List[str]:
        """获取同型号的所有泵ID"""
        if self.pump_ledger.empty:
            return []
        
        matches = self.pump_ledger[self.pump_ledger['model'] == model]
        return matches['pump_id'].tolist()
    
    def get_all_models(self) -> List[str]:
        """获取所有泵型号"""
        if self.pump_ledger.empty:
            return []
        
        return self.pump_ledger['model'].unique().tolist()
