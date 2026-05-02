# -*- coding: utf-8 -*-
"""
解析校验模块 - 读取多源CSV数据并进行校验
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from dataclasses import dataclass, asdict, field
import re


@dataclass
class ValidationError:
    """校验错误"""
    row_number: int
    field: str
    error_type: str
    message: str


@dataclass
class ParseResult:
    """解析结果"""
    data: List[Dict]
    errors: List[ValidationError]
    warnings: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0
    
    @property
    def record_count(self) -> int:
        return len(self.data)


class DataParser:
    """数据解析器"""
    
    # 常见的时间格式
    TIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y%m%d %H%M%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
    ]
    
    def __init__(self):
        self.errors: List[ValidationError] = []
        self.warnings: List[str] = []
    
    def parse_timestamp(self, value: str) -> Optional[datetime]:
        """解析时间戳"""
        if not value or value.strip() == "":
            return None
        
        value = value.strip()
        
        for fmt in self.TIME_FORMATS:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        # 尝试解析Unix时间戳
        try:
            timestamp = float(value)
            if timestamp > 1e12:  # 毫秒级
                timestamp /= 1000
            return datetime.fromtimestamp(timestamp)
        except (ValueError, OSError):
            pass
        
        return None
    
    def parse_float(self, value: str, default: float = 0.0) -> float:
        """解析浮点数"""
        if not value or value.strip() == "":
            return default
        
        value = value.strip()
        # 移除逗号等千分位分隔符
        value = value.replace(",", "")
        
        try:
            return float(value)
        except ValueError:
            return default
    
    def parse_int(self, value: str, default: int = 0) -> int:
        """解析整数"""
        if not value or value.strip() == "":
            return default
        
        value = value.strip()
        value = value.replace(",", "")
        
        try:
            return int(value)
        except ValueError:
            return default
    
    def validate_required(self, value: Any, row: int, field: str) -> bool:
        """校验必填字段"""
        if value is None or (isinstance(value, str) and value.strip() == ""):
            self.errors.append(ValidationError(
                row_number=row,
                field=field,
                error_type="missing",
                message=f"必填字段缺失: {field}"
            ))
            return False
        return True
    
    def validate_range(self, value: float, row: int, field: str, 
                       min_val: Optional[float] = None, 
                       max_val: Optional[float] = None) -> bool:
        """校验数值范围"""
        if min_val is not None and value < min_val:
            self.errors.append(ValidationError(
                row_number=row,
                field=field,
                error_type="range",
                message=f"字段 {field} 值 {value} 小于最小值 {min_val}"
            ))
            return False
        
        if max_val is not None and value > max_val:
            self.errors.append(ValidationError(
                row_number=row,
                field=field,
                error_type="range",
                message=f"字段 {field} 值 {value} 大于最大值 {max_val}"
            ))
            return False
        
        return True
    
    def read_csv_file(self, filepath: Union[str, Path]) -> List[Dict]:
        """读取CSV文件"""
        filepath = Path(filepath)
        
        if not filepath.exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        # 尝试不同的编码
        encodings = ["utf-8-sig", "gbk", "gb2312", "utf-8", "latin-1"]
        
        for encoding in encodings:
            try:
                with open(filepath, "r", encoding=encoding) as f:
                    # 检测分隔符
                    first_line = f.readline()
                    f.seek(0)
                    
                    delimiter = ","
                    if "\t" in first_line:
                        delimiter = "\t"
                    elif ";" in first_line:
                        delimiter = ";"
                    
                    reader = csv.DictReader(f, delimiter=delimiter)
                    return [row for row in reader]
                    
            except UnicodeDecodeError:
                continue
            except Exception:
                continue
        
        raise ValueError(f"无法读取文件: {filepath}，尝试了编码: {encodings}")
    
    def save_json(self, data: List[Dict], filepath: Union[str, Path]):
        """保存数据到JSON文件"""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)


def parse_pressure_csv(filepath: Union[str, Path], 
                        network: Optional[Any] = None) -> List[Dict]:
    """
    解析压力传感器CSV数据
    
    期望的CSV格式:
    - 时间戳 (timestamp, time, datetime)
    - 传感器ID (sensor_id, sensor, id)
    - 压力值 (pressure, value, 压力)
    - 单位 (unit, 单位) - 可选
    """
    parser = DataParser()
    raw_data = parser.read_csv_file(filepath)
    
    results = []
    
    for i, row in enumerate(raw_data, start=2):  # 从第2行开始（跳过表头）
        # 查找时间戳字段
        timestamp = None
        for key in ["timestamp", "time", "datetime", "日期时间", "时间"]:
            if key in row:
                timestamp = parser.parse_timestamp(row[key])
                break
        
        if timestamp:
            parser.validate_required(timestamp, i, "timestamp")
        
        # 查找传感器ID
        sensor_id = None
        for key in ["sensor_id", "sensor", "id", "传感器ID", "传感器"]:
            if key in row and row[key].strip():
                sensor_id = row[key].strip()
                break
        
        parser.validate_required(sensor_id, i, "sensor_id")
        
        # 查找压力值
        pressure = None
        for key in ["pressure", "value", "压力", "压力值", "数值"]:
            if key in row:
                pressure = parser.parse_float(row[key])
                break
        
        parser.validate_required(pressure, i, "pressure")
        if pressure is not None:
            parser.validate_range(pressure, i, "pressure", min_val=0, max_val=2.0)
        
        # 查找单位
        unit = "MPa"
        for key in ["unit", "单位", "计量单位"]:
            if key in row and row[key].strip():
                unit = row[key].strip()
                break
        
        # 构建结果
        result = {
            "timestamp": timestamp.isoformat() if timestamp else None,
            "sensor_id": sensor_id,
            "pressure": pressure,
            "unit": unit,
            "raw_data": row
        }
        
        results.append(result)
    
    # 按时间戳排序
    results.sort(key=lambda x: x["timestamp"] or "")
    
    return results


def parse_acoustic_csv(filepath: Union[str, Path],
                        network: Optional[Any] = None) -> List[Dict]:
    """
    解析听漏仪巡检CSV数据
    
    期望的CSV格式:
    - 时间戳 (timestamp, time, datetime)
    - 位置 (location, position, 位置, 地点)
    - 声强/分贝值 (level, amplitude, db, 声强, 分贝)
    - 频率特征 (frequency, freq, 频率) - 可选
    - 异常评分 (score, anomaly_score, 评分) - 可选
    """
    parser = DataParser()
    raw_data = parser.read_csv_file(filepath)
    
    results = []
    
    for i, row in enumerate(raw_data, start=2):
        # 查找时间戳
        timestamp = None
        for key in ["timestamp", "time", "datetime", "日期时间", "巡检时间"]:
            if key in row:
                timestamp = parser.parse_timestamp(row[key])
                break
        
        parser.validate_required(timestamp, i, "timestamp")
        
        # 查找位置
        location = None
        for key in ["location", "position", "地点", "位置", "巡检位置", "管段"]:
            if key in row and row[key].strip():
                location = row[key].strip()
                break
        
        parser.validate_required(location, i, "location")
        
        # 查找声强值
        level = None
        for key in ["level", "amplitude", "db", "dB", "声强", "分贝", "噪声值", "振动值"]:
            if key in row:
                level = parser.parse_float(row[key])
                break
        
        parser.validate_required(level, i, "level")
        
        # 查找频率
        frequency = None
        for key in ["frequency", "freq", "主频", "频率"]:
            if key in row:
                frequency = parser.parse_float(row[key])
                break
        
        # 查找异常评分
        anomaly_score = None
        for key in ["score", "anomaly_score", "异常评分", "评分"]:
            if key in row:
                anomaly_score = parser.parse_float(row[key])
                break
        
        # 查找设备ID
        device_id = None
        for key in ["device_id", "device", "仪器ID", "设备号"]:
            if key in row and row[key].strip():
                device_id = row[key].strip()
                break
        
        # 构建结果
        result = {
            "timestamp": timestamp.isoformat() if timestamp else None,
            "location": location,
            "level": level,
            "frequency": frequency,
            "anomaly_score": anomaly_score,
            "device_id": device_id,
            "raw_data": row
        }
        
        results.append(result)
    
    # 按时间戳排序
    results.sort(key=lambda x: x["timestamp"] or "")
    
    return results


def parse_valve_csv(filepath: Union[str, Path],
                     network: Optional[Any] = None) -> List[Dict]:
    """
    解析阀门台账CSV数据
    
    期望的CSV格式:
    - 阀门ID (valve_id, id, 阀门ID)
    - 阀门名称 (name, 名称, 阀门名称)
    - 位置 (location, 位置, 地点)
    - 状态 (status, state, 状态)
    - 管径 (diameter, 管径, 直径)
    - 所在管段 (section, pipe_section, 管段)
    - 优先级 (priority, 优先级)
    """
    parser = DataParser()
    raw_data = parser.read_csv_file(filepath)
    
    results = []
    
    for i, row in enumerate(raw_data, start=2):
        # 查找阀门ID
        valve_id = None
        for key in ["valve_id", "id", "阀门ID", "编号", "阀门编号"]:
            if key in row and row[key].strip():
                valve_id = row[key].strip()
                break
        
        parser.validate_required(valve_id, i, "valve_id")
        
        # 查找阀门名称
        name = None
        for key in ["name", "名称", "阀门名称", "描述"]:
            if key in row and row[key].strip():
                name = row[key].strip()
                break
        
        # 查找位置
        location = None
        for key in ["location", "位置", "地点", "安装位置", "地址"]:
            if key in row and row[key].strip():
                location = row[key].strip()
                break
        
        # 查找状态
        status = "未知"
        for key in ["status", "state", "状态", "阀门状态"]:
            if key in row and row[key].strip():
                status = row[key].strip()
                break
        
        # 查找管径
        diameter = None
        for key in ["diameter", "管径", "直径", "口径"]:
            if key in row:
                diameter = parser.parse_float(row[key])
                break
        
        # 查找管段
        section = None
        for key in ["section", "pipe_section", "管段", "所属管段", "所在管段"]:
            if key in row and row[key].strip():
                section = row[key].strip()
                break
        
        # 查找优先级
        priority = None
        for key in ["priority", "优先级", "操作优先级"]:
            if key in row:
                priority = parser.parse_int(row[key])
                break
        
        # 查找坐标
        x = None
        y = None
        for key in ["x", "longitude", "经度", "X坐标"]:
            if key in row:
                x = parser.parse_float(row[key])
                break
        for key in ["y", "latitude", "纬度", "Y坐标"]:
            if key in row:
                y = parser.parse_float(row[key])
                break
        
        # 构建结果
        result = {
            "valve_id": valve_id,
            "name": name or valve_id,
            "location": location,
            "status": status,
            "diameter": diameter,
            "section_id": section,
            "priority": priority,
            "x": x,
            "y": y,
            "raw_data": row
        }
        
        results.append(result)
    
    return results


def parse_flow_csv(filepath: Union[str, Path],
                    network: Optional[Any] = None) -> List[Dict]:
    """
    解析流量数据CSV
    
    期望的CSV格式:
    - 时间戳 (timestamp, time, datetime)
    - 传感器ID/位置 (sensor_id, location, 位置)
    - 流量值 (flow, value, 流量, 瞬时流量)
    - 累计流量 (total, accumulated, 累计流量) - 可选
    """
    parser = DataParser()
    raw_data = parser.read_csv_file(filepath)
    
    results = []
    
    for i, row in enumerate(raw_data, start=2):
        # 查找时间戳
        timestamp = None
        for key in ["timestamp", "time", "datetime", "日期时间"]:
            if key in row:
                timestamp = parser.parse_timestamp(row[key])
                break
        
        parser.validate_required(timestamp, i, "timestamp")
        
        # 查找位置/传感器
        location = None
        for key in ["sensor_id", "location", "位置", "测点", "监测点"]:
            if key in row and row[key].strip():
                location = row[key].strip()
                break
        
        # 查找流量值
        flow = None
        for key in ["flow", "value", "流量", "瞬时流量", "瞬时值"]:
            if key in row:
                flow = parser.parse_float(row[key])
                break
        
        parser.validate_required(flow, i, "flow")
        
        # 查找累计流量
        total_flow = None
        for key in ["total", "accumulated", "累计流量", "累计值"]:
            if key in row:
                total_flow = parser.parse_float(row[key])
                break
        
        # 构建结果
        result = {
            "timestamp": timestamp.isoformat() if timestamp else None,
            "location": location,
            "flow": flow,
            "total_flow": total_flow,
            "raw_data": row
        }
        
        results.append(result)
    
    # 按时间戳排序
    results.sort(key=lambda x: x["timestamp"] or "")
    
    return results
