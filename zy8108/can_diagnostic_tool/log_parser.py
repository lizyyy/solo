"""
日志解析模块
负责解析candump格式的CAN日志，处理跨天时间戳和未知报文ID
"""

import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Iterator
from dataclasses import dataclass


@dataclass
class CANFrame:
    """表示单个CAN帧的数据结构"""
    timestamp: float
    can_id: int
    data: bytes
    extended: bool
    original_line: str
    is_unknown: bool = False


class LogParser:
    """CAN日志解析器
    
    支持candump -l 格式和标准文本格式，
    自动处理跨天时间戳和未知报文ID
    """
    
    def __init__(self):
        self.previous_timestamp = 0.0
        self.day_offset = 0
        self.total_frames = 0
        self.unknown_frames = 0
        self.unknown_ids: set = set()
    
    def parse_file(self, file_path: str) -> Iterator[CANFrame]:
        """
        解析CAN日志文件，返回CAN帧迭代器
        
        Args:
            file_path: 日志文件路径
            
        Yields:
            CANFrame: 解析后的CAN帧
        """
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                frame = self._parse_line(line)
                if frame:
                    self.total_frames += 1
                    if frame.is_unknown:
                        self.unknown_frames += 1
                        self.unknown_ids.add(frame.can_id)
                    yield frame
    
    def _parse_line(self, line: str) -> CANFrame:
        """
        解析单行日志
        
        支持多种candump格式:
        1. (1620000000.000000) can0 123#RTR
        2. (1620000000.000000) can0 123#DEADBEEF
        3.  candump -l 格式
        """
        # 标准格式: (timestamp) interface id#data
        standard_pattern = r'\((\d+\.?\d*)\)\s+(\w+)\s+([0-9A-Fa-f]+)#([0-9A-Fa-fRTrr]*)'
        match = re.match(standard_pattern, line)
        
        if match:
            timestamp_str, interface, can_id_str, data_str = match.groups()
            timestamp = self._adjust_timestamp(float(timestamp_str))
            can_id = int(can_id_str, 16)
            
            # 检查是否是扩展帧
            extended = len(can_id_str) > 3 or 'x' in can_id_str.lower()
            
            # 解析数据
            if 'RTR' in data_str.upper() or not data_str:
                data = b''
            else:
                try:
                    data = bytes.fromhex(data_str)
                except ValueError:
                    data = b''
            
            return CANFrame(
                timestamp=timestamp,
                can_id=can_id,
                data=data,
                extended=extended,
                original_line=line,
                is_unknown=False
            )
        
        # candump -l 格式: 时间戳 接口 标识 数据
        log_pattern = r'^(\d+\.\d+)\s+(\w+)\s+([0-9A-Fa-f]+)\s+([0-9A-Fa-f\s]+)$'
        match = re.match(log_pattern, line)
        
        if match:
            timestamp_str, interface, can_id_str, data_str = match.groups()
            timestamp = self._adjust_timestamp(float(timestamp_str))
            can_id = int(can_id_str, 16)
            
            # 解析数据
            data_bytes = []
            for byte_str in data_str.split():
                if byte_str:
                    try:
                        data_bytes.append(int(byte_str, 16))
                    except ValueError:
                        pass
            data = bytes(data_bytes)
            
            return CANFrame(
                timestamp=timestamp,
                can_id=can_id,
                data=data,
                extended=len(can_id_str) > 3,
                original_line=line,
                is_unknown=False
            )
        
        # 尝试解析更宽松的格式
        loose_pattern = r'([0-9A-Fa-f]+)#([0-9A-Fa-fRTrr]*)'
        match = re.search(loose_pattern, line)
        
        if match:
            can_id_str, data_str = match.groups()
            can_id = int(can_id_str, 16)
            
            # 使用递增的假时间戳
            timestamp = self._get_fake_timestamp()
            
            try:
                data = bytes.fromhex(data_str) if 'RTR' not in data_str.upper() else b''
            except ValueError:
                data = b''
            
            return CANFrame(
                timestamp=timestamp,
                can_id=can_id,
                data=data,
                extended=len(can_id_str) > 3,
                original_line=line,
                is_unknown=True  # 标记为可能未知格式
            )
        
        return None
    
    def _adjust_timestamp(self, timestamp: float) -> float:
        """
        调整时间戳以处理跨天情况
        
        当检测到时间戳突然变小（可能是跨越了午夜），
        自动添加一天的偏移量
        """
        if self.previous_timestamp == 0:
            self.previous_timestamp = timestamp
            return timestamp
        
        # 检测时间戳回退（可能跨天）
        if timestamp < self.previous_timestamp - 3600:  # 回退超过1小时
            self.day_offset += 1
        
        adjusted_timestamp = timestamp + (self.day_offset * 86400)
        self.previous_timestamp = timestamp
        
        return adjusted_timestamp
    
    def _get_fake_timestamp(self) -> float:
        """生成递增的假时间戳，用于无时间戳的日志"""
        fake_ts = self.previous_timestamp + 0.01
        self.previous_timestamp = fake_ts
        return fake_ts
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取解析统计信息"""
        return {
            'total_frames': self.total_frames,
            'unknown_frames': self.unknown_frames,
            'unknown_ids': sorted(list(self.unknown_ids)),
            'day_offsets_applied': self.day_offset
        }


def format_timestamp(timestamp: float) -> str:
    """
    将Unix时间戳格式化为可读字符串
    
    Args:
        timestamp: Unix时间戳（秒）
        
    Returns:
        格式化的时间字符串
    """
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]


def timestamp_to_datetime(timestamp: float) -> datetime:
    """
    将Unix时间戳转换为datetime对象
    
    Args:
        timestamp: Unix时间戳（秒）
        
    Returns:
        datetime对象
    """
    return datetime.fromtimestamp(timestamp)
