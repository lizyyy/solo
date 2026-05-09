from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Config:
    energy_columns: List[str] = field(default_factory=lambda: ['能耗', '耗电量', '用电', 'energy', 'power', 'electricity'])
    production_columns: List[str] = field(default_factory=lambda: ['产量', '产能', '产出', 'production', 'output'])
    pressure_columns: List[str] = field(default_factory=lambda: ['压力', '气压', 'pressure'])
    leak_columns: List[str] = field(default_factory=lambda: ['泄漏', '漏气', 'leak'])
    datetime_columns: List[str] = field(default_factory=lambda: ['时间', '日期', 'datetime', 'time', 'date'])
    unit_columns: List[str] = field(default_factory=lambda: ['单位', 'unit'])
    id_columns: List[str] = field(default_factory=lambda: ['编号', 'ID', 'id', '序号'])
    
    energy_unit_map: Dict[str, float] = field(default_factory=lambda: {
        'kwh': 1.0, 'kw.h': 1.0, 'kwhr': 1.0, '千瓦时': 1.0, '度': 1.0,
        'mwh': 1000.0, '兆千瓦时': 1000.0,
        'wh': 0.001, '瓦时': 0.001, 'w.h': 0.001
    })
    
    production_unit_map: Dict[str, float] = field(default_factory=lambda: {
        'm3': 1.0, '立方米': 1.0, 'm³': 1.0,
        'l': 0.001, '升': 0.001,
        'nm3': 1.0, '标准立方米': 1.0
    })
    
    pressure_unit_map: Dict[str, float] = field(default_factory=lambda: {
        'mpa': 1.0, '兆帕': 1.0,
        'bar': 0.1,
        'kpa': 0.001, '千帕': 0.001,
        'pa': 1e-6, '帕': 1e-6
    })
    
    leak_unit_map: Dict[str, float] = field(default_factory=lambda: {
        'm3/min': 1.0, '立方米/分钟': 1.0, 'm³/min': 1.0,
        'l/min': 0.001, '升/分钟': 0.001,
        'm3/h': 1.0/60.0, '立方米/小时': 1.0/60.0
    })
    
    default_energy_unit: str = 'kWh'
    default_production_unit: str = 'm³'
    default_pressure_unit: str = 'MPa'
    default_leak_unit: str = 'm³/min'
    
    missing_threshold: float = 0.3
    duplicate_detection_columns: Optional[List[str]] = None
    outlier_iqr_multiplier: float = 1.5
    zscore_threshold: float = 3.0
    
    specific_energy_baseline: Optional[float] = None
    pressure_normal_range: tuple = (0.5, 1.0)
    leak_threshold: float = 0.1
    
    output_dir: str = 'output'
    report_file: str = 'anomaly_report.html'
    export_excel_file: str = 'analysis_results.xlsx'
    failed_samples_file: str = 'failed_samples.xlsx'
    log_file: str = 'analysis.log'


config = Config()
