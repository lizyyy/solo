import os
import yaml
from pathlib import Path
from typing import Dict, Any


class Config:
    def __init__(self, config_path: str = None):
        self.config_path = config_path or "config.yaml"
        self._config = self._load_config()
        self._setup_directories()

    def _load_config(self) -> Dict[str, Any]:
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")
        with open(self.config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def _setup_directories(self):
        paths = self._config.get("paths", {})
        for key, path in paths.items():
            if key != "db_path":
                Path(path).mkdir(parents=True, exist_ok=True)

    @property
    def system(self) -> Dict[str, Any]:
        return self._config.get("system", {})

    @property
    def paths(self) -> Dict[str, str]:
        return self._config.get("paths", {})

    @property
    def surrender(self) -> Dict[str, Any]:
        return self._config.get("surrender", {})

    @property
    def validation(self) -> Dict[str, Any]:
        return self._config.get("validation", {})

    @property
    def data_sources(self) -> Dict[str, Any]:
        return self._config.get("data_sources", {})

    @property
    def export(self) -> Dict[str, Any]:
        return self._config.get("export", {})


def load_config(config_path: str = None) -> Config:
    return Config(config_path)
