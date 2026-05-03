import os
import json
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from pathlib import Path


DEFAULT_CONFIG_NAME = ".power_checker.json"
DEFAULT_DATA_DIR = ".power_data"


@dataclass
class CircuitConfig:
    id: str
    name: str
    phase: str
    rated_current: float
    max_current: float


@dataclass
class ProjectConfig:
    project_name: str
    show_name: str
    date: str
    circuits: List[CircuitConfig]
    time_window_minutes: int = 5
    overload_threshold_pct: float = 110.0
    phase_imbalance_threshold_pct: float = 15.0
    time_deviation_seconds: int = 300
    data_dir: str = DEFAULT_DATA_DIR
    log_date_format: str = "%Y-%m-%d %H:%M:%S"
    plan_date_format: str = "%Y-%m-%d %H:%M:%S"

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> "ProjectConfig":
        circuits = [CircuitConfig(**c) for c in data.get("circuits", [])]
        return cls(
            project_name=data.get("project_name", ""),
            show_name=data.get("show_name", ""),
            date=data.get("date", ""),
            circuits=circuits,
            time_window_minutes=data.get("time_window_minutes", 5),
            overload_threshold_pct=data.get("overload_threshold_pct", 110.0),
            phase_imbalance_threshold_pct=data.get(
                "phase_imbalance_threshold_pct", 15.0
            ),
            time_deviation_seconds=data.get("time_deviation_seconds", 300),
            data_dir=data.get("data_dir", DEFAULT_DATA_DIR),
            log_date_format=data.get("log_date_format", "%Y-%m-%d %H:%M:%S"),
            plan_date_format=data.get("plan_date_format", "%Y-%m-%d %H:%M:%S"),
        )


def get_config_path(target_dir: str = None) -> Path:
    if target_dir is None:
        target_dir = os.getcwd()
    return Path(target_dir) / DEFAULT_CONFIG_NAME


def load_config(target_dir: str = None) -> Optional[ProjectConfig]:
    config_path = get_config_path(target_dir)
    if not config_path.exists():
        return None
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectConfig.from_dict(data)
    except (json.JSONDecodeError, IOError):
        return None


def save_config(config: ProjectConfig, target_dir: str = None):
    config_path = get_config_path(target_dir)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config.to_dict(), f, ensure_ascii=False, indent=2)


def get_data_dir(config: ProjectConfig, target_dir: str = None) -> Path:
    if target_dir is None:
        target_dir = os.getcwd()
    return Path(target_dir) / config.data_dir


def ensure_data_dirs(config: ProjectConfig, target_dir: str = None):
    data_dir = get_data_dir(config, target_dir)
    subdirs = ["logs", "plans", "quarantine", "analysis", "review"]
    for subdir in subdirs:
        (data_dir / subdir).mkdir(parents=True, exist_ok=True)


def create_default_config(project_name: str = "未命名项目") -> ProjectConfig:
    default_circuits = [
        CircuitConfig(id="A1", name="主舞台灯光", phase="A", rated_current=32.0, max_current=40.0),
        CircuitConfig(id="A2", name="侧舞台灯光", phase="A", rated_current=32.0, max_current=40.0),
        CircuitConfig(id="B1", name="音响系统", phase="B", rated_current=32.0, max_current=40.0),
        CircuitConfig(id="B2", name="视频系统", phase="B", rated_current=32.0, max_current=40.0),
        CircuitConfig(id="C1", name="机械系统", phase="C", rated_current=32.0, max_current=40.0),
        CircuitConfig(id="C2", name="备用回路", phase="C", rated_current=32.0, max_current=40.0),
    ]
    return ProjectConfig(
        project_name=project_name,
        show_name="",
        date="",
        circuits=default_circuits,
    )
