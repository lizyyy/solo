"""质控配置模块"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime


@dataclass
class QCConfig:
    """质控配置类 - 可序列化，支持复算"""

    blank_threshold: float = 0.01
    parallel_max_rpd: float = 5.0
    recovery_min: float = 80.0
    recovery_max: float = 120.0
    outlier_method: str = "iqr"
    outlier_factor: float = 1.5
    required_columns: List[str] = field(default_factory=lambda: [
        "sample_id", "sample_type", "parameter", "value", "unit"
    ])
    sample_type_column: str = "sample_type"
    sample_type_map: Dict[str, str] = field(default_factory=lambda: {
        "空白": "blank",
        "空白样": "blank",
        "BLANK": "blank",
        "blank": "blank",
        "平行": "parallel",
        "平行样": "parallel",
        "DUPLICATE": "parallel",
        "parallel": "parallel",
        "加标": "spike",
        "加标回收": "spike",
        "SPIKE": "spike",
        "spike": "spike",
        "样品": "sample",
        "样本": "sample",
        "SAMPLE": "sample",
        "sample": "sample",
    })
    unit_conversion: Dict[str, Dict[str, float]] = field(default_factory=lambda: {
        "mg/L": {"g/L": 0.001, "ug/L": 1000.0},
        "g/L": {"mg/L": 1000.0, "ug/L": 1e6},
        "ug/L": {"mg/L": 0.001, "g/L": 1e-6},
        "mg/kg": {"g/kg": 0.001},
        "g/kg": {"mg/kg": 1000.0},
    })
    target_units: Dict[str, str] = field(default_factory=lambda: {
        "pH": "",
        "温度": "℃",
        "总磷": "mg/L",
        "总氮": "mg/L",
        "氨氮": "mg/L",
        "COD": "mg/L",
        "BOD5": "mg/L",
    })
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    version: str = "1.0.0"

    def to_dict(self) -> dict:
        """转换为字典，用于复算记录"""
        return {
            "blank_threshold": self.blank_threshold,
            "parallel_max_rpd": self.parallel_max_rpd,
            "recovery_min": self.recovery_min,
            "recovery_max": self.recovery_max,
            "outlier_method": self.outlier_method,
            "outlier_factor": self.outlier_factor,
            "sample_type_map": self.sample_type_map,
            "unit_conversion": self.unit_conversion,
            "target_units": self.target_units,
            "created_at": self.created_at,
            "version": self.version,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "QCConfig":
        """从字典恢复配置"""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


DEFAULT_CONFIG = QCConfig()
