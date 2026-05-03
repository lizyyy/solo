"""
压力数据解析器
处理JSONL格式的压力传感器数据
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
import json


@dataclass
class PressureReading:
    """压力读数记录"""
    sensor_id: str
    timestamp: datetime
    pressure: float
    is_valid: bool = True
    is_gap: bool = False


@dataclass
class PressureSensor:
    """压力传感器信息"""
    id: str
    node_id: str
    readings: List[PressureReading] = field(default_factory=list)


class PressureParser:
    """压力数据解析器（JSONL格式）"""
    
    def __init__(self):
        self.sensors: Dict[str, PressureSensor] = {}
        self._date_format = "%Y-%m-%d %H:%M:%S"
    
    def parse(self, file_path: str) -> 'PressureParser':
        """解析JSONL文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        data = json.loads(line)
                        self._process_record(data)
                    except json.JSONDecodeError:
                        continue
        
        self._sort_readings()
        return self
    
    def _process_record(self, data: Dict):
        """处理单条JSON记录"""
        sensor_id = str(data['sensor_id'])
        
        if sensor_id not in self.sensors:
            self.sensors[sensor_id] = PressureSensor(
                id=sensor_id,
                node_id=str(data.get('node_id', ''))
            )
        
        timestamp = datetime.strptime(data['timestamp'], self._date_format)
        pressure = float(data['pressure'])
        
        reading = PressureReading(
            sensor_id=sensor_id,
            timestamp=timestamp,
            pressure=pressure
        )
        
        self.sensors[sensor_id].readings.append(reading)
    
    def _sort_readings(self):
        """按时间排序读数"""
        for sensor in self.sensors.values():
            sensor.readings.sort(key=lambda x: x.timestamp)
    
    def validate(self) -> List[str]:
        """验证数据完整性"""
        errors = []
        
        for sensor_id, sensor in self.sensors.items():
            if not sensor.readings:
                errors.append(f"压力传感器 {sensor_id}: 没有读数记录")
                continue
            
            prev_reading = None
            for reading in sensor.readings:
                if reading.pressure < 0:
                    errors.append(f"压力传感器 {sensor_id} 在 {reading.timestamp}: 压力值为负数")
                
                if reading.pressure > 1.6:
                    errors.append(f"压力传感器 {sensor_id} 在 {reading.timestamp}: 压力值异常偏高 (>1.6MPa)")
                
                if prev_reading:
                    if reading.timestamp < prev_reading.timestamp:
                        errors.append(f"压力传感器 {sensor_id}: 时间戳顺序异常")
                    
                    time_diff = (reading.timestamp - prev_reading.timestamp).total_seconds()
                    
                    if time_diff > 300:
                        pass
                
                prev_reading = reading
        
        return errors
    
    def detect_data_gaps(self, max_interval_seconds: int = 120) -> Dict[str, List[tuple]]:
        """检测数据断采"""
        gaps = {}
        
        for sensor_id, sensor in self.sensors.items():
            if len(sensor.readings) < 2:
                continue
            
            sensor_gaps = []
            prev_reading = None
            
            for reading in sensor.readings:
                if prev_reading:
                    time_diff = (reading.timestamp - prev_reading.timestamp).total_seconds()
                    if time_diff > max_interval_seconds:
                        sensor_gaps.append((prev_reading.timestamp, reading.timestamp, time_diff))
                
                prev_reading = reading
            
            if sensor_gaps:
                gaps[sensor_id] = sensor_gaps
        
        return gaps
    
    def get_sensor_by_node(self, node_id: str) -> Optional[PressureSensor]:
        """根据节点ID获取压力传感器"""
        for sensor in self.sensors.values():
            if sensor.node_id == node_id:
                return sensor
        return None
