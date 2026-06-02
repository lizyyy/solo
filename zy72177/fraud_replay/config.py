from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime

@dataclass
class Config:
    fraud_threshold: float = 0.5
    duplicate_detection_cols: List[str] = field(default_factory=lambda: ["user_id", "apply_time", "loan_amount"])
    label_conflict_warning_threshold: float = 0.05
    leakage_detection_window_hours: int = 24
    required_columns: List[str] = field(default_factory=lambda: [
        "sample_id", "user_id", "apply_time", "loan_amount", 
        "is_fraud", "model_score", "review_result", "source", "process_time"
    ])
    business_columns: List[str] = field(default_factory=lambda: [
        "user_id", "apply_time", "loan_amount", "loan_term",
        "income_level", "credit_score", "region"
    ])
    empty_value_indicators: List[str] = field(default_factory=lambda: ["", "NA", "N/A", "null", "NULL", "NaN", "nan"])

DEFAULT_CONFIG = Config()
