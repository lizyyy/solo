"""数据解析模块 - 负责解析各类CSV数据文件。"""

import csv
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

import numpy as np
from dateutil import parser as date_parser

from zha_beng_yan_suan_qi.types import (
    WaterLevelRecord,
    RainfallRecord,
    PumpCurve,
    GateLimit,
)


class DataParser:
    """数据解析器类。"""
    
    @staticmethod
    def _parse_timestamp(value: str) -> datetime:
        """解析时间戳，支持多种格式。"""
        value = value.strip()
        try:
            return date_parser.parse(value)
        except ValueError:
            formats = [
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d %H:%M:%S",
                "%Y/%m/%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析时间戳: {value}")
    
    @staticmethod
    def _parse_float(value: str, default: Optional[float] = None) -> Optional[float]:
        """解析浮点数，处理空值。"""
        if not value or value.strip() == "":
            return default
        try:
            return float(value.strip())
        except ValueError:
            return default
    
    @staticmethod
    def _parse_int(value: str, default: Optional[int] = None) -> Optional[int]:
        """解析整数，处理空值。"""
        if not value or value.strip() == "":
            return default
        try:
            return int(value.strip())
        except ValueError:
            return default
    
    def parse_water_levels(self, file_path: str) -> List[WaterLevelRecord]:
        """
        解析河道水位CSV文件。
        
        支持的列名:
            - timestamp, time, 时间, 时间戳
            - inner_level, inner, 内水位, 内河水位
            - outer_level, outer, 外水位, 外河水位 (可选)
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            水位记录列表
        """
        records = []
        path = Path(file_path)
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            fieldnames = [fn.strip().lower() for fn in reader.fieldnames] if reader.fieldnames else []
            
            timestamp_cols = ['timestamp', 'time', '时间', '时间戳']
            inner_level_cols = ['inner_level', 'inner', '内水位', '内河水位', 'level']
            outer_level_cols = ['outer_level', 'outer', '外水位', '外河水位']
            
            for row in reader:
                row_lower = {k.strip().lower(): v for k, v in row.items()}
                
                timestamp = None
                for col in timestamp_cols:
                    if col in row_lower and row_lower[col]:
                        try:
                            timestamp = self._parse_timestamp(row_lower[col])
                            break
                        except ValueError:
                            continue
                
                if timestamp is None:
                    continue
                
                inner_level = None
                for col in inner_level_cols:
                    if col in row_lower:
                        inner_level = self._parse_float(row_lower[col])
                        if inner_level is not None:
                            break
                
                if inner_level is None:
                    continue
                
                outer_level = None
                for col in outer_level_cols:
                    if col in row_lower:
                        outer_level = self._parse_float(row_lower[col])
                        if outer_level is not None:
                            break
                
                records.append(WaterLevelRecord(
                    timestamp=timestamp,
                    inner_level=inner_level,
                    outer_level=outer_level,
                ))
        
        records.sort(key=lambda r: r.timestamp)
        return records
    
    def parse_rainfall(self, file_path: str) -> List[RainfallRecord]:
        """
        解析降雨预报CSV文件。
        
        支持的列名:
            - timestamp, time, 时间, 时间戳
            - rainfall_mm, rainfall, 降雨量, mm
            - duration_hours, duration, 时长 (可选，默认1小时)
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            降雨记录列表
        """
        records = []
        path = Path(file_path)
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            timestamp_cols = ['timestamp', 'time', '时间', '时间戳']
            rainfall_cols = ['rainfall_mm', 'rainfall', '降雨量', 'mm', '降水']
            duration_cols = ['duration_hours', 'duration', '时长', '小时']
            
            for row in reader:
                row_lower = {k.strip().lower(): v for k, v in row.items()}
                
                timestamp = None
                for col in timestamp_cols:
                    if col in row_lower and row_lower[col]:
                        try:
                            timestamp = self._parse_timestamp(row_lower[col])
                            break
                        except ValueError:
                            continue
                
                if timestamp is None:
                    continue
                
                rainfall_mm = 0.0
                for col in rainfall_cols:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col], 0.0)
                        if val is not None:
                            rainfall_mm = val
                            break
                
                duration_hours = 1.0
                for col in duration_cols:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col], 1.0)
                        if val is not None and val > 0:
                            duration_hours = val
                            break
                
                records.append(RainfallRecord(
                    timestamp=timestamp,
                    rainfall_mm=rainfall_mm,
                    duration_hours=duration_hours,
                ))
        
        records.sort(key=lambda r: r.timestamp)
        return records
    
    def parse_pump_curves(self, file_path: str) -> List[PumpCurve]:
        """
        解析泵站曲线CSV文件。
        
        每一行代表一台泵的曲线数据点或额定参数。
        支持两种格式：
            1. 每行一台泵，包含列表形式的曲线数据
            2. 每行一个数据点，按泵ID分组
        
        支持的列名:
            - pump_id, id, 泵编号, 泵ID
            - pump_name, name, 泵名称, 名称
            - head_m, head, 扬程, 扬程m (可多个，如 head_m_1, head_m_2)
            - flow_m3h, flow, 流量, 流量m3h (可多个)
            - power_kw, power, 功率, 功率kw (可多个)
            - rated_flow, 额定流量
            - rated_head, 额定扬程
            - rated_power, 额定功率
            - min_start_head, 最小启动扬程
            - max_start_head, 最大启动扬程
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            泵曲线列表
        """
        pumps: Dict[str, Dict[str, Any]] = {}
        path = Path(file_path)
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                row_lower = {k.strip().lower(): v for k, v in row.items()}
                
                pump_id = None
                for col in ['pump_id', 'id', '泵编号', '泵ID']:
                    if col in row_lower and row_lower[col]:
                        pump_id = str(row_lower[col]).strip()
                        break
                
                if not pump_id:
                    continue
                
                if pump_id not in pumps:
                    pumps[pump_id] = {
                        'pump_id': pump_id,
                        'pump_name': '',
                        'head_m': [],
                        'flow_m3h': [],
                        'power_kw': [],
                        'rated_flow_m3h': 0.0,
                        'rated_head_m': 0.0,
                        'rated_power_kw': 0.0,
                        'min_start_head_m': None,
                        'max_start_head_m': None,
                    }
                
                pump_data = pumps[pump_id]
                
                for col in ['pump_name', 'name', '泵名称', '名称']:
                    if col in row_lower and row_lower[col]:
                        pump_data['pump_name'] = str(row_lower[col]).strip()
                        break
                
                for col in ['rated_flow', '额定流量', 'rated_flow_m3h']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            pump_data['rated_flow_m3h'] = val
                            break
                
                for col in ['rated_head', '额定扬程', 'rated_head_m']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            pump_data['rated_head_m'] = val
                            break
                
                for col in ['rated_power', '额定功率', 'rated_power_kw']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            pump_data['rated_power_kw'] = val
                            break
                
                for col in ['min_start_head', '最小启动扬程', 'min_start_head_m']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            pump_data['min_start_head_m'] = val
                            break
                
                for col in ['max_start_head', '最大启动扬程', 'max_start_head_m']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            pump_data['max_start_head_m'] = val
                            break
                
                head = None
                for col in ['head_m', 'head', '扬程', '扬程m']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            head = val
                            break
                
                flow = None
                for col in ['flow_m3h', 'flow', '流量', '流量m3h']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            flow = val
                            break
                
                power = None
                for col in ['power_kw', 'power', '功率', '功率kw']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            power = val
                            break
                
                if head is not None and flow is not None:
                    pump_data['head_m'].append(head)
                    pump_data['flow_m3h'].append(flow)
                    if power is not None:
                        pump_data['power_kw'].append(power)
                
                for key, value in row_lower.items():
                    if 'head_m' in key and '_' in key:
                        val = self._parse_float(value)
                        if val is not None and val not in pump_data['head_m']:
                            pump_data['head_m'].append(val)
                    if 'flow_m3h' in key and '_' in key:
                        val = self._parse_float(value)
                        if val is not None and val not in pump_data['flow_m3h']:
                            pump_data['flow_m3h'].append(val)
                    if 'power_kw' in key and '_' in key:
                        val = self._parse_float(value)
                        if val is not None and val not in pump_data['power_kw']:
                            pump_data['power_kw'].append(val)
        
        result = []
        for pump_id, data in pumps.items():
            if not data['head_m']:
                data['head_m'] = [0, data['rated_head_m']]
                data['flow_m3h'] = [data['rated_flow_m3h'], 0]
                if not data['power_kw']:
                    data['power_kw'] = [0, data['rated_power_kw']]
            
            if not data['power_kw']:
                data['power_kw'] = [data['rated_power_kw']] * len(data['head_m'])
            
            if len(data['power_kw']) != len(data['head_m']):
                avg_power = sum(data['power_kw']) / len(data['power_kw']) if data['power_kw'] else data['rated_power_kw']
                data['power_kw'] = [avg_power] * len(data['head_m'])
            
            sorted_indices = np.argsort(data['head_m'])
            data['head_m'] = [data['head_m'][i] for i in sorted_indices]
            data['flow_m3h'] = [data['flow_m3h'][i] for i in sorted_indices]
            data['power_kw'] = [data['power_kw'][i] for i in sorted_indices]
            
            result.append(PumpCurve(
                pump_id=data['pump_id'],
                pump_name=data['pump_name'] or f"泵{pump_id}",
                head_m=data['head_m'],
                flow_m3h=data['flow_m3h'],
                power_kw=data['power_kw'],
                rated_flow_m3h=data['rated_flow_m3h'],
                rated_head_m=data['rated_head_m'],
                rated_power_kw=data['rated_power_kw'],
                min_start_head_m=data['min_start_head_m'],
                max_start_head_m=data['max_start_head_m'],
            ))
        
        return result
    
    def parse_gate_limits(self, file_path: str) -> List[GateLimit]:
        """
        解析闸门开度限制CSV文件。
        
        支持的列名:
            - gate_id, id, 闸门编号, 闸门ID
            - gate_name, name, 闸门名称, 名称
            - max_opening, max, 最大开度, 开度上限
            - min_opening, min, 最小开度, 开度下限
            - discharge_coefficient, cd, 流量系数
            - width_m, width, 闸宽, 宽度
            - sill_elevation, sill, 堰顶高程, 底槛高程
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            闸门限制列表
        """
        gates = []
        path = Path(file_path)
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                row_lower = {k.strip().lower(): v for k, v in row.items()}
                
                gate_id = None
                for col in ['gate_id', 'id', '闸门编号', '闸门ID']:
                    if col in row_lower and row_lower[col]:
                        gate_id = str(row_lower[col]).strip()
                        break
                
                if not gate_id:
                    continue
                
                gate_name = ''
                for col in ['gate_name', 'name', '闸门名称', '名称']:
                    if col in row_lower and row_lower[col]:
                        gate_name = str(row_lower[col]).strip()
                        break
                
                max_opening = 1.0
                for col in ['max_opening', 'max', '最大开度', '开度上限']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            max_opening = val
                            break
                
                min_opening = 0.0
                for col in ['min_opening', 'min', '最小开度', '开度下限']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            min_opening = val
                            break
                
                discharge_coefficient = 0.6
                for col in ['discharge_coefficient', 'cd', '流量系数']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            discharge_coefficient = val
                            break
                
                width_m = 1.0
                for col in ['width_m', 'width', '闸宽', '宽度']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            width_m = val
                            break
                
                sill_elevation = 0.0
                for col in ['sill_elevation', 'sill', '堰顶高程', '底槛高程', '堰高']:
                    if col in row_lower:
                        val = self._parse_float(row_lower[col])
                        if val is not None:
                            sill_elevation = val
                            break
                
                gates.append(GateLimit(
                    gate_id=gate_id,
                    gate_name=gate_name or f"闸门{gate_id}",
                    max_opening=max_opening,
                    min_opening=min_opening,
                    discharge_coefficient=discharge_coefficient,
                    width_m=width_m,
                    sill_elevation=sill_elevation,
                ))
        
        return gates
