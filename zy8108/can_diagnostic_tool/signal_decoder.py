"""
信号解码模块
负责解析signals.yaml配置，将CAN帧数据解码为可读的信号值
"""

import yaml
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
import struct

from .log_parser import CANFrame


@dataclass
class SignalDefinition:
    """信号定义，描述如何从CAN帧数据中提取信号值"""
    name: str
    start_bit: int
    bit_length: int
    is_signed: bool = False
    is_little_endian: bool = True
    scale: float = 1.0
    offset: float = 0.0
    unit: str = ""
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    enum_values: Dict[int, str] = field(default_factory=dict)


@dataclass
class CANIdDefinition:
    """CAN ID定义，包含该ID下的所有信号"""
    can_id: int
    name: str
    description: str = ""
    dlc: int = 8
    signals: Dict[str, SignalDefinition] = field(default_factory=dict)
    cycle_time_ms: Optional[int] = None  # 期望的周期时间（毫秒）
    is_heartbeat: bool = False
    heartbeat_signal: Optional[str] = None


@dataclass
class DecodedSignal:
    """解码后的信号值"""
    name: str
    value: Any
    raw_value: int
    unit: str = ""
    enum_label: Optional[str] = None


@dataclass
class DecodedFrame:
    """解码后的CAN帧"""
    timestamp: float
    can_id: int
    can_id_name: str
    signals: Dict[str, DecodedSignal]
    original_frame: CANFrame


class SignalDecoder:
    """信号解码器
    
    从signals.yaml加载信号定义，将原始CAN帧数据解码为可读的信号值
    """
    
    def __init__(self):
        self.can_id_definitions: Dict[int, CANIdDefinition] = {}
        self.known_can_ids: set = set()
        self.unknown_can_ids_encountered: set = set()
    
    def load_signals_config(self, config_path: str) -> None:
        """
        加载signals.yaml配置文件
        
        Args:
            config_path: 配置文件路径
        """
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # 解析CAN ID定义
        can_ids = config.get('can_ids', {})
        for can_id_hex, id_config in can_ids.items():
            can_id = int(str(can_id_hex), 16) if isinstance(can_id_hex, str) else int(can_id_hex)
            
            id_def = CANIdDefinition(
                can_id=can_id,
                name=id_config.get('name', f'ID_{hex(can_id)}'),
                description=id_config.get('description', ''),
                dlc=id_config.get('dlc', 8),
                cycle_time_ms=id_config.get('cycle_time_ms'),
                is_heartbeat=id_config.get('is_heartbeat', False),
                heartbeat_signal=id_config.get('heartbeat_signal')
            )
            
            # 解析信号定义
            signals = id_config.get('signals', {})
            for signal_name, sig_config in signals.items():
                signal_def = SignalDefinition(
                    name=signal_name,
                    start_bit=sig_config.get('start_bit', 0),
                    bit_length=sig_config.get('bit_length', 8),
                    is_signed=sig_config.get('is_signed', False),
                    is_little_endian=sig_config.get('is_little_endian', True),
                    scale=sig_config.get('scale', 1.0),
                    offset=sig_config.get('offset', 0.0),
                    unit=sig_config.get('unit', ''),
                    min_value=sig_config.get('min'),
                    max_value=sig_config.get('max'),
                    enum_values=sig_config.get('enum', {})
                )
                id_def.signals[signal_name] = signal_def
            
            self.can_id_definitions[can_id] = id_def
            self.known_can_ids.add(can_id)
    
    def decode_frame(self, frame: CANFrame) -> Optional[DecodedFrame]:
        """
        解码单个CAN帧
        
        Args:
            frame: 原始CAN帧
            
        Returns:
            DecodedFrame: 解码后的帧，如果CAN ID未知则返回None
        """
        if frame.can_id not in self.can_id_definitions:
            self.unknown_can_ids_encountered.add(frame.can_id)
            return None
        
        id_def = self.can_id_definitions[frame.can_id]
        decoded_signals = {}
        
        for signal_name, signal_def in id_def.signals.items():
            decoded_signal = self._decode_signal(frame.data, signal_def)
            if decoded_signal:
                decoded_signals[signal_name] = decoded_signal
        
        return DecodedFrame(
            timestamp=frame.timestamp,
            can_id=frame.can_id,
            can_id_name=id_def.name,
            signals=decoded_signals,
            original_frame=frame
        )
    
    def _decode_signal(self, data: bytes, signal_def: SignalDefinition) -> Optional[DecodedSignal]:
        """
        从CAN帧数据中提取并解码单个信号
        
        Args:
            data: CAN帧数据字节
            signal_def: 信号定义
            
        Returns:
            DecodedSignal: 解码后的信号值
        """
        # 计算需要的字节数
        byte_start = signal_def.start_bit // 8
        bit_offset = signal_def.start_bit % 8
        
        # 确保数据长度足够
        if len(data) < byte_start + 1:
            return None
        
        # 提取原始位值
        raw_value = 0
        bits_remaining = signal_def.bit_length
        current_bit_offset = bit_offset
        
        # 从最低字节开始提取（小端）
        if signal_def.is_little_endian:
            for byte_idx in range(byte_start, byte_start + (signal_def.bit_length + 7) // 8):
                if byte_idx >= len(data):
                    break
                
                byte_data = data[byte_idx]
                
                # 计算当前字节需要提取的位数
                if byte_idx == byte_start:
                    # 第一个字节，从偏移位开始
                    mask = ((1 << bits_remaining) - 1) << current_bit_offset
                    extracted = (byte_data & mask) >> current_bit_offset
                    bits_to_add = min(bits_remaining, 8 - current_bit_offset)
                    raw_value |= extracted
                    bits_remaining -= bits_to_add
                    current_bit_offset = 0
                else:
                    # 后续字节
                    bits_to_add = min(bits_remaining, 8)
                    mask = (1 << bits_to_add) - 1
                    extracted = byte_data & mask
                    shift = (signal_def.bit_length - bits_remaining)
                    raw_value |= (extracted << shift)
                    bits_remaining -= bits_to_add
        else:
            # 大端模式（Motorola格式）
            # CAN信号通常使用Intel（小端），这里简化处理
            raw_value = 0
            bit_pos = signal_def.start_bit
            remaining_bits = signal_def.bit_length
            
            while remaining_bits > 0 and bit_pos < len(data) * 8:
                byte_idx = bit_pos // 8
                bit_in_byte = 7 - (bit_pos % 8)  # 大端从高位开始
                bits_to_extract = min(remaining_bits, bit_in_byte + 1)
                
                if byte_idx >= len(data):
                    break
                
                mask = ((1 << bits_to_extract) - 1) << (bit_in_byte - bits_to_extract + 1)
                extracted = (data[byte_idx] & mask) >> (bit_in_byte - bits_to_extract + 1)
                
                raw_value = (raw_value << bits_to_extract) | extracted
                bit_pos += bits_to_extract
                remaining_bits -= bits_to_extract
        
        # 处理有符号值
        if signal_def.is_signed:
            # 检查最高位是否为1
            sign_bit = 1 << (signal_def.bit_length - 1)
            if raw_value & sign_bit:
                # 负数，进行补码转换
                raw_value = raw_value - (1 << signal_def.bit_length)
        
        # 应用缩放和偏移
        scaled_value = (raw_value * signal_def.scale) + signal_def.offset
        
        # 检查枚举值
        enum_label = None
        if signal_def.enum_values and raw_value in signal_def.enum_values:
            enum_label = signal_def.enum_values[raw_value]
        
        return DecodedSignal(
            name=signal_def.name,
            value=scaled_value,
            raw_value=raw_value,
            unit=signal_def.unit,
            enum_label=enum_label
        )
    
    def get_id_definition(self, can_id: int) -> Optional[CANIdDefinition]:
        """获取指定CAN ID的定义"""
        return self.can_id_definitions.get(can_id)
    
    def get_known_can_ids(self) -> List[int]:
        """获取所有已知的CAN ID列表"""
        return sorted(list(self.known_can_ids))
    
    def get_unknown_can_ids_encountered(self) -> List[int]:
        """获取解码过程中遇到的未知CAN ID列表"""
        return sorted(list(self.unknown_can_ids_encountered))
    
    def get_heartbeat_ids(self) -> List[int]:
        """获取所有标记为心跳帧的CAN ID"""
        return [
            can_id for can_id, id_def in self.can_id_definitions.items()
            if id_def.is_heartbeat
        ]


class DeviceRegistry:
    """设备台账管理类
    
    从CSV文件加载设备台账，管理设备与CAN ID的映射关系
    """
    
    def __init__(self):
        self.devices: Dict[str, Dict[str, Any]] = {}
        self.can_id_to_device: Dict[int, str] = {}
    
    def load_from_csv(self, csv_path: str) -> None:
        """
        从CSV文件加载设备台账
        
        CSV格式示例:
        device_id,device_name,can_ids,description
        DEV001,电机控制器,0x123;0x124,主驱动电机
        DEV002,电池管理系统,0x150;0x151,动力电池BMS
        
        Args:
            csv_path: CSV文件路径
        """
        import csv
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                device_id = row.get('device_id', '').strip()
                if not device_id:
                    continue
                
                # 解析CAN ID列表（支持分号或逗号分隔）
                can_ids_str = row.get('can_ids', '')
                can_ids = []
                for can_id_str in can_ids_str.replace(';', ',').split(','):
                    can_id_str = can_id_str.strip()
                    if can_id_str:
                        try:
                            can_id = int(can_id_str, 16) if '0x' in can_id_str.lower() else int(can_id_str)
                            can_ids.append(can_id)
                        except ValueError:
                            pass
                
                device_info = {
                    'device_id': device_id,
                    'device_name': row.get('device_name', device_id),
                    'can_ids': can_ids,
                    'description': row.get('description', ''),
                    'location': row.get('location', ''),
                    'model': row.get('model', ''),
                    'serial_number': row.get('serial_number', '')
                }
                
                self.devices[device_id] = device_info
                
                # 建立CAN ID到设备的映射
                for can_id in can_ids:
                    if can_id in self.can_id_to_device:
                        # 检测到ID冲突！
                        existing_device = self.can_id_to_device[can_id]
                        print(f"警告: CAN ID 0x{can_id:X} 被多个设备占用: {existing_device} 和 {device_id}")
                    self.can_id_to_device[can_id] = device_id
    
    def get_device_by_can_id(self, can_id: int) -> Optional[str]:
        """根据CAN ID获取所属设备ID"""
        return self.can_id_to_device.get(can_id)
    
    def get_device_info(self, device_id: str) -> Optional[Dict[str, Any]]:
        """获取设备详细信息"""
        return self.devices.get(device_id)
    
    def get_all_devices(self) -> List[str]:
        """获取所有设备ID列表"""
        return sorted(list(self.devices.keys()))
    
    def get_can_ids_for_device(self, device_id: str) -> List[int]:
        """获取指定设备的所有CAN ID"""
        device_info = self.devices.get(device_id)
        if device_info:
            return device_info.get('can_ids', [])
        return []
