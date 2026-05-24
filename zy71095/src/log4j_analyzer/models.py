from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ConfigSource:
    source_type: str
    path: Optional[str] = None
    priority: int = 0
    line_number: Optional[int] = None


@dataclass
class LoggerRule:
    package_pattern: str
    level: str
    source: ConfigSource
    additivity: Optional[bool] = None
    appenders: List[str] = field(default_factory=list)
    is_wildcard: bool = False


@dataclass
class AppenderConfig:
    name: str
    type: str
    config: Dict[str, str]
    source: ConfigSource


@dataclass
class ChainLink:
    rule: LoggerRule
    previous_level: Optional[str] = None
    reason: str = ""


@dataclass
class PackageResolution:
    package_name: str
    final_level: str
    chain: List[ChainLink] = field(default_factory=list)
    matched_patterns: List[str] = field(default_factory=list)


@dataclass
class AnalysisResult:
    root_logger: Optional[LoggerRule] = None
    loggers: Dict[str, LoggerRule] = field(default_factory=dict)
    appenders: Dict[str, AppenderConfig] = field(default_factory=dict)
    resolutions: Dict[str, PackageResolution] = field(default_factory=dict)
    config_files: List[Path] = field(default_factory=list)
    env_files: List[Path] = field(default_factory=list)
    environment_vars: Dict[str, str] = field(default_factory=dict)
    exit_code: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
