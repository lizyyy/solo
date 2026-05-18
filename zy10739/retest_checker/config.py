import os
import yaml
from typing import Dict, Any, Optional


class ConfigLoader:
    def __init__(self, config_dir: Optional[str] = None):
        if config_dir is None:
            config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
        self.config_dir = config_dir
        self._rules: Optional[Dict[str, Any]] = None
        self._settings: Optional[Dict[str, Any]] = None

    @property
    def rules(self) -> Dict[str, Any]:
        if self._rules is None:
            self._rules = self._load_yaml("rules.yaml")
        return self._rules

    @property
    def settings(self) -> Dict[str, Any]:
        if self._settings is None:
            self._settings = self._load_yaml("settings.yaml")
        return self._settings

    def _load_yaml(self, filename: str) -> Dict[str, Any]:
        filepath = os.path.join(self.config_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"配置文件不存在: {filepath}")
        with open(filepath, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def get_match_field(self, field_type: str, candidates: list) -> Optional[str]:
        field_config = self.rules.get("match_fields", {}).get(field_type, [])
        for candidate in candidates:
            if candidate in field_config:
                return candidate
        return None

    def get_required_columns(self, data_type: str) -> list:
        key_mapping = {
            "sample_result": "result_columns",
            "retest_order": "retest_order_columns",
            "instrument_log": "instrument_log_columns"
        }
        config_key = key_mapping.get(data_type, f"{data_type}_columns")
        column_config = self.rules.get(config_key, {})
        return column_config.get("required", [])

    def get_optional_columns(self, data_type: str) -> list:
        key_mapping = {
            "sample_result": "result_columns",
            "retest_order": "retest_order_columns",
            "instrument_log": "instrument_log_columns"
        }
        config_key = key_mapping.get(data_type, f"{data_type}_columns")
        column_config = self.rules.get(config_key, {})
        return column_config.get("optional", [])


_config_loader: Optional[ConfigLoader] = None


def get_config(config_dir: Optional[str] = None) -> ConfigLoader:
    global _config_loader
    if _config_loader is None:
        _config_loader = ConfigLoader(config_dir)
    return _config_loader
