"""
配置模块
定义审计系统的配置类和配置管理器
"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
import json
from pathlib import Path


@dataclass
class AuditConfig:
    """
    审计配置类
    包含所有质控和校准的参数配置
    """
    
    sensor_id_column: str = 'sensor_id'
    timestamp_column: str = 'timestamp'
    temperature_column: str = 'temperature'
    humidity_column: str = 'humidity'
    location_column: str = 'location'
    batch_column: str = 'batch_id'
    
    temperature_valid_units: List[str] = field(default_factory=lambda: ['C', 'c', '°C', '摄氏度', '℃', 'F', 'f', '°F', '华氏度'])
    humidity_valid_units: List[str] = field(default_factory=lambda: ['%', '%RH', 'RH', '相对湿度'])
    default_temperature_unit: str = 'C'
    default_humidity_unit: str = '%RH'
    
    temperature_range: List[float] = field(default_factory=lambda: [-40.0, 85.0])
    humidity_range: List[float] = field(default_factory=lambda: [0.0, 100.0])
    
    temperature_delta_threshold: float = 2.0
    humidity_delta_threshold: float = 5.0
    
    iqr_multiplier: float = 1.5
    z_score_threshold: float = 3.0
    
    duplicate_check_columns: List[str] = field(default_factory=lambda: ['sensor_id', 'timestamp'])
    
    timestamp_format: Optional[str] = None
    timezone: Optional[str] = None
    
    drift_window_size: int = 30
    drift_threshold_temp: float = 1.5
    drift_threshold_humidity: float = 3.0
    
    calibration_reference_sensor: Optional[str] = None
    calibration_method: str = 'linear'
    
    report_output_dir: str = 'reports'
    data_output_dir: str = 'output'
    
    export_excel: bool = True
    export_html: bool = True
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, config_dict: Dict) -> 'AuditConfig':
        return cls(**{k: v for k, v in config_dict.items() if k in cls.__dataclass_fields__})
    
    @classmethod
    def from_json(cls, file_path: str) -> 'AuditConfig':
        with open(file_path, 'r', encoding='utf-8') as f:
            config_dict = json.load(f)
        return cls.from_dict(config_dict)


class ConfigManager:
    """
    配置管理器
    用于加载、保存和管理配置
    """
    
    def __init__(self, config: Optional[AuditConfig] = None):
        self.config = config or AuditConfig()
    
    def load_from_file(self, file_path: str) -> AuditConfig:
        path = Path(file_path)
        if path.suffix == '.json':
            self.config = AuditConfig.from_json(file_path)
        else:
            raise ValueError(f"不支持的配置文件格式: {path.suffix}")
        return self.config
    
    def save_to_json(self, file_path: str) -> None:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self.config.to_dict(), f, ensure_ascii=False, indent=2)
    
    def get_config(self) -> AuditConfig:
        return self.config
    
    def update_config(self, **kwargs) -> None:
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
