import yaml
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class FareRule:
    min_distance: int
    max_distance: int
    price: int


@dataclass
class FareRules:
    fare_rules: List[FareRule]
    max_trip_time: int
    transfer_time_window: int


def parse_fare_rules(file_path: str) -> FareRules:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    fare_rules = []
    for rule_data in data['fare_rules']:
        rule = FareRule(
            min_distance=rule_data['min_distance'],
            max_distance=rule_data['max_distance'],
            price=rule_data['price'],
        )
        fare_rules.append(rule)
    
    return FareRules(
        fare_rules=fare_rules,
        max_trip_time=data.get('max_trip_time', 7200),
        transfer_time_window=data.get('transfer_time_window', 1800),
    )
