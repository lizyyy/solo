from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class QCConfig:
    min_irradiance: float = 0.0
    max_irradiance: float = 1500.0
    min_temperature: float = -40.0
    max_temperature: float = 85.0
    min_generation: float = 0.0
    max_generation: float = 100000.0
    zscore_threshold: float = 3.0
    iqr_multiplier: float = 1.5
    min_valid_rows_ratio: float = 0.5


@dataclass
class CalculationConfig:
    inverter_efficiency_nominal: float = 0.98
    temperature_coefficient: float = -0.004
    reference_temperature: float = 25.0
    stc_irradiance: float = 1000.0
    dc_ac_ratio: float = 1.25


@dataclass
class UnitMapping:
    irradiance: List[str] = field(default_factory=lambda: ['irradiance', 'irradiation', 'g', 'ghi', '辐照度', '辐射度'])
    temperature: List[str] = field(default_factory=lambda: ['temperature', 'temp', 't', '温度'])
    generation: List[str] = field(default_factory=lambda: ['generation', 'energy', 'yield', 'output', '发电量', '出力'])
    inverter_id: List[str] = field(default_factory=lambda: ['inverter_id', 'inverter', 'id', '逆变器编号', '逆变器'])
    timestamp: List[str] = field(default_factory=lambda: ['timestamp', 'time', 'date', 'datetime', '时间', '日期'])
    capacity: List[str] = field(default_factory=lambda: ['capacity', 'rated_power', 'dc_capacity', '装机容量', '额定功率'])


@dataclass
class AppConfig:
    qc: QCConfig = field(default_factory=QCConfig)
    calculation: CalculationConfig = field(default_factory=CalculationConfig)
    unit_mapping: UnitMapping = field(default_factory=UnitMapping)
    supported_formats: List[str] = field(default_factory=lambda: ['.csv', '.xlsx', '.xls'])
    output_dir: str = './output'
    export_formats: List[str] = field(default_factory=lambda: ['xlsx', 'csv'])
