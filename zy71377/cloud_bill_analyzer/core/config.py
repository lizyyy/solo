import os
import yaml
from dataclasses import dataclass, field
from typing import Dict, List, Optional


SENSITIVE_FIELDS_DEFAULT = [
    "aws_account_id",
    "account_id",
    "aliyun_account_id",
    "access_key",
    "secret_key",
    "ak",
    "sk",
    "owner_id",
    "tenant_id",
    "subscription_id",
]

MASK_PATTERN = "***"


@dataclass
class Config:
    target_currency: str = "CNY"
    exchange_rates: Dict[str, float] = field(default_factory=lambda: {"USD": 7.25, "CNY": 1.0})
    anomaly_threshold_percent: float = 20.0
    anomaly_min_amount: float = 100.0
    sensitive_fields: List[str] = field(default_factory=lambda: SENSITIVE_FIELDS_DEFAULT.copy())
    mask_pattern: str = MASK_PATTERN
    enable_log_masking: bool = True
    enable_export_masking: bool = True
    enable_display_masking: bool = True
    required_tags: List[str] = field(default_factory=lambda: ["project", "team", "environment"])
    duplicate_ri_detection: bool = True
    budget_warning_percent: float = 80.0


def load_config(config_path: Optional[str] = None) -> Config:
    config = Config()
    if config_path and os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            user_config = yaml.safe_load(f) or {}
        if "target_currency" in user_config:
            config.target_currency = user_config["target_currency"]
        if "exchange_rates" in user_config:
            config.exchange_rates.update(user_config["exchange_rates"])
        if "anomaly_threshold_percent" in user_config:
            config.anomaly_threshold_percent = user_config["anomaly_threshold_percent"]
        if "anomaly_min_amount" in user_config:
            config.anomaly_min_amount = user_config["anomaly_min_amount"]
        if "sensitive_fields" in user_config:
            config.sensitive_fields.extend(user_config["sensitive_fields"])
        if "mask_pattern" in user_config:
            config.mask_pattern = user_config["mask_pattern"]
        if "enable_log_masking" in user_config:
            config.enable_log_masking = user_config["enable_log_masking"]
        if "enable_export_masking" in user_config:
            config.enable_export_masking = user_config["enable_export_masking"]
        if "enable_display_masking" in user_config:
            config.enable_display_masking = user_config["enable_display_masking"]
        if "required_tags" in user_config:
            config.required_tags = user_config["required_tags"]
        if "duplicate_ri_detection" in user_config:
            config.duplicate_ri_detection = user_config["duplicate_ri_detection"]
        if "budget_warning_percent" in user_config:
            config.budget_warning_percent = user_config["budget_warning_percent"]
    return config
