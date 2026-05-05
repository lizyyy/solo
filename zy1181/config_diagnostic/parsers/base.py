from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class ConfigType(Enum):
    JSON = "json"
    ENV = "env"
    YAML = "yaml"
    SQLITE = "sqlite"


class ConfigSource(Enum):
    DEFAULT = "default"
    ENV_FILE = ".env"
    LOCAL_JSON = "settings.local.json"
    GLOBAL_JSON = "settings.json"
    YAML_CONFIG = "config.yaml"
    SQLITE_DB = "sqlite"


@dataclass
class ConfigValue:
    key: str
    value: Any
    source: ConfigSource
    source_path: Optional[str] = None
    line_number: Optional[int] = None
    is_default: bool = False
    is_sensitive: bool = False


@dataclass
class ParsedConfig:
    config_type: ConfigType
    source_path: str
    values: Dict[str, ConfigValue] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    
    def get_all_keys(self) -> List[str]:
        return list(self.values.keys())
    
    def get_value(self, key: str) -> Optional[ConfigValue]:
        return self.values.get(key)


class ConfigParser(ABC):
    def __init__(self):
        self._parsed: Optional[ParsedConfig] = None
    
    @abstractmethod
    def can_parse(self, path: Path) -> bool:
        pass
    
    @abstractmethod
    def parse(self, path: Path) -> ParsedConfig:
        pass
    
    @property
    def parsed(self) -> Optional[ParsedConfig]:
        return self._parsed
    
    @staticmethod
    def _detect_sensitive_key(key: str) -> bool:
        sensitive_patterns = [
            "password", "passwd", "pwd", "secret", "token", "api_key",
            "apikey", "private_key", "privatekey", "credential",
            "authorization", "auth", "access_token", "refresh_token",
            "aws_secret", "aws_access", "db_pass", "database_pass",
            "connection_string", "conn_string", "redis_pass",
            "mongo_pass", "mysql_pass", "postgres_pass",
        ]
        key_lower = key.lower()
        return any(pattern in key_lower for pattern in sensitive_patterns)
    
    @staticmethod
    def _is_env_file(path: Path) -> bool:
        name = path.name
        return name == ".env" or name.startswith(".env.") or path.suffix == ".env"
    
    @staticmethod
    def _is_json_file(path: Path) -> bool:
        return path.suffix in [".json", ".jsonc"]
    
    @staticmethod
    def _is_yaml_file(path: Path) -> bool:
        return path.suffix in [".yaml", ".yml"]
    
    @staticmethod
    def _is_sqlite_file(path: Path) -> bool:
        return path.suffix in [".db", ".sqlite", ".sqlite3"]
