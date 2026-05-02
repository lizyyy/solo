import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional


@dataclass
class MachineLimits:
    x_min: float = -500.0
    x_max: float = 500.0
    y_min: float = -500.0
    y_max: float = 500.0
    z_min: float = -100.0
    z_max: float = 200.0


@dataclass
class MachineConfig:
    name: str = "Default CNC Mill"
    description: str = "Default CNC machine configuration"
    limits: MachineLimits = None
    max_feed_rate: float = 5000.0
    max_spindle_speed: float = 10000.0
    default_rapid_rate: float = 8000.0
    safe_height: float = 50.0
    tool_change_height: float = 100.0

    def __post_init__(self):
        if self.limits is None:
            self.limits = MachineLimits()

    @classmethod
    def from_file(cls, config_path: Path) -> "MachineConfig":
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        limits_data = data.get("limits", {})
        limits = MachineLimits(
            x_min=limits_data.get("x_min", -500.0),
            x_max=limits_data.get("x_max", 500.0),
            y_min=limits_data.get("y_min", -500.0),
            y_max=limits_data.get("y_max", 500.0),
            z_min=limits_data.get("z_min", -100.0),
            z_max=limits_data.get("z_max", 200.0),
        )
        return cls(
            name=data.get("name", "Default CNC Mill"),
            description=data.get("description", ""),
            limits=limits,
            max_feed_rate=data.get("max_feed_rate", 5000.0),
            max_spindle_speed=data.get("max_spindle_speed", 10000.0),
            default_rapid_rate=data.get("default_rapid_rate", 8000.0),
            safe_height=data.get("safe_height", 50.0),
            tool_change_height=data.get("tool_change_height", 100.0),
        )

    def to_file(self, config_path: Path):
        data = asdict(self)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
