from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import re
from pathlib import Path
import yaml


@dataclass
class LogFormat:
    timestamp_field: str = "timestamp"
    timestamp_format: str = "%Y-%m-%d %H:%M:%S"
    path_field: str = "path"
    method_field: str = "method"
    status_field: str = "status"
    duration_field: str = "duration_ms"
    duration_unit: str = "ms"
    business_code_field: Optional[str] = None
    trace_id_field: Optional[str] = None


@dataclass
class SLORule:
    name: str
    group_pattern: str
    target: float
    type: str
    unit: str
    description: str = ""
    window_days: int = 28
    quantile: Optional[float] = None
    latency_threshold_ms: Optional[float] = None
    exclude_health_checks: bool = True
    health_check_patterns: List[str] = field(default_factory=lambda: [
        r"/health",
        r"/healthz",
        r"/ping",
        r"/ready",
        r"/metrics",
        r"/actuator/health"
    ])
    include_patterns: List[str] = field(default_factory=list)
    exclude_patterns: List[str] = field(default_factory=list)
    business_error_codes: List[str] = field(default_factory=list)
    http_5xx_considered_error: bool = True
    http_4xx_considered_error: bool = False


@dataclass
class EndpointGroup:
    name: str
    patterns: List[str]
    description: str = ""


@dataclass
class SLOConfig:
    log_format: LogFormat = field(default_factory=LogFormat)
    rules: List[SLORule] = field(default_factory=list)
    endpoint_groups: List[EndpointGroup] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def validate(self) -> List[str]:
        errors = []

        for i, rule in enumerate(self.rules):
            if rule.target <= 0 or rule.target > 100:
                errors.append(f"规则 {i} ({rule.name}): target 应在 (0, 100] 之间")

            if rule.type == "latency":
                if rule.quantile is None:
                    errors.append(f"规则 {i} ({rule.name}): latency 类型需要指定 quantile")
                if rule.latency_threshold_ms is None:
                    errors.append(f"规则 {i} ({rule.name}): latency 类型需要指定 latency_threshold_ms")
            elif rule.type == "availability":
                pass
            elif rule.type == "error_rate":
                pass
            else:
                errors.append(f"规则 {i} ({rule.name}): 未知的 SLO 类型 {rule.type}")

        return errors

    def get_rule_by_name(self, name: str) -> Optional[SLORule]:
        for rule in self.rules:
            if rule.name == name:
                return rule
        return None

    def get_matching_rules(self, endpoint: str) -> List[SLORule]:
        matched = []
        for rule in self.rules:
            if re.match(rule.group_pattern, endpoint):
                matched.append(rule)
        return matched

    def get_group_for_endpoint(self, endpoint: str) -> Optional[EndpointGroup]:
        for group in self.endpoint_groups:
            for pattern in group.patterns:
                if re.match(pattern, endpoint):
                    return group
        return None

    def is_health_check(self, path: str) -> bool:
        for rule in self.rules:
            if rule.exclude_health_checks:
                for pattern in rule.health_check_patterns:
                    if re.search(pattern, path, re.IGNORECASE):
                        return True
        return False


def load_config(path: Path) -> SLOConfig:
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)

    log_format = LogFormat(**data.get('log_format', {}))

    rules = []
    for rule_data in data.get('rules', []):
        rules.append(SLORule(**rule_data))

    groups = []
    for group_data in data.get('endpoint_groups', []):
        groups.append(EndpointGroup(**group_data))

    config = SLOConfig(
        log_format=log_format,
        rules=rules,
        endpoint_groups=groups,
        metadata=data.get('metadata', {})
    )

    return config
