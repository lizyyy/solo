"""
JSON解析器 - 用于解析传感器时间戳JSON文件
"""
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class SensorTimestamp:
    """传感器时间戳数据结构"""
    timestamp: float
    sensor_id: str
    sensor_type: str
    raw_data: Dict[str, Any] = field(default_factory=dict)
    sequence_number: Optional[int] = None
    status: str = "ok"
    channel: str = "default"
    
    def __post_init__(self):
        if isinstance(self.raw_data, str):
            try:
                self.raw_data = json.loads(self.raw_data)
            except (json.JSONDecodeError, TypeError):
                self.raw_data = {}


class SensorJSONParser:
    """传感器时间戳JSON解析器"""
    
    def __init__(self, expected_fields: Optional[List[str]] = None):
        """
        初始化JSON解析器
        
        Args:
            expected_fields: 期望的字段列表，如果为None则使用默认字段
        """
        self.expected_fields = expected_fields or [
            "timestamp", "sensor_id", "sensor_type", "data", "sequence_number"
        ]
        self.sensor_data: List[SensorTimestamp] = []
        
    def parse_file(self, file_path: str) -> List[SensorTimestamp]:
        """
        解析JSON文件
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            解析后的传感器时间戳列表
        """
        self.sensor_data = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 检查数据格式
        if isinstance(data, list):
            for item in data:
                sensor = self._parse_item(item)
                if sensor:
                    self.sensor_data.append(sensor)
        elif isinstance(data, dict):
            # 检查是否是单个传感器数据还是包含数组的对象
            if "sensors" in data and isinstance(data["sensors"], list):
                for item in data["sensors"]:
                    sensor = self._parse_item(item)
                    if sensor:
                        self.sensor_data.append(sensor)
            elif "timestamp" in data and "sensor_id" in data:
                sensor = self._parse_item(data)
                if sensor:
                    self.sensor_data.append(sensor)
            else:
                # 尝试解析为传感器ID到数据的映射
                for sensor_id, item in data.items():
                    if isinstance(item, dict):
                        item["sensor_id"] = sensor_id
                        sensor = self._parse_item(item)
                        if sensor:
                            self.sensor_data.append(sensor)
        
        # 按时间戳排序
        self.sensor_data.sort(key=lambda x: x.timestamp)
        
        return self.sensor_data
    
    def _parse_item(self, item: Dict[str, Any]) -> Optional[SensorTimestamp]:
        """
        解析单个传感器数据项
        
        Args:
            item: 传感器数据字典
            
        Returns:
            解析后的传感器时间戳对象，如果解析失败则返回None
        """
        try:
            # 解析时间戳
            timestamp = self._parse_timestamp(item.get("timestamp"))
            
            # 获取传感器ID
            sensor_id = item.get("sensor_id", item.get("id", "unknown"))
            
            # 获取传感器类型
            sensor_type = item.get("sensor_type", item.get("type", "unknown"))
            
            # 获取序列号
            sequence_number = item.get("sequence_number", item.get("seq", item.get("sequence")))
            if sequence_number is not None:
                try:
                    sequence_number = int(sequence_number)
                except (ValueError, TypeError):
                    sequence_number = None
            
            # 获取状态
            status = item.get("status", item.get("state", "ok"))
            
            # 获取通道
            channel = item.get("channel", item.get("port", "default"))
            
            # 获取原始数据
            raw_data = item.get("data", item.get("raw_data", item))
            if not isinstance(raw_data, dict):
                raw_data = {"value": raw_data}
            
            return SensorTimestamp(
                timestamp=timestamp,
                sensor_id=sensor_id,
                sensor_type=sensor_type,
                sequence_number=sequence_number,
                status=status,
                channel=channel,
                raw_data=raw_data
            )
            
        except Exception as e:
            # 记录解析错误但不中断整个解析过程
            print(f"解析传感器数据时出错: {e}, 数据: {item}")
            return None
    
    def _parse_timestamp(self, timestamp_value: Any) -> float:
        """
        解析时间戳，支持多种格式
        
        Args:
            timestamp_value: 时间戳值，可以是浮点数、整数或字符串
            
        Returns:
            浮点型时间戳（秒）
        """
        if timestamp_value is None:
            raise ValueError("时间戳不能为None")
        
        # 如果已经是数字类型
        if isinstance(timestamp_value, (int, float)):
            return float(timestamp_value)
        
        # 如果是字符串
        timestamp_str = str(timestamp_value)
        
        # 尝试直接解析为浮点数
        try:
            return float(timestamp_str)
        except ValueError:
            pass
        
        # 尝试解析为ISO格式的时间
        try:
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            return dt.timestamp()
        except ValueError:
            pass
        
        # 尝试解析为常见的日期时间格式
        for fmt in [
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S.%f",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S"
        ]:
            try:
                dt = datetime.strptime(timestamp_str, fmt)
                return dt.timestamp()
            except ValueError:
                continue
        
        raise ValueError(f"无法解析时间戳: {timestamp_value}")
    
    def get_sensors_by_id(self, sensor_id: str) -> List[SensorTimestamp]:
        """
        根据传感器ID过滤数据
        
        Args:
            sensor_id: 传感器ID
            
        Returns:
            匹配的传感器数据列表
        """
        return [sensor for sensor in self.sensor_data if sensor.sensor_id == sensor_id]
    
    def get_sensors_by_type(self, sensor_type: str) -> List[SensorTimestamp]:
        """
        根据传感器类型过滤数据
        
        Args:
            sensor_type: 传感器类型
            
        Returns:
            匹配的传感器数据列表
        """
        return [sensor for sensor in self.sensor_data if sensor.sensor_type == sensor_type]
    
    def get_sensors_by_time_range(self, start_time: float, end_time: float) -> List[SensorTimestamp]:
        """
        根据时间范围过滤数据
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            匹配的传感器数据列表
        """
        return [
            sensor for sensor in self.sensor_data 
            if start_time <= sensor.timestamp <= end_time
        ]
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取解析统计信息
        
        Returns:
            统计信息字典
        """
        if not self.sensor_data:
            return {
                "total_sensors": 0,
                "time_range": None,
                "unique_sensor_ids": [],
                "unique_sensor_types": [],
                "sensor_counts": {}
            }
        
        sensor_ids = set(sensor.sensor_id for sensor in self.sensor_data)
        sensor_types = set(sensor.sensor_type for sensor in self.sensor_data)
        
        # 统计每个传感器的数据量
        sensor_counts = {}
        for sensor in self.sensor_data:
            if sensor.sensor_id not in sensor_counts:
                sensor_counts[sensor.sensor_id] = 0
            sensor_counts[sensor.sensor_id] += 1
        
        return {
            "total_sensors": len(self.sensor_data),
            "time_range": {
                "start": self.sensor_data[0].timestamp,
                "end": self.sensor_data[-1].timestamp,
                "duration": self.sensor_data[-1].timestamp - self.sensor_data[0].timestamp
            },
            "unique_sensor_ids": sorted(list(sensor_ids)),
            "unique_sensor_types": sorted(list(sensor_types)),
            "sensor_counts": sensor_counts
        }
