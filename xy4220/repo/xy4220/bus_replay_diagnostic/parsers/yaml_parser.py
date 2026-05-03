"""
YAML解析器 - 用于解析控制指令YAML文件
"""
import yaml
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ControlCommand:
    """控制指令数据结构"""
    timestamp: float
    command_id: str
    command_type: str
    source: str
    destination: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    status: str = "pending"
    execution_time: Optional[float] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.parameters, str):
            try:
                self.parameters = yaml.safe_load(self.parameters)
            except (yaml.YAMLError, TypeError):
                self.parameters = {}


class ControlYAMLParser:
    """控制指令YAML解析器"""
    
    def __init__(self, expected_fields: Optional[List[str]] = None):
        """
        初始化YAML解析器
        
        Args:
            expected_fields: 期望的字段列表，如果为None则使用默认字段
        """
        self.expected_fields = expected_fields or [
            "timestamp", "command_id", "command_type", "source", "destination", "parameters"
        ]
        self.commands: List[ControlCommand] = []
        
    def parse_file(self, file_path: str) -> List[ControlCommand]:
        """
        解析YAML文件
        
        Args:
            file_path: YAML文件路径
            
        Returns:
            解析后的控制指令列表
        """
        self.commands = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        # 检查数据格式
        if isinstance(data, list):
            for item in data:
                command = self._parse_item(item)
                if command:
                    self.commands.append(command)
        elif isinstance(data, dict):
            # 检查是否是单个控制指令还是包含数组的对象
            if "commands" in data and isinstance(data["commands"], list):
                for item in data["commands"]:
                    command = self._parse_item(item)
                    if command:
                        self.commands.append(command)
            elif "timestamp" in data and "command_id" in data:
                command = self._parse_item(data)
                if command:
                    self.commands.append(command)
            else:
                # 尝试解析为命令ID到数据的映射
                for command_id, item in data.items():
                    if isinstance(item, dict):
                        item["command_id"] = command_id
                        command = self._parse_item(item)
                        if command:
                            self.commands.append(command)
        
        # 按时间戳排序
        self.commands.sort(key=lambda x: x.timestamp)
        
        return self.commands
    
    def _parse_item(self, item: Dict[str, Any]) -> Optional[ControlCommand]:
        """
        解析单个控制指令项
        
        Args:
            item: 控制指令字典
            
        Returns:
            解析后的控制指令对象，如果解析失败则返回None
        """
        try:
            # 解析时间戳
            timestamp = self._parse_timestamp(item.get("timestamp"))
            
            # 获取命令ID
            command_id = item.get("command_id", item.get("id", item.get("cmd_id", "unknown")))
            
            # 获取命令类型
            command_type = item.get("command_type", item.get("type", item.get("cmd_type", "unknown")))
            
            # 获取源和目标
            source = item.get("source", item.get("from", "unknown"))
            destination = item.get("destination", item.get("to", "unknown"))
            
            # 获取参数
            parameters = item.get("parameters", item.get("params", item.get("args", {})))
            if not isinstance(parameters, dict):
                parameters = {"value": parameters}
            
            # 获取状态
            status = item.get("status", item.get("state", "pending"))
            
            # 获取执行时间
            execution_time = item.get("execution_time", item.get("exec_time"))
            if execution_time is not None:
                try:
                    execution_time = float(execution_time)
                except (ValueError, TypeError):
                    execution_time = None
            
            # 保存原始数据
            raw_data = item.copy()
            
            return ControlCommand(
                timestamp=timestamp,
                command_id=command_id,
                command_type=command_type,
                source=source,
                destination=destination,
                parameters=parameters,
                status=status,
                execution_time=execution_time,
                raw_data=raw_data
            )
            
        except Exception as e:
            # 记录解析错误但不中断整个解析过程
            print(f"解析控制指令时出错: {e}, 数据: {item}")
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
    
    def get_commands_by_id(self, command_id: str) -> List[ControlCommand]:
        """
        根据命令ID过滤数据
        
        Args:
            command_id: 命令ID
            
        Returns:
            匹配的控制指令列表
        """
        return [command for command in self.commands if command.command_id == command_id]
    
    def get_commands_by_type(self, command_type: str) -> List[ControlCommand]:
        """
        根据命令类型过滤数据
        
        Args:
            command_type: 命令类型
            
        Returns:
            匹配的控制指令列表
        """
        return [command for command in self.commands if command.command_type == command_type]
    
    def get_commands_by_source(self, source: str) -> List[ControlCommand]:
        """
        根据源过滤数据
        
        Args:
            source: 源名称
            
        Returns:
            匹配的控制指令列表
        """
        return [command for command in self.commands if command.source == source]
    
    def get_commands_by_destination(self, destination: str) -> List[ControlCommand]:
        """
        根据目标过滤数据
        
        Args:
            destination: 目标名称
            
        Returns:
            匹配的控制指令列表
        """
        return [command for command in self.commands if command.destination == destination]
    
    def get_commands_by_time_range(self, start_time: float, end_time: float) -> List[ControlCommand]:
        """
        根据时间范围过滤数据
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            匹配的控制指令列表
        """
        return [
            command for command in self.commands 
            if start_time <= command.timestamp <= end_time
        ]
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取解析统计信息
        
        Returns:
            统计信息字典
        """
        if not self.commands:
            return {
                "total_commands": 0,
                "time_range": None,
                "unique_command_ids": [],
                "unique_command_types": [],
                "unique_sources": [],
                "unique_destinations": [],
                "command_counts": {}
            }
        
        command_ids = set(command.command_id for command in self.commands)
        command_types = set(command.command_type for command in self.commands)
        sources = set(command.source for command in self.commands)
        destinations = set(command.destination for command in self.commands)
        
        # 统计每种命令类型的数量
        command_counts = {}
        for command in self.commands:
            cmd_type = command.command_type
            if cmd_type not in command_counts:
                command_counts[cmd_type] = 0
            command_counts[cmd_type] += 1
        
        return {
            "total_commands": len(self.commands),
            "time_range": {
                "start": self.commands[0].timestamp,
                "end": self.commands[-1].timestamp,
                "duration": self.commands[-1].timestamp - self.commands[0].timestamp
            },
            "unique_command_ids": sorted(list(command_ids)),
            "unique_command_types": sorted(list(command_types)),
            "unique_sources": sorted(list(sources)),
            "unique_destinations": sorted(list(destinations)),
            "command_counts": command_counts
        }
