from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class ConfigMapKeyValue:
    key: str
    value: Any
    source_file: str
    layer: str
    is_final: bool = False


@dataclass
class OverlayLayer:
    name: str
    path: str
    layer_order: int
    configmaps: Dict[str, Dict[str, ConfigMapKeyValue]] = field(default_factory=dict)


@dataclass
class CoverageItem:
    key: str
    value: Any
    source_layer: str
    source_file: str
    is_override: bool = False
    previous_value: Any = None
    previous_layer: Optional[str] = None


@dataclass
class ConfigMapResult:
    name: str
    namespace: str
    final_data: Dict[str, Any]
    coverage_chain: Dict[str, List[CoverageItem]]
    conflicts: List[str]


@dataclass
class AnalysisReport:
    base_dir: str
    layers: List[str]
    configmaps: List[ConfigMapResult]
    errors: List[str]
    warnings: List[str]
    total_overrides_count: int
    total_conflicts_count: int
