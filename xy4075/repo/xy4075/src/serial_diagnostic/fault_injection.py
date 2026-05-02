from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import random
import copy

from .models import ParsedFrame


class FaultType(str, Enum):
    DROP_FRAME = "drop_frame"
    DUPLICATE_FRAME = "duplicate_frame"
    DELAY_FRAME = "delay_frame"
    CORRUPT_CRC = "corrupt_crc"
    CORRUPT_DATA = "corrupt_data"
    CORRUPT_SLAVE_ADDRESS = "corrupt_slave_address"
    CORRUPT_FUNCTION_CODE = "corrupt_function_code"
    INSERT_GARBAGE = "insert_garbage"
    TRUNCATE_FRAME = "truncate_frame"
    TIMEOUT = "timeout"


class InjectionTriggerType(str, Enum):
    FRAME_INDEX = "frame_index"
    TIME_OFFSET = "time_offset"
    RANDOM = "random"
    SLAVE_ADDRESS = "slave_address"
    FUNCTION_CODE = "function_code"
    REGISTER_ADDRESS = "register_address"


@dataclass
class FaultInjectionConfig:
    fault_type: FaultType
    trigger_type: InjectionTriggerType
    trigger_value: Any
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    priority: int = 0
    
    def should_apply(self, frame: ParsedFrame, frame_index: int, 
                     current_time: float, session_start: float) -> bool:
        if not self.enabled:
            return False
        
        if self.trigger_type == InjectionTriggerType.FRAME_INDEX:
            if isinstance(self.trigger_value, list):
                return frame_index in self.trigger_value
            return frame_index == self.trigger_value
        
        elif self.trigger_type == InjectionTriggerType.TIME_OFFSET:
            time_offset = current_time - session_start
            if isinstance(self.trigger_value, tuple) and len(self.trigger_value) == 2:
                return self.trigger_value[0] <= time_offset <= self.trigger_value[1]
            return abs(time_offset - self.trigger_value) < 0.001
        
        elif self.trigger_type == InjectionTriggerType.RANDOM:
            probability = self.parameters.get('probability', 0.1)
            return random.random() < probability
        
        elif self.trigger_type == InjectionTriggerType.SLAVE_ADDRESS:
            if frame.slave_address is None:
                return False
            if isinstance(self.trigger_value, list):
                return frame.slave_address in self.trigger_value
            return frame.slave_address == self.trigger_value
        
        elif self.trigger_type == InjectionTriggerType.FUNCTION_CODE:
            if frame.function_code is None:
                return False
            if isinstance(self.trigger_value, list):
                return frame.function_code in self.trigger_value
            return frame.function_code == self.trigger_value
        
        elif self.trigger_type == InjectionTriggerType.REGISTER_ADDRESS:
            if frame.register_address is None:
                return False
            if isinstance(self.trigger_value, tuple) and len(self.trigger_value) == 2:
                return self.trigger_value[0] <= frame.register_address <= self.trigger_value[1]
            return frame.register_address == self.trigger_value
        
        return False


@dataclass
class InjectionResult:
    frame_index: int
    original_frame: Optional[ParsedFrame]
    modified_frames: List[ParsedFrame]
    fault_type: FaultType
    config_name: Optional[str]
    applied: bool
    message: Optional[str] = None


class BaseFaultInjector(ABC):
    @abstractmethod
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        pass


class DropFrameInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        return []


class DuplicateFrameInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        count = config.parameters.get('count', 2)
        results = []
        for i in range(count):
            new_frame = copy.deepcopy(frame)
            new_frame.metadata['duplicate_index'] = i
            new_frame.metadata['is_duplicate'] = True
            results.append(new_frame)
        return results


class DelayFrameInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        delay_ms = config.parameters.get('delay_ms', 1000)
        new_frame = copy.deepcopy(frame)
        new_frame.metadata['injected_delay_ms'] = delay_ms
        new_frame.timestamp += delay_ms / 1000.0
        return [new_frame]


class CorruptCRCInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        new_frame = copy.deepcopy(frame)
        if len(new_frame.raw_data) >= 4:
            data_list = list(new_frame.raw_data)
            data_list[-1] ^= 0xFF
            data_list[-2] ^= 0xFF
            new_frame.raw_data = bytes(data_list)
            new_frame.crc = (data_list[-1] << 8) | data_list[-2]
            new_frame.metadata['crc_corrupted'] = True
        return [new_frame]


class CorruptDataInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        new_frame = copy.deepcopy(frame)
        data_list = list(new_frame.raw_data)
        byte_index = config.parameters.get('byte_index', -1)
        flip_bits = config.parameters.get('flip_bits', 0xFF)
        
        if byte_index < 0 or byte_index >= len(data_list):
            if len(data_list) > 4:
                byte_index = random.randint(2, len(data_list) - 3)
            else:
                byte_index = 0
        
        if byte_index < len(data_list):
            data_list[byte_index] ^= flip_bits
            new_frame.raw_data = bytes(data_list)
            new_frame.metadata['data_corrupted'] = True
            new_frame.metadata['corrupted_byte_index'] = byte_index
        
        return [new_frame]


class CorruptSlaveAddressInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        new_frame = copy.deepcopy(frame)
        if new_frame.slave_address is not None and len(new_frame.raw_data) > 0:
            data_list = list(new_frame.raw_data)
            new_address = config.parameters.get('new_address', None)
            if new_address is None:
                new_address = (data_list[0] + 1) % 256
            data_list[0] = new_address
            new_frame.raw_data = bytes(data_list)
            new_frame.slave_address = new_address
            new_frame.metadata['slave_address_corrupted'] = True
        return [new_frame]


class CorruptFunctionCodeInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        new_frame = copy.deepcopy(frame)
        if new_frame.function_code is not None and len(new_frame.raw_data) > 1:
            data_list = list(new_frame.raw_data)
            new_code = config.parameters.get('new_code', None)
            if new_code is None:
                new_code = (data_list[1] + 1) % 256
            else:
                if isinstance(new_code, str):
                    new_code = int(new_code, 16)
            data_list[1] = new_code
            new_frame.raw_data = bytes(data_list)
            new_frame.function_code = f"{new_code:02X}"
            new_frame.metadata['function_code_corrupted'] = True
        return [new_frame]


class InsertGarbageInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        garbage_length = config.parameters.get('length', random.randint(1, 10))
        garbage = bytes([random.randint(0, 255) for _ in range(garbage_length)])
        
        garbage_frame = copy.deepcopy(frame)
        garbage_frame.raw_data = garbage
        garbage_frame.direction = frame.direction
        garbage_frame.metadata['is_garbage'] = True
        garbage_frame.metadata['garbage_length'] = garbage_length
        
        position = config.parameters.get('position', 'before')
        if position == 'before':
            return [garbage_frame, frame]
        elif position == 'after':
            return [frame, garbage_frame]
        else:
            return [garbage_frame, frame]


class TruncateFrameInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        new_frame = copy.deepcopy(frame)
        truncate_to = config.parameters.get('truncate_to', None)
        
        if truncate_to is None or truncate_to >= len(new_frame.raw_data):
            truncate_to = max(1, len(new_frame.raw_data) // 2)
        
        new_frame.raw_data = new_frame.raw_data[:truncate_to]
        new_frame.metadata['truncated'] = True
        new_frame.metadata['original_length'] = len(frame.raw_data)
        
        return [new_frame]


class TimeoutInjector(BaseFaultInjector):
    def apply(self, frame: ParsedFrame, config: FaultInjectionConfig) -> List[ParsedFrame]:
        new_frame = copy.deepcopy(frame)
        timeout_duration = config.parameters.get('timeout_duration', 5000)
        new_frame.metadata['timeout_injected'] = True
        new_frame.metadata['timeout_duration_ms'] = timeout_duration
        new_frame.timestamp += timeout_duration / 1000.0
        return [new_frame]


class FaultInjectorFactory:
    _injectors: Dict[FaultType, BaseFaultInjector] = {
        FaultType.DROP_FRAME: DropFrameInjector(),
        FaultType.DUPLICATE_FRAME: DuplicateFrameInjector(),
        FaultType.DELAY_FRAME: DelayFrameInjector(),
        FaultType.CORRUPT_CRC: CorruptCRCInjector(),
        FaultType.CORRUPT_DATA: CorruptDataInjector(),
        FaultType.CORRUPT_SLAVE_ADDRESS: CorruptSlaveAddressInjector(),
        FaultType.CORRUPT_FUNCTION_CODE: CorruptFunctionCodeInjector(),
        FaultType.INSERT_GARBAGE: InsertGarbageInjector(),
        FaultType.TRUNCATE_FRAME: TruncateFrameInjector(),
        FaultType.TIMEOUT: TimeoutInjector(),
    }
    
    @classmethod
    def get(cls, fault_type: FaultType) -> BaseFaultInjector:
        if fault_type not in cls._injectors:
            raise ValueError(f"Unknown fault type: {fault_type}")
        return cls._injectors[fault_type]


class FaultInjectionManager:
    def __init__(self):
        self._configs: List[FaultInjectionConfig] = []
        self._injection_history: List[InjectionResult] = []
    
    def add_config(self, config: FaultInjectionConfig) -> None:
        self._configs.append(config)
        self._configs.sort(key=lambda c: c.priority, reverse=True)
    
    def add_configs(self, configs: List[FaultInjectionConfig]) -> None:
        for config in configs:
            self.add_config(config)
    
    def clear_configs(self) -> None:
        self._configs.clear()
    
    def get_history(self) -> List[InjectionResult]:
        return list(self._injection_history)
    
    def process_frame(self, frame: ParsedFrame, frame_index: int,
                      current_time: float, session_start: float) -> List[ParsedFrame]:
        result_frames = [frame]
        
        for config in self._configs:
            if not config.enabled:
                continue
            
            should_apply = config.should_apply(frame, frame_index, current_time, session_start)
            
            if should_apply:
                injector = FaultInjectorFactory.get(config.fault_type)
                original = result_frames[-1] if result_frames else frame
                
                modified = injector.apply(original, config)
                
                if not modified:
                    result_frames = result_frames[:-1]
                    self._record_injection(
                        frame_index=frame_index,
                        original_frame=original,
                        modified_frames=[],
                        config=config,
                        applied=True,
                        message="Frame dropped"
                    )
                elif len(modified) > 1 or modified[0] is not original:
                    result_frames = result_frames[:-1] + modified
                    self._record_injection(
                        frame_index=frame_index,
                        original_frame=original,
                        modified_frames=modified,
                        config=config,
                        applied=True,
                        message=f"Applied {config.fault_type.value}"
                    )
        
        return result_frames
    
    def _record_injection(self, frame_index: int, original_frame: Optional[ParsedFrame],
                          modified_frames: List[ParsedFrame], config: FaultInjectionConfig,
                          applied: bool, message: Optional[str] = None) -> None:
        result = InjectionResult(
            frame_index=frame_index,
            original_frame=original_frame,
            modified_frames=modified_frames,
            fault_type=config.fault_type,
            config_name=config.name,
            applied=applied,
            message=message
        )
        self._injection_history.append(result)
