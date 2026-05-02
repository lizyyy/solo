import csv
import json
import yaml
from dataclasses import dataclass
from typing import List, Dict, Optional, Any


@dataclass
class ValveRecord:
    valve_id: str
    model: str
    nominal_diameter: float
    nominal_pressure: float
    set_pressure: float
    manufacturer: str
    installation_location: str


@dataclass
class TestCurvePoint:
    timestamp: float
    pressure: float
    lift: float


@dataclass
class TestCurve:
    valve_id: str
    test_time: str
    test_type: str
    points: List[TestCurvePoint]
    operator: str
    equipment_id: str


@dataclass
class RuleConfig:
    set_pressure_tolerance: float
    opening_closing_diff_max: float
    min_sample_points: int
    lead_seal_required: bool


def parse_valve_csv(file_path: str) -> List[ValveRecord]:
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(ValveRecord(
                valve_id=row['阀门编号'],
                model=row['型号'],
                nominal_diameter=float(row['公称直径']),
                nominal_pressure=float(row['公称压力']),
                set_pressure=float(row['整定压力']),
                manufacturer=row['制造单位'],
                installation_location=row['安装位置']
            ))
    return records


def parse_curve_jsonl(file_path: str) -> List[TestCurve]:
    curves = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            points = [TestCurvePoint(**p) for p in data['points']]
            curves.append(TestCurve(
                valve_id=data['valve_id'],
                test_time=data['test_time'],
                test_type=data['test_type'],
                points=points,
                operator=data['operator'],
                equipment_id=data['equipment_id']
            ))
    return curves


def parse_rules_yaml(file_path: str) -> RuleConfig:
    with open(file_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    return RuleConfig(
        set_pressure_tolerance=config['set_pressure_tolerance'],
        opening_closing_diff_max=config['opening_closing_diff_max'],
        min_sample_points=config['min_sample_points'],
        lead_seal_required=config['lead_seal_required']
    )


def build_valve_index(records: List[ValveRecord]) -> Dict[str, ValveRecord]:
    return {r.valve_id: r for r in records}


def group_curves_by_valve(curves: List[TestCurve]) -> Dict[str, List[TestCurve]]:
    groups = {}
    for curve in curves:
        if curve.valve_id not in groups:
            groups[curve.valve_id] = []
        groups[curve.valve_id].append(curve)
    return groups