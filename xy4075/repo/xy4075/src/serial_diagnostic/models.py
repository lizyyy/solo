from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional, Any
from enum import Enum
import struct


class ProtocolType(str, Enum):
    MODBUS_RTU = "modbus_rtu"
    MODBUS_ASCII = "modbus_ascii"
    CUSTOM_SERIAL = "custom_serial"


class RegisterType(str, Enum):
    COIL = "coil"
    DISCRETE_INPUT = "discrete_input"
    INPUT_REGISTER = "input_register"
    HOLDING_REGISTER = "holding_register"


class FunctionCode(str, Enum):
    READ_COILS = "01"
    READ_DISCRETE_INPUTS = "02"
    READ_HOLDING_REGISTERS = "03"
    READ_INPUT_REGISTERS = "04"
    WRITE_SINGLE_COIL = "05"
    WRITE_SINGLE_REGISTER = "06"
    WRITE_MULTIPLE_COILS = "0F"
    WRITE_MULTIPLE_REGISTERS = "10"


class RegisterDefinition(BaseModel):
    address: int = Field(..., ge=0, le=65535)
    name: str
    type: RegisterType
    description: Optional[str] = None
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    unit: Optional[str] = None
    scale: Optional[float] = None


class FrameFormat(BaseModel):
    name: str
    pattern: str
    description: Optional[str] = None


class ProtocolConfig(BaseModel):
    name: str = "default"
    protocol_type: ProtocolType = ProtocolType.MODBUS_RTU
    baud_rate: int = Field(default=9600, ge=1200, le=921600)
    data_bits: int = Field(default=8, ge=5, le=8)
    stop_bits: float = Field(default=1.0)
    parity: str = Field(default="N", pattern="^[NEO]$")
    slave_address_range: tuple = Field(default=(1, 247))
    register_range: tuple = Field(default=(0, 65535))
    timeout_ms: int = Field(default=1000, ge=100)
    max_retry_count: int = Field(default=3, ge=0)
    frame_formats: List[FrameFormat] = []
    registers: List[RegisterDefinition] = []

    @field_validator("slave_address_range")
    @classmethod
    def validate_slave_range(cls, v: tuple) -> tuple:
        if len(v) != 2 or v[0] > v[1] or v[0] < 0 or v[1] > 255:
            raise ValueError("slave_address_range must be (min, max) with 0<=min<=max<=255")
        return v

    @field_validator("register_range")
    @classmethod
    def validate_register_range(cls, v: tuple) -> tuple:
        if len(v) != 2 or v[0] > v[1] or v[0] < 0 or v[1] > 65535:
            raise ValueError("register_range must be (min, max) with 0<=min<=max<=65535")
        return v

    def to_dict(self) -> Dict[str, Any]:
        data = self.model_dump(mode='json')
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProtocolConfig":
        if 'slave_address_range' in data and isinstance(data['slave_address_range'], list):
            data['slave_address_range'] = tuple(data['slave_address_range'])
        if 'register_range' in data and isinstance(data['register_range'], list):
            data['register_range'] = tuple(data['register_range'])
        return cls(**data)


class FrameDirection(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    UNKNOWN = "unknown"


class FrameValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class ParsedFrame(BaseModel):
    raw_data: bytes
    timestamp: float
    direction: FrameDirection
    slave_address: Optional[int] = None
    function_code: Optional[str] = None
    register_address: Optional[int] = None
    register_count: Optional[int] = None
    data: Optional[bytes] = None
    crc: Optional[int] = None
    validation_result: Optional[FrameValidationResult] = None
    metadata: Dict[str, Any] = {}

    def calculate_crc16(self) -> int:
        crc = 0xFFFF
        for byte in self.raw_data[:-2]:
            crc ^= byte
            for _ in range(8):
                if crc & 0x0001:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc = crc >> 1
        return crc & 0xFFFF

    def validate(self, config: ProtocolConfig) -> FrameValidationResult:
        errors = []
        warnings = []

        if config.protocol_type in [ProtocolType.MODBUS_RTU, ProtocolType.MODBUS_ASCII]:
            if self.slave_address is not None:
                min_addr, max_addr = config.slave_address_range
                if self.slave_address < min_addr or self.slave_address > max_addr:
                    errors.append(f"Slave address {self.slave_address} out of range [{min_addr}, {max_addr}]")

            if self.register_address is not None:
                min_reg, max_reg = config.register_range
                if self.register_address < min_reg or self.register_address > max_reg:
                    errors.append(f"Register address {self.register_address} out of range [{min_reg}, {max_reg}]")

            if config.protocol_type == ProtocolType.MODBUS_RTU and len(self.raw_data) >= 4:
                calculated_crc = self.calculate_crc16()
                if self.crc is not None and self.crc != calculated_crc:
                    errors.append(f"CRC mismatch: expected {hex(self.crc)}, calculated {hex(calculated_crc)}")

        return FrameValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )


class ParsedSession(BaseModel):
    session_id: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    frames: List[ParsedFrame] = []
    metadata: Dict[str, Any] = {}

    @property
    def frame_count(self) -> int:
        return len(self.frames)

    @property
    def duration(self) -> float:
        if self.start_time is None or self.end_time is None:
            return 0.0
        return self.end_time - self.start_time

    def get_frames_by_slave(self, slave_address: int) -> List[ParsedFrame]:
        return [f for f in self.frames if f.slave_address == slave_address]

    def get_frames_by_direction(self, direction: FrameDirection) -> List[ParsedFrame]:
        return [f for f in self.frames if f.direction == direction]
