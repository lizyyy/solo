from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import yaml


@dataclass
class ScannerConfig:
    whitelist: List[str] = field(default_factory=list)
    whitelist_values: List[str] = field(default_factory=list)
    min_risk_level: str = "low"
    custom_patterns: dict = field(default_factory=dict)
    exclude_patterns: List[str] = field(default_factory=list)

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> "ScannerConfig":
        config = cls()
        if config_path and config_path.exists():
            with open(config_path, "r") as f:
                data = yaml.safe_load(f) or {}
                config.whitelist.extend(data.get("whitelist", []))
                config.whitelist_values.extend(data.get("whitelist_values", []))
                config.min_risk_level = data.get("min_risk_level", "low")
                config.custom_patterns.update(data.get("custom_patterns", {}))
                config.exclude_patterns.extend(data.get("exclude_patterns", []))
        return config

    def is_whitelisted(self, field_path: str) -> bool:
        for w in self.whitelist:
            if w.endswith(".*"):
                if field_path.startswith(w[:-2]):
                    return True
            else:
                if field_path == w:
                    return True
        return False

    def is_value_whitelisted(self, value: str) -> bool:
        return value in self.whitelist_values
