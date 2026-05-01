"""
配置模块 - 管理项目配置、默认单位、移液体积范围等
"""

from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel, Field


class PlateConfig(BaseModel):
    rows: int = 8
    cols: int = 12
    row_labels: List[str] = Field(default_factory=lambda: ["A", "B", "C", "D", "E", "F", "G", "H"])


class PipetteConfig(BaseModel):
    min_volume_ul: float = 0.5
    max_volume_ul: float = 1000.0
    dead_volume_ul: float = 10.0


class ReservedWell(BaseModel):
    well: str
    purpose: str


class ProjectConfig(BaseModel):
    version: str = "0.1.0"
    default_concentration_unit: str = "ng/ul"
    default_volume_unit: str = "ul"
    pipette: PipetteConfig = Field(default_factory=PipetteConfig)
    plate: PlateConfig = Field(default_factory=PlateConfig)
    reserved_wells: List[ReservedWell] = Field(default_factory=list)


DEFAULT_CONFIG = ProjectConfig(
    reserved_wells=[
        ReservedWell(well="A1", purpose="阴性对照"),
        ReservedWell(well="A2", purpose="阳性对照"),
        ReservedWell(well="A3", purpose="空白对照"),
    ]
)


def get_config_path(work_dir: Optional[Path] = None) -> Path:
    if work_dir is None:
        work_dir = Path.cwd()
    return work_dir / ".plate_planner" / "config.json"


def get_ledger_path(work_dir: Optional[Path] = None) -> Path:
    if work_dir is None:
        work_dir = Path.cwd()
    return work_dir / ".plate_planner" / "ledger.json"


def get_samples_path(work_dir: Optional[Path] = None) -> Path:
    if work_dir is None:
        work_dir = Path.cwd()
    return work_dir / ".plate_planner" / "samples.json"


def get_plans_path(work_dir: Optional[Path] = None) -> Path:
    if work_dir is None:
        work_dir = Path.cwd()
    return work_dir / ".plate_planner" / "plans.json"


def is_initialized(work_dir: Optional[Path] = None) -> bool:
    return get_config_path(work_dir).exists()


def save_config(config: ProjectConfig, work_dir: Optional[Path] = None):
    config_path = get_config_path(work_dir)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(config.model_dump_json(indent=2), encoding="utf-8")


def load_config(work_dir: Optional[Path] = None) -> ProjectConfig:
    config_path = get_config_path(work_dir)
    if not config_path.exists():
        return DEFAULT_CONFIG
    return ProjectConfig.model_validate_json(config_path.read_text(encoding="utf-8"))
