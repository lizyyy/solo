import os
import re
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import dotenv_values

from .constants import CONFIG_SOURCE_PRIORITY, LOG_LEVELS
from .models import ConfigSource, LoggerRule


class EnvironmentProcessor:
    def __init__(self):
        self.env_vars: Dict[str, str] = {}
        self.env_files: List[Path] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def load_env_file(self, file_path: Path) -> None:
        file_path = file_path.resolve()
        if not file_path.exists():
            self.errors.append(f"ENV_ERROR: 环境文件不存在: {file_path}")
            return
        try:
            values = dotenv_values(file_path)
            self.env_files.append(file_path)
            for key, value in values.items():
                if value is not None:
                    self.env_vars[key] = value
        except Exception as e:
            self.errors.append(f"ENV_ERROR: 加载环境文件失败 {file_path}: {e}")

    def load_system_env(self, prefix: str = "LOG4J_") -> None:
        for key, value in os.environ.items():
            if key.startswith(prefix):
                self.env_vars[key] = value

    def extract_logger_overrides(self) -> List[LoggerRule]:
        rules = []
        logger_pattern = re.compile(
            r'^(?:LOG4J_)?(?:LOGGER_)([A-Za-z0-9_.]+)(?:_LEVEL)?$',
            re.IGNORECASE
        )

        for key, value in self.env_vars.items():
            match = logger_pattern.match(key)
            if match:
                pkg = match.group(1).replace('_', '.').lower()
                level = value.strip().upper()
                if level in LOG_LEVELS:
                    source = ConfigSource(
                        source_type="env_var",
                        path=key,
                        priority=CONFIG_SOURCE_PRIORITY["env_var"]
                    )
                    rules.append(LoggerRule(
                        package_pattern=pkg,
                        level=level,
                        source=source,
                        is_wildcard='*' in pkg or '?' in pkg
                    ))
                else:
                    self.errors.append(
                        f"VALIDATION_ERROR: 环境变量 '{key}' 的日志级别值 '{value}' 无效，有效值: {', '.join(LOG_LEVELS)}"
                    )

        root_patterns = ['LOG4J_ROOT_LEVEL', 'ROOT_LOGGER_LEVEL', 'LOG4J_ROOT']
        for key in root_patterns:
            if key in self.env_vars:
                level = self.env_vars[key].strip().upper()
                if level in LOG_LEVELS:
                    source = ConfigSource(
                        source_type="env_var",
                        path=key,
                        priority=CONFIG_SOURCE_PRIORITY["env_var"]
                    )
                    rules.append(LoggerRule(
                        package_pattern="root",
                        level=level,
                        source=source
                    ))
                else:
                    self.errors.append(
                        f"VALIDATION_ERROR: 环境变量 '{key}' 的日志级别值 '{self.env_vars[key]}' 无效，有效值: {', '.join(LOG_LEVELS)}"
                    )

        return rules
