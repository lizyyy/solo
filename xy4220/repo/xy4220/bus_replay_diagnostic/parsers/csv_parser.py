"""
CSV解析器 - 用于解析CAN帧日志CSV文件
"""
import csv
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CANFrame:
    """CAN帧数据结构"""
    timestamp: float
    can_id: int
    dlc: int
    data: List[int]
    is_extended: bool = False
    is_remote: bool = False
    is_error: bool = False
    channel: str = "can0"
    raw_data: str = ""
    
    def __post_init__(self):
        if isinstance(self.data, str):
            self.data = [int(x, 16) for x in self.data.split()]
        elif not isinstance(self.data, list):
            self.data = []


class CANCSVParser:
    """CAN帧CSV解析器"""
    
    def __init__(self, expected_columns: Optional[List[str]] = None):
        """
        初始化CSV解析器
        
        Args:
            expected_columns: 期望的列名列表，如果为None则使用默认列名
        """
        self.expected_columns = expected_columns or [
            "timestamp", "can_id", "dlc", "data", 
            "is_extended", "is_remote", "is_error", "channel"
        ]
        self.frames: List[CANFrame] = []
        
    def parse_file(self, file_path: str) -> List[CANFrame]:
        """
        解析CSV文件
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            解析后的CAN帧列表
        """
        self.frames = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # 检查列名
            self._validate_columns(reader.fieldnames)
            
            for row in reader:
                frame = self._parse_row(row)
                if frame:
                    self.frames.append(frame)
        
        # 按时间戳排序
        self.frames.sort(key=lambda x: x.timestamp)
        
        return self.frames
    
    def _validate_columns(self, fieldnames: Optional[List[str]]):
        """
        验证CSV文件的列名
        
        Args:
            fieldnames: CSV文件的列名列表
        """
        if not fieldnames:
            raise ValueError("CSV文件没有列名")
        
        # 检查必要的列是否存在
        required_columns = ["timestamp", "can_id", "dlc", "data"]
        for col in required_columns:
            if col not in fieldnames:
                raise ValueError(f"CSV文件缺少必要的列: {col}")
    
    def _parse_row(self, row: Dict[str, str]) -> Optional[CANFrame]:
        """
        解析单行CSV数据
        
        Args:
            row: CSV行数据
            
        Returns:
            解析后的CAN帧对象，如果解析失败则返回None
        """
        try:
            # 解析时间戳
            timestamp = self._parse_timestamp(row.get("timestamp", ""))
            
            # 解析CAN ID
            can_id_str = row.get("can_id", "0")
            if can_id_str.startswith("0x") or can_id_str.startswith("0X"):
                can_id = int(can_id_str, 16)
            else:
                can_id = int(can_id_str)
            
            # 解析数据长度
            dlc = int(row.get("dlc", "0"))
            
            # 解析数据
            data_str = row.get("data", "")
            data = self._parse_data(data_str)
            
            # 解析其他字段
            is_extended = self._parse_bool(row.get("is_extended", "false"))
            is_remote = self._parse_bool(row.get("is_remote", "false"))
            is_error = self._parse_bool(row.get("is_error", "false"))
            channel = row.get("channel", "can0")
            
            return CANFrame(
                timestamp=timestamp,
                can_id=can_id,
                dlc=dlc,
                data=data,
                is_extended=is_extended,
                is_remote=is_remote,
                is_error=is_error,
                channel=channel,
                raw_data=str(row)
            )
            
        except Exception as e:
            # 记录解析错误但不中断整个解析过程
            print(f"解析CAN帧行时出错: {e}, 行数据: {row}")
            return None
    
    def _parse_timestamp(self, timestamp_str: str) -> float:
        """
        解析时间戳，支持多种格式
        
        Args:
            timestamp_str: 时间戳字符串
            
        Returns:
            浮点型时间戳（秒）
        """
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
            "%d/%m/%Y %H:%M:%S"
        ]:
            try:
                dt = datetime.strptime(timestamp_str, fmt)
                return dt.timestamp()
            except ValueError:
                continue
        
        raise ValueError(f"无法解析时间戳: {timestamp_str}")
    
    def _parse_data(self, data_str: str) -> List[int]:
        """
        解析CAN数据字段
        
        Args:
            data_str: 数据字符串，支持多种格式
                - 空格分隔的十六进制: "01 02 03 04"
                - 无分隔的十六进制: "01020304"
                - 逗号分隔的十进制: "1,2,3,4"
                
        Returns:
            字节列表
        """
        if not data_str or data_str.strip() == "":
            return []
        
        # 移除空格
        data_str = data_str.strip()
        
        # 尝试解析为空格分隔的十六进制
        if " " in data_str:
            parts = data_str.split()
            try:
                return [int(p, 16) for p in parts if p]
            except ValueError:
                pass
        
        # 尝试解析为逗号分隔的十进制
        if "," in data_str:
            parts = data_str.split(",")
            try:
                return [int(p.strip()) for p in parts if p.strip()]
            except ValueError:
                pass
        
        # 尝试解析为无分隔的十六进制
        if all(c in "0123456789abcdefABCDEF" for c in data_str):
            # 确保长度为偶数
            if len(data_str) % 2 != 0:
                data_str = "0" + data_str
            
            return [int(data_str[i:i+2], 16) for i in range(0, len(data_str), 2)]
        
        # 默认返回空列表
        return []
    
    def _parse_bool(self, bool_str: str) -> bool:
        """
        解析布尔值
        
        Args:
            bool_str: 布尔字符串
            
        Returns:
            布尔值
        """
        if isinstance(bool_str, bool):
            return bool_str
        
        return bool_str.lower() in ["true", "1", "yes", "y", "t"]
    
    def get_frames_by_id(self, can_id: int) -> List[CANFrame]:
        """
        根据CAN ID过滤帧
        
        Args:
            can_id: CAN ID
            
        Returns:
            匹配的帧列表
        """
        return [frame for frame in self.frames if frame.can_id == can_id]
    
    def get_frames_by_time_range(self, start_time: float, end_time: float) -> List[CANFrame]:
        """
        根据时间范围过滤帧
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            匹配的帧列表
        """
        return [
            frame for frame in self.frames 
            if start_time <= frame.timestamp <= end_time
        ]
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取解析统计信息
        
        Returns:
            统计信息字典
        """
        if not self.frames:
            return {
                "total_frames": 0,
                "time_range": None,
                "unique_can_ids": [],
                "error_frames": 0,
                "remote_frames": 0,
                "extended_frames": 0
            }
        
        can_ids = set(frame.can_id for frame in self.frames)
        error_frames = sum(1 for frame in self.frames if frame.is_error)
        remote_frames = sum(1 for frame in self.frames if frame.is_remote)
        extended_frames = sum(1 for frame in self.frames if frame.is_extended)
        
        return {
            "total_frames": len(self.frames),
            "time_range": {
                "start": self.frames[0].timestamp,
                "end": self.frames[-1].timestamp,
                "duration": self.frames[-1].timestamp - self.frames[0].timestamp
            },
            "unique_can_ids": sorted(list(can_ids)),
            "error_frames": error_frames,
            "remote_frames": remote_frames,
            "extended_frames": extended_frames
        }
