import os
import yaml
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class DataConfig:
    input_path: str = "data/input.csv"
    output_dir: str = "output"
    encoding: str = "utf-8"
    delimiter: str = ","


@dataclass
class ColumnConfig:
    timestamp: str = "timestamp"
    charging_power: str = "charging_power"
    energy_consumed: str = "energy_consumed"
    charging_duration: str = "charging_duration"
    station_id: str = "station_id"
    charger_id: str = "charger_id"
    electricity_price: str = "electricity_price"


@dataclass
class TimestampRules:
    min_date: str = "2020-01-01"
    max_date: str = "2030-12-31"


@dataclass
class QCRules:
    timestamp: TimestampRules = field(default_factory=TimestampRules)
    charging_power: Dict[str, Any] = field(default_factory=dict)
    energy_consumed: Dict[str, Any] = field(default_factory=dict)
    charging_duration: Dict[str, Any] = field(default_factory=dict)
    electricity_price: Dict[str, Any] = field(default_factory=dict)
    missing_threshold: float = 0.8
    duplicate_check_columns: List[str] = field(default_factory=list)


@dataclass
class UnitConversion:
    charging_power: Dict[str, float] = field(default_factory=dict)
    energy_consumed: Dict[str, float] = field(default_factory=dict)
    charging_duration: Dict[str, float] = field(default_factory=dict)


@dataclass
class FeatureConfig:
    time_features: List[str] = field(default_factory=list)
    lag_features: List[int] = field(default_factory=list)
    rolling_window: List[int] = field(default_factory=list)


@dataclass
class ModelConfig:
    type: str = "RandomForest"
    test_size: float = 0.2
    random_state: int = 42
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportConfig:
    chart_format: str = "png"
    chart_dpi: int = 300
    include_failures: bool = True
    export_format: str = "xlsx"


@dataclass
class Config:
    data: DataConfig = field(default_factory=DataConfig)
    columns: ColumnConfig = field(default_factory=ColumnConfig)
    quality_control: QCRules = field(default_factory=QCRules)
    unit_conversion: UnitConversion = field(default_factory=UnitConversion)
    feature_engineering: FeatureConfig = field(default_factory=FeatureConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    report: ReportConfig = field(default_factory=ReportConfig)


def load_config(config_path: Optional[str] = None) -> Config:
    if config_path is None:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.yaml")
    
    with open(config_path, "r", encoding="utf-8") as f:
        config_data = yaml.safe_load(f)
    
    qc_data = config_data.get("quality_control", {})
    if "timestamp" in qc_data:
        qc_data["timestamp"] = TimestampRules(**qc_data["timestamp"])
    
    return Config(
        data=DataConfig(**config_data.get("data", {})),
        columns=ColumnConfig(**config_data.get("columns", {})),
        quality_control=QCRules(**qc_data),
        unit_conversion=UnitConversion(**config_data.get("unit_conversion", {})),
        feature_engineering=FeatureConfig(**config_data.get("feature_engineering", {})),
        model=ModelConfig(**config_data.get("model", {})),
        report=ReportConfig(**config_data.get("report", {}))
    )
