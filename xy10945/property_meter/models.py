from dataclasses import dataclass, field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class MeterType(str, Enum):
    WATER = "water"
    ELECTRIC = "electric"


class ErrorType(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_NUMBER = "invalid_number"
    NEGATIVE_READING = "negative_reading"
    READING_DECREASED = "reading_decreased"
    ABNORMAL_USAGE = "abnormal_usage"
    MISSING_METER = "missing_meter"


@dataclass
class MeterRecord:
    row_number: int
    household: str
    meter_number: str
    meter_type: MeterType = MeterType.ELECTRIC
    previous_reading: Optional[float] = None
    current_reading: Optional[float] = None
    multiplier: float = 1.0
    raw_data: Dict[str, str] = field(default_factory=dict)
    
    @property
    def usage(self) -> Optional[float]:
        if self.previous_reading is not None and self.current_reading is not None:
            return (self.current_reading - self.previous_reading) * self.multiplier
        return None
    
    @property
    def is_valid_basic(self) -> bool:
        return (
            bool(self.household) and 
            bool(self.meter_number) and 
            self.previous_reading is not None and 
            self.current_reading is not None
        )


@dataclass
class ValidationError:
    row_number: int
    error_type: ErrorType
    message: str
    field_name: Optional[str] = None
    raw_data: Dict[str, str] = field(default_factory=dict)


@dataclass
class ProcessingResult:
    valid_records: List[MeterRecord] = field(default_factory=list)
    invalid_records: List[ValidationError] = field(default_factory=list)
    abnormal_records: List[MeterRecord] = field(default_factory=list)
    missing_meters: List[Dict[str, str]] = field(default_factory=list)
    total_usage_water: float = 0.0
    total_usage_electric: float = 0.0
    processed_at: datetime = field(default_factory=datetime.now)
    input_file: str = ""
    
    @property
    def total_records(self) -> int:
        return len(self.valid_records) + len([e for e in self.invalid_records if e.error_type != ErrorType.MISSING_METER])
    
    @property
    def has_errors(self) -> bool:
        return len(self.invalid_records) > 0 or len(self.missing_meters) > 0
    
    @property
    def has_abnormal(self) -> bool:
        return len(self.abnormal_records) > 0


@dataclass
class Config:
    input_file: str
    output_dir: str = "./output"
    abnormal_threshold: float = 2.0
    reference_file: Optional[str] = None
    meter_type: MeterType = MeterType.ELECTRIC
    encoding: str = "utf-8"
    delimiter: str = ","
