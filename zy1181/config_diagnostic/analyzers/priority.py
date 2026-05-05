from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from ..parsers.base import ConfigSource, ConfigValue, ParsedConfig


class PriorityLevel(Enum):
    LOWEST = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    HIGHEST = 4


SOURCE_PRIORITY: Dict[ConfigSource, PriorityLevel] = {
    ConfigSource.DEFAULT: PriorityLevel.LOWEST,
    ConfigSource.GLOBAL_JSON: PriorityLevel.LOW,
    ConfigSource.YAML_CONFIG: PriorityLevel.MEDIUM,
    ConfigSource.SQLITE_DB: PriorityLevel.HIGH,
    ConfigSource.LOCAL_JSON: PriorityLevel.HIGH,
    ConfigSource.ENV_FILE: PriorityLevel.HIGHEST,
}


@dataclass
class OverrideInfo:
    key: str
    effective_value: Any
    effective_source: ConfigSource
    effective_source_path: str
    overridden_by: List[Dict[str, Any]] = field(default_factory=list)
    original_sources: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class PriorityResult:
    total_configs: int = 0
    total_keys: int = 0
    overridden_keys: int = 0
    unique_keys: int = 0
    overrides: Dict[str, OverrideInfo] = field(default_factory=dict)
    source_distribution: Dict[ConfigSource, int] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


class PriorityAnalyzer:
    def __init__(self):
        self._configs: List[ParsedConfig] = []
    
    def add_config(self, config: ParsedConfig) -> None:
        self._configs.append(config)
    
    def analyze(self) -> PriorityResult:
        result = PriorityResult()
        result.total_configs = len(self._configs)
        
        all_values: Dict[str, List[ConfigValue]] = {}
        
        for config in self._configs:
            for key, value in config.values.items():
                if key not in all_values:
                    all_values[key] = []
                all_values[key].append(value)
            
            if config.config_type in result.source_distribution:
                result.source_distribution[config.config_type] += 1
            else:
                result.source_distribution[config.config_type] = 1
        
        result.total_keys = sum(len(v) for v in all_values.values())
        result.unique_keys = len(all_values)
        
        for key, values in all_values.items():
            if len(values) > 1:
                override_info = self._analyze_override(key, values)
                result.overrides[key] = override_info
                result.overridden_keys += 1
        
        return result
    
    def _analyze_override(self, key: str, values: List[ConfigValue]) -> OverrideInfo:
        sorted_values = sorted(
            values,
            key=lambda v: SOURCE_PRIORITY.get(v.source, PriorityLevel.LOWEST).value,
            reverse=True
        )
        
        effective = sorted_values[0]
        overridden = sorted_values[1:]
        
        override_info = OverrideInfo(
            key=key,
            effective_value=effective.value,
            effective_source=effective.source,
            effective_source_path=effective.source_path or "",
        )
        
        for ov in overridden:
            override_info.overridden_by.append({
                "value": ov.value,
                "source": ov.source.value,
                "source_path": ov.source_path,
                "priority": SOURCE_PRIORITY.get(ov.source, PriorityLevel.LOWEST).value,
            })
        
        for sv in sorted_values:
            override_info.original_sources.append({
                "value": sv.value,
                "source": sv.source.value,
                "source_path": sv.source_path,
                "priority": SOURCE_PRIORITY.get(sv.source, PriorityLevel.LOWEST).value,
                "is_effective": sv == effective,
            })
        
        return override_info
    
    def get_effective_config(self) -> Dict[str, Any]:
        effective: Dict[str, Any] = {}
        all_values: Dict[str, List[ConfigValue]] = {}
        
        for config in self._configs:
            for key, value in config.values.items():
                if key not in all_values:
                    all_values[key] = []
                all_values[key].append(value)
        
        for key, values in all_values.items():
            sorted_values = sorted(
                values,
                key=lambda v: SOURCE_PRIORITY.get(v.source, PriorityLevel.LOWEST).value,
                reverse=True
            )
            effective[key] = sorted_values[0].value
        
        return effective
    
    def get_source_priority(self) -> Dict[str, int]:
        return {
            source.value: priority.value
            for source, priority in SOURCE_PRIORITY.items()
        }
