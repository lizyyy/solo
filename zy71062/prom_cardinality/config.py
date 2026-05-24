from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any


class OutputMode(Enum):
    OVERWRITE = "overwrite"
    APPEND = "append"
    FAIL = "fail"


@dataclass
class Config:
    metrics_path: Optional[str] = None
    labels_path: Optional[str] = None
    rules_path: Optional[str] = None
    service_name: Optional[str] = None
    history_path: Optional[str] = None
    report_path: Optional[str] = None
    output_dir: str = "./cardinality_output"
    output_mode: OutputMode = OutputMode.OVERWRITE
    base_threshold: int = 1000
    top_n: int = 20
    include_empty_labels: bool = False
    detect_masked_high_cardinality: bool = True
    output_formats: tuple = field(default_factory=lambda: ("all",))
    verbose: bool = False
    quiet: bool = False
    
    rules: Dict[str, Any] = field(default_factory=dict)
    custom_thresholds: Dict[str, int] = field(default_factory=dict)
    
    def __post_init__(self):
        if self.rules_path:
            self._load_rules()
    
    def _load_rules(self):
        import json
        import yaml
        
        ext = self.rules_path.lower().split('.')[-1]
        
        with open(self.rules_path, 'r') as f:
            if ext in ['yaml', 'yml']:
                self.rules = yaml.safe_load(f) or {}
            else:
                self.rules = json.load(f)
        
        self.custom_thresholds = self.rules.get('thresholds', {})
    
    def get_threshold_for_metric(self, metric_name: str) -> int:
        if metric_name in self.custom_thresholds:
            return self.custom_thresholds[metric_name]
        return self.base_threshold
