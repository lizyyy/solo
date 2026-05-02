import os
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional


DEFAULT_CONFIG = {
    "workspace": {
        "data_dir": "./data",
        "imports_dir": "./data/imports",
        "state_dir": "./data/state",
        "reports_dir": "./data/reports",
    },
    "sources": {
        "account_csv": {
            "required_columns": ["username", "department", "status", "last_login"],
            "status_active": ["active", "enabled"],
            "status_inactive": ["inactive", "disabled", "terminated"],
        },
        "ldap_groups": {
            "group_mapping": {
                "production_admin": "production_admin",
                "test_admin": "test_admin",
                "dev_admin": "dev_admin",
            },
        },
        "assets": {
            "env_column": "environment",
            "env_production": ["prod", "production", "线上"],
            "env_test": ["test", "testing", "测试"],
            "env_dev": ["dev", "development", "开发"],
        },
        "sudoers": {
            "forbidden_commands": ["rm -rf /", "su", "sudo su"],
            "forbidden_users": ["root"],
        },
    },
    "rules": {
        "enabled": [
            "orphan_account",
            "group_drift",
            "sudo_overreach",
            "asset_env_mismatch",
            "duplicate_account",
            "bad_row",
        ],
        "severity": {
            "orphan_account": "critical",
            "group_drift": "high",
            "sudo_overreach": "critical",
            "asset_env_mismatch": "high",
            "duplicate_account": "medium",
            "bad_row": "low",
        },
    },
}


@dataclass
class WorkspaceConfig:
    data_dir: str
    imports_dir: str
    state_dir: str
    reports_dir: str

    def __post_init__(self):
        for path_name in ["data_dir", "imports_dir", "state_dir", "reports_dir"]:
            path = getattr(self, path_name)
            if not os.path.isabs(path):
                setattr(self, path_name, os.path.abspath(path))


@dataclass
class SourceConfig:
    account_csv: Dict
    ldap_groups: Dict
    assets: Dict
    sudoers: Dict


@dataclass
class RuleConfig:
    enabled: List[str]
    severity: Dict[str, str]


@dataclass
class JumpGuardConfig:
    workspace: WorkspaceConfig
    sources: SourceConfig
    rules: RuleConfig
    config_path: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict, config_path: Optional[str] = None) -> "JumpGuardConfig":
        return cls(
            workspace=WorkspaceConfig(**data["workspace"]),
            sources=SourceConfig(**data["sources"]),
            rules=RuleConfig(**data["rules"]),
            config_path=config_path,
        )

    def to_dict(self) -> Dict:
        return {
            "workspace": {
                "data_dir": self.workspace.data_dir,
                "imports_dir": self.workspace.imports_dir,
                "state_dir": self.workspace.state_dir,
                "reports_dir": self.workspace.reports_dir,
            },
            "sources": {
                "account_csv": self.sources.account_csv,
                "ldap_groups": self.sources.ldap_groups,
                "assets": self.sources.assets,
                "sudoers": self.sources.sudoers,
            },
            "rules": {
                "enabled": self.rules.enabled,
                "severity": self.rules.severity,
            },
        }


class ConfigManager:
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or os.path.join(os.getcwd(), "jumpguard.yaml")
        self._config: Optional[JumpGuardConfig] = None

    def init_config(self, force: bool = False) -> JumpGuardConfig:
        config_dir = os.path.dirname(self.config_path)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)

        if os.path.exists(self.config_path) and not force:
            raise FileExistsError(f"Config file already exists: {self.config_path}")

        config = JumpGuardConfig.from_dict(DEFAULT_CONFIG, self.config_path)
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            yaml.dump(config.to_dict(), f, default_flow_style=False, allow_unicode=True, sort_keys=False)

        self._config = config
        return config

    def load_config(self) -> JumpGuardConfig:
        if self._config is not None:
            return self._config

        if not os.path.exists(self.config_path):
            self._config = JumpGuardConfig.from_dict(DEFAULT_CONFIG, self.config_path)
            return self._config

        with open(self.config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        merged = self._merge_configs(DEFAULT_CONFIG, data)
        self._config = JumpGuardConfig.from_dict(merged, self.config_path)
        return self._config

    def _merge_configs(self, default: Dict, override: Dict) -> Dict:
        result = default.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_configs(result[key], value)
            else:
                result[key] = value
        return result

    def ensure_workspace(self) -> None:
        config = self.load_config()
        for path in [
            config.workspace.data_dir,
            config.workspace.imports_dir,
            config.workspace.state_dir,
            config.workspace.reports_dir,
        ]:
            os.makedirs(path, exist_ok=True)
