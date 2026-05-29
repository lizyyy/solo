import os
import yaml
from pathlib import Path
from typing import Dict, Any


class Config:
    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "config.yaml"
        
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.project_root = self.config_path.parent.parent

    def _load_config(self) -> Dict[str, Any]:
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def get(self, key_path: str, default: Any = None) -> Any:
        keys = key_path.split('.')
        value = self.config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

    def get_data_source_path(self, source_name: str) -> Path:
        relative_path = self.get(f"api_key_rotation.data_sources.{source_name}.file")
        return self.project_root / relative_path

    def get_report_dir(self) -> Path:
        relative_path = self.get("api_key_rotation.output.report_dir")
        return self.project_root / relative_path

    def get_diff_dir(self) -> Path:
        relative_path = self.get("api_key_rotation.output.diff_dir")
        return self.project_root / relative_path
