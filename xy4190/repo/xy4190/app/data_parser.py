"""数据解析模块 - 支持温度记录、开门事件、校准证书、运输批次等数据格式"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from typing import Dict, List, Optional, Union, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field


@dataclass
class TemperatureRecord:
    """单台设备温度记录"""
    device_id: str
    device_name: str
    timestamps: pd.DatetimeIndex
    temperatures: pd.Series
    raw_data: pd.DataFrame = field(repr=False)
    source_file: str = ""
    
    @property
    def start_time(self) -> datetime:
        return self.timestamps[0] if len(self.timestamps) > 0 else None
    
    @property
    def end_time(self) -> datetime:
        return self.timestamps[-1] if len(self.timestamps) > 0 else None
    
    @property
    def duration(self) -> timedelta:
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return timedelta(0)
    
    def get_dataframe(self) -> pd.DataFrame:
        df = pd.DataFrame({
            'timestamp': self.timestamps,
            'temperature': self.temperatures,
            'device_id': self.device_id,
            'device_name': self.device_name
        })
        return df


@dataclass
class DoorEvent:
    """开门事件"""
    device_id: str
    event_id: str
    open_time: datetime
    close_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    event_type: str = "door"
    notes: str = ""
    
    @property
    def duration(self) -> timedelta:
        if self.close_time:
            return self.close_time - self.open_time
        return timedelta(seconds=self.duration_seconds or 0)


@dataclass
class CalibrationRecord:
    """校准证书记录"""
    device_id: str
    calibration_date: datetime
    offset_value: float
    offset_unit: str = "°C"
    certificate_id: str = ""
    calibration_method: str = ""
    next_calibration_date: Optional[datetime] = None
    is_valid: bool = True


@dataclass
class BatchRecord:
    """运输批次记录"""
    batch_id: str
    product_name: str
    device_id: str
    start_time: datetime
    end_time: datetime
    quantity: int = 0
    batch_type: str = "regular"
    storage_condition: str = ""
    notes: str = ""
    
    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time


class DataParser:
    """数据解析器 - 支持多种数据格式导入"""
    
    TEMPERATURE_COLUMN_MAPPINGS = [
        {'time': ['timestamp', '时间', 'time', 'datetime', '日期时间'],
         'temp': ['temperature', '温度', 'temp', 'value', '数值']},
    ]
    
    def __init__(self):
        self.parsed_data: Dict[str, Any] = {
            'temperature_records': {},
            'door_events': [],
            'calibration_records': {},
            'batch_records': []
        }
    
    def parse_temperature_csv(self, file_path: str, 
                                device_id: Optional[str] = None,
                                device_name: Optional[str] = None) -> TemperatureRecord:
        """解析温度记录CSV文件"""
        df = pd.read_csv(file_path)
        
        time_col = self._detect_column(df, ['timestamp', '时间', 'time', 'datetime', '日期', '时间戳'])
        temp_col = self._detect_column(df, ['temperature', '温度', 'temp', 'value', '数值', 'temp_value'])
        
        if time_col is None:
            raise ValueError(f"无法在 {file_path} 中检测到时间列")
        if temp_col is None:
            raise ValueError(f"无法在 {file_path} 中检测到温度列")
        
        df['parsed_time'] = pd.to_datetime(df[time_col], errors='coerce')
        
        valid_mask = df['parsed_time'].notna()
        df = df[valid_mask].copy()
        
        df = df.sort_values('parsed_time').reset_index(drop=True)
        
        temperatures = pd.to_numeric(df[temp_col], errors='coerce')
        
        inferred_device_id = device_id or self._infer_device_id(file_path, df)
        inferred_device_name = device_name or inferred_device_id
        
        record = TemperatureRecord(
            device_id=inferred_device_id,
            device_name=inferred_device_name,
            timestamps=pd.DatetimeIndex(df['parsed_time']),
            temperatures=temperatures,
            raw_data=df,
            source_file=file_path
        )
        
        self.parsed_data['temperature_records'][inferred_device_id] = record
        return record
    
    def parse_door_events_json(self, file_path: str) -> List[DoorEvent]:
        """解析开门事件JSON文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        events = []
        
        if isinstance(data, list):
            events_data = data
        elif isinstance(data, dict):
            if 'events' in data:
                events_data = data['events']
            elif 'door_events' in data:
                events_data = data['door_events']
            else:
                events_data = [data]
        else:
            raise ValueError(f"不支持的JSON格式: {file_path}")
        
        for i, event_data in enumerate(events_data):
            event = self._parse_single_door_event(event_data, f"event_{i}")
            if event:
                events.append(event)
        
        self.parsed_data['door_events'].extend(events)
        return events
    
    def parse_calibration_json(self, file_path: str) -> List[CalibrationRecord]:
        """解析校准证书JSON文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        calibrations = []
        
        if isinstance(data, list):
            cal_data = data
        elif isinstance(data, dict):
            if 'calibrations' in data:
                cal_data = data['calibrations']
            elif 'certificates' in data:
                cal_data = data['certificates']
            else:
                cal_data = [data]
        else:
            raise ValueError(f"不支持的JSON格式: {file_path}")
        
        for item in cal_data:
            cal = self._parse_single_calibration(item)
            if cal:
                calibrations.append(cal)
                if cal.device_id not in self.parsed_data['calibration_records']:
                    self.parsed_data['calibration_records'][cal.device_id] = []
                self.parsed_data['calibration_records'][cal.device_id].append(cal)
        
        return calibrations
    
    def parse_batch_csv(self, file_path: str) -> List[BatchRecord]:
        """解析运输批次CSV文件"""
        df = pd.read_csv(file_path)
        
        batches = []
        
        required_cols = {
            'batch_id': ['batch_id', '批次号', 'batch', 'lot_number', '批号'],
            'device_id': ['device_id', '设备号', 'device', '冰箱编号', '设备编号'],
            'start_time': ['start_time', '开始时间', 'start', '入库时间'],
            'end_time': ['end_time', '结束时间', 'end', '出库时间'],
        }
        
        col_mapping = {}
        for target, candidates in required_cols.items():
            col = self._detect_column(df, candidates)
            if col:
                col_mapping[target] = col
        
        optional_cols = {
            'product_name': ['product_name', '产品名称', 'product', '疫苗名称'],
            'quantity': ['quantity', '数量', 'count', '支数'],
            'storage_condition': ['storage_condition', '存储条件', 'condition'],
            'batch_type': ['batch_type', '批次类型', 'type'],
            'notes': ['notes', '备注', 'remark', '说明']
        }
        
        for target, candidates in optional_cols.items():
            col = self._detect_column(df, candidates)
            if col:
                col_mapping[target] = col
        
        for _, row in df.iterrows():
            try:
                batch = BatchRecord(
                    batch_id=str(row.get(col_mapping.get('batch_id', ''), '')),
                    product_name=str(row.get(col_mapping.get('product_name', ''), '未知产品')),
                    device_id=str(row.get(col_mapping.get('device_id', ''), '')),
                    start_time=pd.to_datetime(row.get(col_mapping.get('start_time', ''))),
                    end_time=pd.to_datetime(row.get(col_mapping.get('end_time', ''))),
                    quantity=int(row.get(col_mapping.get('quantity', 0), 0) or 0),
                    batch_type=str(row.get(col_mapping.get('batch_type', ''), 'regular')),
                    storage_condition=str(row.get(col_mapping.get('storage_condition', ''), '')),
                    notes=str(row.get(col_mapping.get('notes', ''), ''))
                )
                batches.append(batch)
            except Exception as e:
                continue
        
        self.parsed_data['batch_records'].extend(batches)
        return batches
    
    def _detect_column(self, df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
        """检测列名"""
        df_columns_lower = [str(col).lower() for col in df.columns]
        
        for candidate in candidates:
            candidate_lower = candidate.lower()
            for i, col_lower in enumerate(df_columns_lower):
                if candidate_lower in col_lower or col_lower in candidate_lower:
                    return df.columns[i]
            if candidate in df.columns:
                return candidate
        
        return None
    
    def _infer_device_id(self, file_path: str, df: pd.DataFrame) -> str:
        """从文件或数据推断设备ID"""
        file_name = Path(file_path).stem
        
        if 'device_id' in df.columns:
            device_ids = df['device_id'].dropna().unique()
            if len(device_ids) == 1:
                return str(device_ids[0])
        
        import re
        patterns = [
            r'device[_-]?(\w+)',
            r'refrigerator[_-]?(\w+)',
            r'fridge[_-]?(\w+)',
            r'设备[_-]?(\w+)',
            r'冰箱[_-]?(\w+)',
        ]
        
        file_lower = file_name.lower()
        for pattern in patterns:
            match = re.search(pattern, file_lower, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return file_name
    
    def _parse_single_door_event(self, data: Dict, event_id: str) -> Optional[DoorEvent]:
        """解析单个开门事件"""
        try:
            device_id = str(data.get('device_id', data.get('设备号', 'unknown')))
            
            open_time = data.get('open_time', data.get('开门时间', data.get('start_time')))
            if isinstance(open_time, str):
                open_time = pd.to_datetime(open_time)
            
            close_time = data.get('close_time', data.get('关门时间', data.get('end_time')))
            if isinstance(close_time, str):
                close_time = pd.to_datetime(close_time) if close_time else None
            
            duration = data.get('duration_seconds', data.get('持续时间', data.get('duration')))
            if duration and not isinstance(duration, (int, float)):
                duration = float(str(duration).replace('秒', '').replace('s', '').strip())
            
            return DoorEvent(
                device_id=device_id,
                event_id=str(data.get('event_id', event_id)),
                open_time=open_time,
                close_time=close_time,
                duration_seconds=duration,
                event_type=str(data.get('event_type', 'door')),
                notes=str(data.get('notes', data.get('备注', '')))
            )
        except Exception:
            return None
    
    def _parse_single_calibration(self, data: Dict) -> Optional[CalibrationRecord]:
        """解析单个校准记录"""
        try:
            device_id = str(data.get('device_id', data.get('设备号', 'unknown')))
            
            cal_date = data.get('calibration_date', data.get('校准日期', data.get('date')))
            if isinstance(cal_date, str):
                cal_date = pd.to_datetime(cal_date)
            
            next_date = data.get('next_calibration_date', data.get('下次校准日期'))
            if isinstance(next_date, str):
                next_date = pd.to_datetime(next_date) if next_date else None
            
            offset = data.get('offset_value', data.get('偏移值', data.get('offset')))
            if offset is not None and not isinstance(offset, (int, float)):
                offset = float(str(offset).replace('°C', '').replace('℃', '').strip())
            
            return CalibrationRecord(
                device_id=device_id,
                calibration_date=cal_date,
                offset_value=float(offset or 0),
                offset_unit=str(data.get('offset_unit', data.get('单位', '°C'))),
                certificate_id=str(data.get('certificate_id', data.get('证书编号', ''))),
                calibration_method=str(data.get('calibration_method', data.get('校准方法', ''))),
                next_calibration_date=next_date,
                is_valid=bool(data.get('is_valid', data.get('有效', True)))
            )
        except Exception:
            return None
    
    def get_all_data(self) -> Dict:
        """获取所有解析后的数据"""
        return self.parsed_data.copy()
    
    def clear(self):
        """清空已解析的数据"""
        self.parsed_data = {
            'temperature_records': {},
            'door_events': [],
            'calibration_records': {},
            'batch_records': []
        }
