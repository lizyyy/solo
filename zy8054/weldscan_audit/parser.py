import csv
import json
import yaml
from pathlib import Path
from typing import List, Dict, Any
from pydantic import BaseModel, Field, field_validator
import math


UNITS = {"mm", "inch"}
INCH_TO_MM = 25.4


class Weld(BaseModel):
    weld_id: str
    thickness: float
    unit: str = Field(default="mm")
    length: float = Field(default=0.0)
    material: str = Field(default="")

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v.lower() not in UNITS:
            raise ValueError(f"Invalid unit: {v}. Must be one of {UNITS}")
        return v.lower()

    def to_mm(self, value: float) -> float:
        if self.unit == "inch":
            return value * INCH_TO_MM
        return value

    def from_mm(self, value: float) -> float:
        if self.unit == "inch":
            return value / INCH_TO_MM
        return value


class Probe(BaseModel):
    probe_id: str
    angle: float
    frequency: float
    velocity: float
    wedge_delay: float = Field(default=0.0)
    ref_point: float = Field(default=0.0)
    unit: str = Field(default="mm")

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v.lower() not in UNITS:
            raise ValueError(f"Invalid unit: {v}. Must be one of {UNITS}")
        return v.lower()


class Echo(BaseModel):
    echo_id: str
    weld_id: str
    probe_id: str
    time_of_flight: float
    amplitude: float
    scan_position: float
    unit: str = Field(default="mm")

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v.lower() not in UNITS:
            raise ValueError(f"Invalid unit: {v}. Must be one of {UNITS}")
        return v.lower()


class AcceptanceRule(BaseModel):
    name: str
    max_depth: float
    max_length: float
    amplitude_threshold: float
    severity_level: int = Field(default=1)
    unit: str = Field(default="mm")

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v.lower() not in UNITS:
            raise ValueError(f"Invalid unit: {v}. Must be one of {UNITS}")
        return v.lower()


def parse_welds(csv_path: Path) -> Dict[str, Weld]:
    welds = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            weld = Weld(
                weld_id=row["weld_id"],
                thickness=float(row["thickness"]),
                unit=row.get("unit", "mm"),
                length=float(row.get("length", 0)),
                material=row.get("material", ""),
            )
            welds[weld.weld_id] = weld
    return welds


def parse_probes(yaml_path: Path) -> Dict[str, Probe]:
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    probes = {}
    for item in data.get("probes", []):
        probe = Probe(**item)
        probes[probe.probe_id] = probe
    return probes


def parse_echoes(jsonl_path: Path) -> List[Echo]:
    echoes = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            echo = Echo(**data)
            echoes.append(echo)
    return echoes


def parse_acceptance_rules(yaml_path: Path) -> List[AcceptanceRule]:
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    rules = []
    for item in data.get("rules", []):
        rule = AcceptanceRule(**item)
        rules.append(rule)
    return rules
