import json
import os
from pathlib import Path
from typing import Optional
from datetime import datetime

from rov_tension_checker.config.models import ProjectConfig


class ConfigManager:
    CONFIG_FILE_NAME = "rov_config.json"
    
    def __init__(self, working_dir: Optional[str] = None):
        self.working_dir = Path(working_dir) if working_dir else Path.cwd()
        self.config_path = self.working_dir / self.CONFIG_FILE_NAME
    
    def init_config(self, project_name: str, pipeline_id: str) -> ProjectConfig:
        from rov_tension_checker.config.models import (
            CableSpec, ROVSpec, CurrentLayer, RiskThresholds
        )
        
        default_cable = CableSpec(
            name="标准脐带缆 19mm",
            diameter=0.019,
            weight_in_air=15.7,
            weight_in_water=8.5,
            max_allowable_tension=45000,
            min_bending_radius=0.285,
            safety_factor=1.5
        )
        
        default_rov = ROVSpec(
            name="Work-class ROV",
            weight_in_air=45000,
            weight_in_water=-2000,
            maximum_thrust_horizontal=12000,
            maximum_thrust_vertical=8000
        )
        
        default_current = CurrentLayer(
            depth_from=0,
            depth_to=100,
            speed=0.5,
            direction=90
        )
        
        config = ProjectConfig(
            project_name=project_name,
            pipeline_id=pipeline_id,
            survey_date=datetime.now(),
            cable_spec=default_cable,
            rov_spec=default_rov,
            current_layers=[default_current],
            protection_frames=[],
            risk_thresholds=RiskThresholds()
        )
        
        self.save_config(config)
        self._ensure_directories(config)
        
        return config
    
    def load_config(self) -> ProjectConfig:
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"配置文件不存在: {self.config_path}\n"
                f"请先运行 'rov-tension init' 命令初始化项目"
            )
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'survey_date' in data and isinstance(data['survey_date'], str):
            data['survey_date'] = datetime.fromisoformat(data['survey_date'])
        
        return ProjectConfig(**data)
    
    def save_config(self, config: ProjectConfig) -> None:
        self.working_dir.mkdir(parents=True, exist_ok=True)
        
        config_dict = config.model_dump()
        if 'survey_date' in config_dict and isinstance(config_dict['survey_date'], datetime):
            config_dict['survey_date'] = config_dict['survey_date'].isoformat()
        
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, ensure_ascii=False, indent=2)
        
        self._ensure_directories(config)
    
    def _ensure_directories(self, config: ProjectConfig) -> None:
        (self.working_dir / config.output_directory).mkdir(parents=True, exist_ok=True)
        (self.working_dir / config.quarantine_directory).mkdir(parents=True, exist_ok=True)
        (self.working_dir / config.data_directory).mkdir(parents=True, exist_ok=True)
    
    def config_exists(self) -> bool:
        return self.config_path.exists()
    
    def get_data_path(self, config: ProjectConfig, filename: str) -> Path:
        return self.working_dir / config.data_directory / filename
    
    def get_output_path(self, config: ProjectConfig, filename: str) -> Path:
        return self.working_dir / config.output_directory / filename
    
    def get_quarantine_path(self, config: ProjectConfig, filename: str) -> Path:
        return self.working_dir / config.quarantine_directory / filename
