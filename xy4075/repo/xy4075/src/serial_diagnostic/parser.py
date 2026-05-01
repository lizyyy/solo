import re
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any, Union
from pathlib import Path
import yaml

from .models import (
    ParsedFrame, ParsedSession, FrameDirection,
    FrameValidationResult, ProtocolConfig, ProtocolType
)


class LogParserError(Exception):
    pass


class BaseLogParser:
    def __init__(self, config: ProtocolConfig):
        self.config = config
        self.frame_patterns = self._build_patterns()

    def _build_patterns(self) -> Dict[str, re.Pattern]:
        patterns = {}
        for fmt in self.config.frame_formats:
            patterns[fmt.name] = re.compile(fmt.pattern)
        return patterns

    def parse_timestamp(self, time_str: str) -> float:
        formats = [
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%H:%M:%S.%f",
            "%H:%M:%S",
            "%Y/%m/%d %H:%M:%S.%f",
            "%Y/%m/%d %H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(time_str, fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=datetime.now().year)
                return dt.timestamp()
            except ValueError:
                continue
        
        try:
            return float(time_str)
        except ValueError:
            raise LogParserError(f"Could not parse timestamp: {time_str}")

    def parse_hex_string(self, hex_str: str) -> bytes:
        hex_str = re.sub(r'[\s,:;\-]+', '', hex_str)
        return bytes.fromhex(hex_str)

    def parse_line(self, line: str) -> Optional[ParsedFrame]:
        raise NotImplementedError("Subclasses must implement parse_line")

    def parse_file(self, file_path: Union[str, Path]) -> ParsedSession:
        path = Path(file_path)
        if not path.exists():
            raise LogParserError(f"File not found: {file_path}")
        
        frames: List[ParsedFrame] = []
        line_num = 0
        
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line_num += 1
                line = line.strip()
                if not line:
                    continue
                
                try:
                    frame = self.parse_line(line)
                    if frame:
                        frame.metadata['line_number'] = line_num
                        frame.metadata['raw_line'] = line
                        frames.append(frame)
                except Exception as e:
                    pass
        
        frames.sort(key=lambda f: f.timestamp)
        
        start_time = frames[0].timestamp if frames else None
        end_time = frames[-1].timestamp if frames else None
        
        session = ParsedSession(
            session_id=f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            start_time=start_time,
            end_time=end_time,
            frames=frames,
            metadata={
                'source_file': str(path),
                'line_count': line_num,
                'parse_errors': []
            }
        )
        
        return session


class ModbusRTUParser(BaseLogParser):
    MODBUS_RTU_PATTERN = re.compile(
        r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([RTXQ])\s+([0-9A-Fa-f\s,:;\-]+)$'
    )

    def parse_line(self, line: str) -> Optional[ParsedFrame]:
        match = self.MODBUS_RTU_PATTERN.match(line)
        if not match:
            return None
        
        time_str = match.group(1)
        direction_str = match.group(2)
        data_str = match.group(3)
        
        timestamp = self.parse_timestamp(time_str) if time_str else 0.0
        
        direction = FrameDirection.UNKNOWN
        if direction_str:
            if direction_str in ['T', 'Q', 'R']:
                direction = FrameDirection.REQUEST
            elif direction_str == 'X':
                direction = FrameDirection.RESPONSE
        
        raw_data = self.parse_hex_string(data_str)
        if len(raw_data) < 4:
            return None
        
        slave_address = raw_data[0]
        function_code = f"{raw_data[1]:02X}"
        
        register_address = None
        register_count = None
        data = None
        crc = None
        
        if len(raw_data) >= 8:
            register_address = (raw_data[2] << 8) | raw_data[3]
            register_count = (raw_data[4] << 8) | raw_data[5]
        
        if len(raw_data) >= 5 and function_code in ['03', '04', '02', '01']:
            byte_count = raw_data[2]
            if len(raw_data) >= 3 + byte_count + 2:
                data = raw_data[3:3+byte_count]
                crc = (raw_data[-1] << 8) | raw_data[-2]
        elif len(raw_data) >= 5:
            crc = (raw_data[-1] << 8) | raw_data[-2]
        
        frame = ParsedFrame(
            raw_data=raw_data,
            timestamp=timestamp,
            direction=direction,
            slave_address=slave_address,
            function_code=function_code,
            register_address=register_address,
            register_count=register_count,
            data=data,
            crc=crc
        )
        
        frame.validation_result = frame.validate(self.config)
        return frame


class ModbusASCIIParser(BaseLogParser):
    MODBUS_ASCII_PATTERN = re.compile(
        r'^(?:\[?([^\]]+)\]?)?\s*(?:([RTXQ])\s*:?)?\s*:([0-9A-Fa-f]+)(?:\r\n|\n|$)'
    )

    def calculate_lrc(self, data: bytes) -> int:
        lrc = 0
        for byte in data:
            lrc = (lrc + byte) & 0xFF
        return ((lrc ^ 0xFF) + 1) & 0xFF

    def parse_line(self, line: str) -> Optional[ParsedFrame]:
        match = self.MODBUS_ASCII_PATTERN.match(line)
        if not match:
            return None
        
        time_str = match.group(1)
        direction_str = match.group(2)
        ascii_data = match.group(3)
        
        timestamp = self.parse_timestamp(time_str) if time_str else 0.0
        
        direction = FrameDirection.UNKNOWN
        if direction_str:
            if direction_str in ['T', 'Q', 'R']:
                direction = FrameDirection.REQUEST
            elif direction_str == 'X':
                direction = FrameDirection.RESPONSE
        
        try:
            raw_data = bytes.fromhex(ascii_data)
        except ValueError:
            return None
        
        if len(raw_data) < 3:
            return None
        
        slave_address = raw_data[0]
        function_code = f"{raw_data[1]:02X}"
        data = raw_data[2:-1] if len(raw_data) > 3 else None
        lrc = raw_data[-1]
        
        expected_lrc = self.calculate_lrc(raw_data[:-1])
        
        register_address = None
        register_count = None
        if len(data) >= 4 and function_code in ['03', '04', '02', '01']:
            register_address = (data[0] << 8) | data[1]
            register_count = (data[2] << 8) | data[3]
        
        frame = ParsedFrame(
            raw_data=raw_data,
            timestamp=timestamp,
            direction=direction,
            slave_address=slave_address,
            function_code=function_code,
            register_address=register_address,
            register_count=register_count,
            data=data,
            metadata={'lrc': lrc, 'expected_lrc': expected_lrc}
        )
        
        if lrc != expected_lrc:
            frame.validation_result = FrameValidationResult(
                is_valid=False,
                errors=[f"LRC mismatch: expected {hex(expected_lrc)}, got {hex(lrc)}"]
            )
        else:
            frame.validation_result = frame.validate(self.config)
        
        return frame


class CustomSerialParser(BaseLogParser):
    def __init__(self, config: ProtocolConfig):
        super().__init__(config)
        self.custom_pattern = re.compile(
            r'^(?:\[?([^\]]+)\]?)?\s*(?:([RTXQ])\s*:?)?\s*(.+)$'
        )

    def parse_line(self, line: str) -> Optional[ParsedFrame]:
        for name, pattern in self.frame_patterns.items():
            match = pattern.match(line)
            if match:
                return self._parse_custom_match(match, name)
        
        match = self.custom_pattern.match(line)
        if not match:
            return None
        
        time_str = match.group(1)
        direction_str = match.group(2)
        data_str = match.group(3)
        
        timestamp = self.parse_timestamp(time_str) if time_str else 0.0
        
        direction = FrameDirection.UNKNOWN
        if direction_str:
            if direction_str in ['T', 'Q', 'R']:
                direction = FrameDirection.REQUEST
            elif direction_str == 'X':
                direction = FrameDirection.RESPONSE
        
        try:
            raw_data = self.parse_hex_string(data_str)
        except ValueError:
            raw_data = data_str.encode('utf-8')
        
        frame = ParsedFrame(
            raw_data=raw_data,
            timestamp=timestamp,
            direction=direction
        )
        
        frame.validation_result = FrameValidationResult(is_valid=True)
        return frame

    def _parse_custom_match(self, match: re.Match, pattern_name: str) -> ParsedFrame:
        groups = match.groupdict()
        
        timestamp = 0.0
        if 'timestamp' in groups:
            timestamp = self.parse_timestamp(groups['timestamp'])
        elif 'time' in groups:
            timestamp = self.parse_timestamp(groups['time'])
        
        direction = FrameDirection.UNKNOWN
        if 'direction' in groups:
            d = groups['direction'].upper()
            if d in ['T', 'Q', 'R', 'TX']:
                direction = FrameDirection.REQUEST
            elif d in ['X', 'RX']:
                direction = FrameDirection.RESPONSE
        
        raw_data = b''
        if 'data' in groups:
            try:
                raw_data = self.parse_hex_string(groups['data'])
            except ValueError:
                raw_data = groups['data'].encode('utf-8')
        elif 'hex' in groups:
            raw_data = self.parse_hex_string(groups['hex'])
        
        frame = ParsedFrame(
            raw_data=raw_data,
            timestamp=timestamp,
            direction=direction,
            metadata={'pattern_used': pattern_name}
        )
        
        frame.validation_result = FrameValidationResult(is_valid=True)
        return frame


class LogParserFactory:
    @staticmethod
    def create(config: ProtocolConfig) -> BaseLogParser:
        if config.protocol_type == ProtocolType.MODBUS_RTU:
            return ModbusRTUParser(config)
        elif config.protocol_type == ProtocolType.MODBUS_ASCII:
            return ModbusASCIIParser(config)
        elif config.protocol_type == ProtocolType.CUSTOM_SERIAL:
            return CustomSerialParser(config)
        else:
            raise ValueError(f"Unsupported protocol type: {config.protocol_type}")
