from typing import List, Dict, Type, Optional

from track_cleaner.rules.base import AnomalyRule, RuleResult
from track_cleaner.rules.duplicate_timestamps import DuplicateTimestampRule
from track_cleaner.rules.out_of_order import OutOfOrderTimestampRule
from track_cleaner.rules.speed_anomaly import SpeedAnomalyRule
from track_cleaner.rules.breakpoint import BreakpointRule
from track_cleaner.rules.elevation_spike import ElevationSpikeRule
from track_cleaner.rules.missing_coords import MissingCoordinatesRule
from track_cleaner.models.track import Track
from track_cleaner.config import AppConfig


RULE_REGISTRY: Dict[str, Type[AnomalyRule]] = {
    "duplicate_timestamp": DuplicateTimestampRule,
    "out_of_order_timestamp": OutOfOrderTimestampRule,
    "speed_anomaly": SpeedAnomalyRule,
    "breakpoint": BreakpointRule,
    "elevation_spike": ElevationSpikeRule,
    "missing_coordinates": MissingCoordinatesRule,
}


def get_all_rules() -> List[Type[AnomalyRule]]:
    return list(RULE_REGISTRY.values())


def get_rule_by_name(name: str) -> Type[AnomalyRule]:
    if name not in RULE_REGISTRY:
        raise ValueError(f"未知的规则: {name}。可用规则: {list(RULE_REGISTRY.keys())}")
    return RULE_REGISTRY[name]


def apply_all_rules(track: Track, config: AppConfig) -> List[RuleResult]:
    all_results = []
    
    for rule_class in get_all_rules():
        rule = rule_class()
        results = rule.apply(track, config)
        all_results.extend(results)
    
    return all_results
