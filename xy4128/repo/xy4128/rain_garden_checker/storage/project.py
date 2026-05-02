import json
import uuid
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml

from rain_garden_checker.models.data_models import (
    ProjectConfig,
    RainfallSeries,
    SoilInfiltrationTest,
    CatchmentArea,
    PondGeometry,
    SimulationConfig,
    SimulationResult,
    CheckReport,
    FullReport,
    InfiltrationModel,
    TimeUnit,
    LengthUnit,
    AreaUnit,
)


PROJECT_CONFIG_FILE = "project.yaml"
DATA_DIR = "data"
RESULTS_DIR = "results"
REPORTS_DIR = "reports"
EXAMPLES_DIR = "examples"

RAINFALL_SUBDIR = "rainfall"
SOIL_SUBDIR = "soil"
CATCHMENT_SUBDIR = "catchment"
POND_SUBDIR = "pond"


class ProjectManager:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.config: Optional[ProjectConfig] = None
        self.rainfall_series: Dict[str, RainfallSeries] = {}
        self.soil_tests: Dict[str, SoilInfiltrationTest] = {}
        self.catchments: List[CatchmentArea] = []
        self.pond: Optional[PondGeometry] = None
        self.simulation_results: List[SimulationResult] = []
        self.check_report: Optional[CheckReport] = None

    def _get_path(self, *parts: str) -> Path:
        return self.project_root.joinpath(*parts)

    def _ensure_dir(self, path: Path):
        path.mkdir(parents=True, exist_ok=True)

    def init_project(
        self,
        project_name: str,
        description: Optional[str] = None,
        create_examples: bool = True,
    ) -> ProjectConfig:
        self._ensure_dir(self.project_root)
        self._ensure_dir(self._get_path(DATA_DIR, RAINFALL_SUBDIR))
        self._ensure_dir(self._get_path(DATA_DIR, SOIL_SUBDIR))
        self._ensure_dir(self._get_path(DATA_DIR, CATCHMENT_SUBDIR))
        self._ensure_dir(self._get_path(DATA_DIR, POND_SUBDIR))
        self._ensure_dir(self._get_path(RESULTS_DIR))
        self._ensure_dir(self._get_path(REPORTS_DIR))

        project_id = str(uuid.uuid4())[:8]

        self.config = ProjectConfig(
            project_name=project_name,
            project_id=project_id,
            description=description,
            simulation_config=SimulationConfig(),
        )

        self.save_config()

        if create_examples:
            self._create_example_files()

        return self.config

    def _create_example_files(self):
        examples_dir = self._get_path(EXAMPLES_DIR)
        self._ensure_dir(examples_dir)

        rainfall_example = """time,intensity
0,0
5,2
10,5
15,12
20,18
25,25
30,28
35,25
40,20
45,15
50,10
55,6
60,3
65,1
70,0
"""
        (examples_dir / "rainfall_5y.csv").write_text(rainfall_example, encoding="utf-8")

        rainfall_10y = """time,intensity
0,0
5,3
10,8
15,15
20,25
25,35
30,40
35,38
40,30
45,22
50,15
55,10
60,6
65,3
70,1
75,0
"""
        (examples_dir / "rainfall_10y.csv").write_text(rainfall_10y, encoding="utf-8")

        soil_example = """soil_type,saturated_hydraulic_conductivity,initial_moisture,saturated_moisture,suction_head
sandy_loam,15,0.2,0.45,10
"""
        (examples_dir / "soil_test.csv").write_text(soil_example, encoding="utf-8")

        catchment_example = """name,area,runoff_coefficient,land_use_type,impervious_ratio
rooftop,500,0.85,building,0.95
parking,800,0.8,pavement,0.9
lawn,1200,0.3,grass,0.1
"""
        (examples_dir / "catchment.csv").write_text(catchment_example, encoding="utf-8")

        pond_example = """name,surface_area,depth,underdrain_rate,shape_type
rain_garden_1,100,0.8,30,rectangular
"""
        (examples_dir / "pond.csv").write_text(pond_example, encoding="utf-8")

    def save_config(self):
        if not self.config:
            return

        config_dict = {
            "project_name": self.config.project_name,
            "project_id": self.config.project_id,
            "created_at": self.config.created_at.isoformat(),
            "updated_at": datetime.now().isoformat(),
            "description": self.config.description,
            "version": self.config.version,
            "simulation_config": {
                "infiltration_model": self.config.simulation_config.infiltration_model.value,
                "time_step": self.config.simulation_config.time_step,
                "time_unit": self.config.simulation_config.time_unit.value,
                "max_drain_hours": self.config.simulation_config.max_drain_hours,
                "enable_underdrain": self.config.simulation_config.enable_underdrain,
                "routing_method": self.config.simulation_config.routing_method,
            },
        }

        config_path = self._get_path(PROJECT_CONFIG_FILE)
        with open(config_path, "w", encoding="utf-8") as f:
            yaml.dump(config_dict, f, allow_unicode=True, sort_keys=False)

    def load_config(self) -> Optional[ProjectConfig]:
        config_path = self._get_path(PROJECT_CONFIG_FILE)
        if not config_path.exists():
            return None

        with open(config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        sim_config = data.get("simulation_config", {})

        self.config = ProjectConfig(
            project_name=data.get("project_name", "Unnamed"),
            project_id=data.get("project_id", ""),
            created_at=(
                datetime.fromisoformat(data["created_at"])
                if "created_at" in data
                else datetime.now()
            ),
            updated_at=(
                datetime.fromisoformat(data["updated_at"])
                if "updated_at" in data
                else datetime.now()
            ),
            description=data.get("description"),
            version=data.get("version", "0.1.0"),
            simulation_config=SimulationConfig(
                infiltration_model=InfiltrationModel(
                    sim_config.get("infiltration_model", "horton")
                ),
                time_step=sim_config.get("time_step", 5.0),
                time_unit=TimeUnit(sim_config.get("time_unit", "min")),
                max_drain_hours=sim_config.get("max_drain_hours", 72.0),
                enable_underdrain=sim_config.get("enable_underdrain", True),
                routing_method=sim_config.get("routing_method", "kinematic"),
            ),
        )

        return self.config

    def is_project_initialized(self) -> bool:
        return self._get_path(PROJECT_CONFIG_FILE).exists()

    def get_sim_config(self) -> SimulationConfig:
        if self.config:
            return self.config.simulation_config
        return SimulationConfig()

    def update_sim_config(self, **kwargs):
        if not self.config:
            return

        for key, value in kwargs.items():
            if hasattr(self.config.simulation_config, key):
                setattr(self.config.simulation_config, key, value)

        self.save_config()

    def save_result(self, result: SimulationResult, name: Optional[str] = None):
        safe_name = name or result.rainfall_name.replace(" ", "_")
        result_path = self._get_path(RESULTS_DIR, f"{safe_name}.json")

        result_dict = self._result_to_dict(result)

        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(result_dict, f, indent=2, ensure_ascii=False, default=str)

        self.simulation_results.append(result)

    def _result_to_dict(self, result: SimulationResult) -> Dict[str, Any]:
        return {
            "rainfall_name": result.rainfall_name,
            "return_period": result.return_period,
            "config": {
                "infiltration_model": result.config.infiltration_model.value,
                "time_step": result.config.time_step,
                "time_unit": result.config.time_unit.value,
                "max_drain_hours": result.config.max_drain_hours,
                "enable_underdrain": result.config.enable_underdrain,
                "routing_method": result.config.routing_method,
            },
            "summary": {
                "total_runoff_volume": result.total_runoff_volume,
                "total_infiltration_volume": result.total_infiltration_volume,
                "total_overflow_volume": result.total_overflow_volume,
                "peak_pond_level": result.peak_pond_level,
                "peak_storage": result.peak_storage,
                "drain_time_hours": result.drain_time_hours,
                "has_overflow": result.has_overflow,
            },
            "time_series": [
                {
                    "time": step.time,
                    "rainfall_intensity": step.rainfall_intensity,
                    "runoff_inflow": step.runoff_inflow,
                    "infiltration_rate": step.infiltration_rate,
                    "pond_level": step.pond_level,
                    "storage_volume": step.storage_volume,
                    "overflow_rate": step.overflow_rate,
                    "underdrain_rate": step.underdrain_rate,
                    "cumulative_infiltration": step.cumulative_infiltration,
                    "cumulative_overflow": step.cumulative_overflow,
                }
                for step in result.time_series
            ],
        }

    def save_check_report(self, report: CheckReport):
        report_path = self._get_path(RESULTS_DIR, "check_report.json")

        report_dict = {
            "project_id": report.project_id,
            "checked_at": report.checked_at.isoformat(),
            "has_critical": report.has_critical,
            "has_warnings": report.has_warnings,
            "warnings": [
                {
                    "level": w.level.value,
                    "warning_type": w.warning_type.value,
                    "message": w.message,
                    "field": w.field,
                    "value": w.value,
                    "suggestion": w.suggestion,
                }
                for w in report.warnings
            ],
        }

        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, indent=2, ensure_ascii=False, default=str)

        self.check_report = report

    def list_rainfall_files(self) -> List[Path]:
        rainfall_dir = self._get_path(DATA_DIR, RAINFALL_SUBDIR)
        if not rainfall_dir.exists():
            return []
        return sorted(rainfall_dir.glob("*.csv"))

    def list_soil_files(self) -> List[Path]:
        soil_dir = self._get_path(DATA_DIR, SOIL_SUBDIR)
        if not soil_dir.exists():
            return []
        return sorted(soil_dir.glob("*.csv"))

    def list_catchment_files(self) -> List[Path]:
        catchment_dir = self._get_path(DATA_DIR, CATCHMENT_SUBDIR)
        if not catchment_dir.exists():
            return []
        return sorted(catchment_dir.glob("*.csv"))

    def list_pond_files(self) -> List[Path]:
        pond_dir = self._get_path(DATA_DIR, POND_SUBDIR)
        if not pond_dir.exists():
            return []
        return sorted(pond_dir.glob("*.csv"))

    def import_rainfall(self, source_path: Path, name: str, return_period: float) -> bool:
        if not source_path.exists():
            return False

        rainfall_dir = self._get_path(DATA_DIR, RAINFALL_SUBDIR)
        self._ensure_dir(rainfall_dir)

        safe_name = name.replace(" ", "_").lower()
        dest_path = rainfall_dir / f"{safe_name}_{return_period}y.csv"

        shutil.copy2(source_path, dest_path)
        return True

    def import_soil(self, source_path: Path, test_id: str) -> bool:
        if not source_path.exists():
            return False

        soil_dir = self._get_path(DATA_DIR, SOIL_SUBDIR)
        self._ensure_dir(soil_dir)

        safe_id = test_id.replace(" ", "_").lower()
        dest_path = soil_dir / f"{safe_id}.csv"

        shutil.copy2(source_path, dest_path)
        return True

    def import_catchment(self, source_path: Path) -> bool:
        if not source_path.exists():
            return False

        catchment_dir = self._get_path(DATA_DIR, CATCHMENT_SUBDIR)
        self._ensure_dir(catchment_dir)

        dest_path = catchment_dir / "catchment.csv"
        if dest_path.exists():
            dest_path = catchment_dir / f"catchment_{datetime.now().strftime('%Y%m%d')}.csv"

        shutil.copy2(source_path, dest_path)
        return True

    def import_pond(self, source_path: Path) -> bool:
        if not source_path.exists():
            return False

        pond_dir = self._get_path(DATA_DIR, POND_SUBDIR)
        self._ensure_dir(pond_dir)

        dest_path = pond_dir / "pond.csv"
        if dest_path.exists():
            dest_path = pond_dir / f"pond_{datetime.now().strftime('%Y%m%d')}.csv"

        shutil.copy2(source_path, dest_path)
        return True

    def get_reports_dir(self) -> Path:
        return self._get_path(REPORTS_DIR)

    def get_results_dir(self) -> Path:
        return self._get_path(RESULTS_DIR)

    def get_examples_dir(self) -> Path:
        return self._get_path(EXAMPLES_DIR)
