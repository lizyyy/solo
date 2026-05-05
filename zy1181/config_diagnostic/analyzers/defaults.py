from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from ..parsers.base import ConfigSource, ConfigValue, ParsedConfig


class DefaultStatus(Enum):
    EXPLICITLY_SET = "explicitly_set"
    USING_DEFAULT = "using_default"
    MISSING_NO_DEFAULT = "missing_no_default"
    OVERRIDDEN = "overridden"


@dataclass
class DefaultInfo:
    key: str
    current_value: Any
    default_value: Any
    status: DefaultStatus
    source: str
    is_overridden: bool
    override_sources: List[str]


@dataclass
class DefaultsResult:
    total_keys: int = 0
    using_default: int = 0
    explicitly_set: int = 0
    missing_no_default: int = 0
    overridden: int = 0
    defaults_info: Dict[str, DefaultInfo] = field(default_factory=dict)
    missing_keys: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class DefaultsAnalyzer:
    COMMON_DEFAULTS: Dict[str, Any] = {
        "debug": False,
        "verbose": False,
        "port": 8080,
        "host": "localhost",
        "enabled": True,
        "disabled": False,
        "timeout": 30,
        "retry": 3,
        "log_level": "INFO",
        "environment": "development",
        "env": "development",
        "max_connections": 10,
        "pool_size": 5,
        "cache_ttl": 300,
        "read_timeout": 30,
        "write_timeout": 30,
        "connect_timeout": 10,
        "keep_alive": True,
        "compression": False,
        "ssl": False,
        "tls": False,
    }
    
    def __init__(self):
        self._configs: List[ParsedConfig] = []
        self._custom_defaults: Dict[str, Any] = {}
    
    def add_config(self, config: ParsedConfig) -> None:
        self._configs.append(config)
    
    def set_custom_defaults(self, defaults: Dict[str, Any]) -> None:
        self._custom_defaults = defaults.copy()
    
    def analyze(self) -> DefaultsResult:
        result = DefaultsResult()
        
        all_keys: Set[str] = set()
        all_values: Dict[str, List[ConfigValue]] = {}
        
        for config in self._configs:
            for key, value in config.values.items():
                all_keys.add(key)
                if key not in all_values:
                    all_values[key] = []
                all_values[key].append(value)
        
        result.total_keys = len(all_keys)
        
        for key in all_keys:
            values = all_values[key]
            default_value = self._get_default_value(key)
            
            effective_value, effective_source, override_sources = self._get_effective_value(
                key, values
            )
            
            status = self._determine_status(key, effective_value, default_value, len(values))
            
            default_info = DefaultInfo(
                key=key,
                current_value=effective_value,
                default_value=default_value,
                status=status,
                source=effective_source,
                is_overridden=len(override_sources) > 0,
                override_sources=override_sources,
            )
            
            result.defaults_info[key] = default_info
            
            if status == DefaultStatus.USING_DEFAULT:
                result.using_default += 1
            elif status == DefaultStatus.EXPLICITLY_SET:
                result.explicitly_set += 1
            elif status == DefaultStatus.MISSING_NO_DEFAULT:
                result.missing_no_default += 1
                result.missing_keys.append(key)
            elif status == DefaultStatus.OVERRIDDEN:
                result.overridden += 1
        
        self._generate_warnings(result)
        
        return result
    
    def _get_default_value(self, key: str) -> Any:
        if key in self._custom_defaults:
            return self._custom_defaults[key]
        
        for default_key, default_value in self.COMMON_DEFAULTS.items():
            if key.lower() == default_key.lower():
                return default_value
            if key.lower().endswith(f".{default_key}"):
                return default_value
        
        return None
    
    def _get_effective_value(
        self,
        key: str,
        values: List[ConfigValue]
    ) -> tuple[Any, str, List[str]]:
        from .priority import SOURCE_PRIORITY, PriorityLevel
        
        sorted_values = sorted(
            values,
            key=lambda v: SOURCE_PRIORITY.get(v.source, PriorityLevel.LOWEST).value,
            reverse=True
        )
        
        effective = sorted_values[0]
        overridden = sorted_values[1:]
        
        override_sources = [
            f"{ov.source.value} ({ov.source_path})"
            for ov in overridden
        ]
        
        return (
            effective.value,
            f"{effective.source.value} ({effective.source_path})",
            override_sources
        )
    
    def _determine_status(
        self,
        key: str,
        effective_value: Any,
        default_value: Any,
        value_count: int
    ) -> DefaultStatus:
        if effective_value == default_value and default_value is not None:
            if value_count > 1:
                return DefaultStatus.OVERRIDDEN
            return DefaultStatus.USING_DEFAULT
        
        if default_value is None:
            return DefaultStatus.MISSING_NO_DEFAULT
        
        return DefaultStatus.EXPLICITLY_SET
    
    def _generate_warnings(self, result: DefaultsResult) -> None:
        if result.missing_no_default > 0:
            result.warnings.append(
                f"Found {result.missing_no_default} keys with no known default value. "
                f"Consider adding custom defaults for these keys."
            )
        
        for key, info in result.defaults_info.items():
            if info.is_overridden and info.status == DefaultStatus.USING_DEFAULT:
                result.warnings.append(
                    f"Key '{key}' is overridden but still uses default value. "
                    f"Override sources: {', '.join(info.override_sources)}"
                )
        
        if result.overridden > 0:
            result.warnings.append(
                f"Found {result.overridden} keys that are overridden by higher priority sources."
            )
    
    def get_using_default_keys(self) -> List[str]:
        return [
            key for key, info in self.analyze().defaults_info.items()
            if info.status == DefaultStatus.USING_DEFAULT
        ]
    
    def get_missing_default_keys(self) -> List[str]:
        return self.analyze().missing_keys
    
    def suggest_defaults(self, key: str) -> List[Dict[str, Any]]:
        suggestions: List[Dict[str, Any]] = []
        
        key_lower = key.lower()
        
        for default_key, default_value in self.COMMON_DEFAULTS.items():
            if default_key in key_lower or key_lower in default_key:
                suggestions.append({
                    "key": default_key,
                    "suggested_value": default_value,
                    "match_type": "partial",
                })
        
        if not suggestions:
            suggestions.append({
                "key": key,
                "suggested_value": None,
                "match_type": "none",
                "note": "No common default found. Please provide a custom default.",
            })
        
        return suggestions
