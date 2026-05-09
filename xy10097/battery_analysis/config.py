"""分析配置模块。"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class AnalysisConfig:
    """分析配置类。"""
    
    capacity_columns: List[str] = field(default_factory=lambda: [
        "容量", "capacity", "Cap", "cap", "放电容量", "charge_capacity"
    ])
    cycle_columns: List[str] = field(default_factory=lambda: [
        "循环次数", "cycle", "Cycle", "循环", "cycle_number"
    ])
    battery_id_columns: List[str] = field(default_factory=lambda: [
        "电池编号", "电池ID", "battery_id", "id", "ID", "样本编号", "sample_id"
    ])
    batch_columns: List[str] = field(default_factory=lambda: [
        "批次", "batch", "Batch", "批次号"
    ])
    
    unit_conversions: Dict[str, Dict[str, float]] = field(default_factory=lambda: {
        "capacity": {
            "mAh": 1.0,
            "Ah": 1000.0,
            "Wh": None,
            "KWh": None,
        }
    })
    
    initial_cycle: int = 1
    target_cycles: List[int] = field(default_factory=lambda: [100, 300, 500, 1000])
    target_capacity_retention: float = 80.0
    
    qc_rules: Dict = field(default_factory=lambda: {
        "duplicate_detection": True,
        "missing_value_threshold": 0.3,
        "outlier_method": "iqr",
        "outlier_threshold": 1.5,
        "capacity_min": 0.0,
        "capacity_max": None,
        "capacity_drop_threshold": 0.2,
        "min_cycles_required": 10,
    })
    
    export_formats: List[str] = field(default_factory=lambda: ["excel", "csv", "json"])
    plot_format: str = "png"
    plot_dpi: int = 300
    figure_size: tuple = (12, 8)
    
    log_to_file: bool = True
    log_file: Optional[str] = None
    log_level: str = "INFO"
    
    random_state: int = 42
