import csv
import json
import yaml
from pathlib import Path
from dataclasses import dataclass


@dataclass
class Occupant:
    occupant_id: str
    name: str
    floor: int
    zone: str
    role: str


@dataclass
class DoorEvent:
    timestamp: float
    occupant_id: str
    door_id: str
    event_type: str
    floor: int


@dataclass
class FloorPlan:
    floors: dict
    doors: dict
    exits: dict


@dataclass
class DrillRules:
    max_evacuation_time: int
    max_stay_time: int
    reverse_threshold: float
    congestion_threshold: int


class ParseError(Exception):
    pass


def parse_roster(path: Path) -> list[Occupant]:
    occupants = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                occupants.append(Occupant(
                    occupant_id=row['occupant_id'],
                    name=row['name'],
                    floor=int(row['floor']),
                    zone=row['zone'],
                    role=row['role']
                ))
            except (KeyError, ValueError) as e:
                raise ParseError(f"Invalid occupant row: {row}, error: {e}")
    return occupants


def parse_door_events(path: Path) -> list[DoorEvent]:
    events = []
    with open(path, encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                events.append(DoorEvent(
                    timestamp=float(obj['timestamp']),
                    occupant_id=obj['occupant_id'],
                    door_id=obj['door_id'],
                    event_type=obj['event_type'],
                    floor=int(obj['floor'])
                ))
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                raise ParseError(f"Invalid event at line {line_num}: {line}, error: {e}")
    events.sort(key=lambda e: e.timestamp)
    return events


def parse_floor_plan(path: Path) -> FloorPlan:
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return FloorPlan(
        floors=data.get('floors', {}),
        doors=data.get('doors', {}),
        exits=data.get('exits', {})
    )


def parse_rules(path: Path) -> DrillRules:
    with open(path, encoding='utf-8') as f:
        data = yaml.safe_load(f)
    rules = data.get('evacuation_rules', {})
    return DrillRules(
        max_evacuation_time=rules.get('max_evacuation_time_seconds', 300),
        max_stay_time=rules.get('max_stay_time_seconds', 60),
        reverse_threshold=rules.get('reverse_threshold_meters', 2.0),
        congestion_threshold=rules.get('congestion_threshold_people', 10)
    )
