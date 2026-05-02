import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import ProjectConfig, ProjectData


PROJECT_DIR_NAME = ".dmx-patch"
DATA_FILE_NAME = "project.json"
HISTORY_DIR_NAME = "history"


class ConfigManager:
    def __init__(self, working_dir: Optional[str] = None):
        self.working_dir = Path(working_dir) if working_dir else Path.cwd()
        self.project_dir = self.working_dir / PROJECT_DIR_NAME
        self.data_file = self.project_dir / DATA_FILE_NAME
        self.history_dir = self.project_dir / HISTORY_DIR_NAME

    def is_initialized(self) -> bool:
        return self.project_dir.exists() and self.data_file.exists()

    def init_project(self, project_name: str = "DMX Patch Project", universe_count: int = 1) -> ProjectData:
        if self.is_initialized():
            raise RuntimeError(f"项目已存在于: {self.project_dir}")
        
        self.project_dir.mkdir(parents=True, exist_ok=True)
        self.history_dir.mkdir(parents=True, exist_ok=True)
        
        config = ProjectConfig(
            project_name=project_name,
            universe_count=universe_count,
        )
        
        project_data = ProjectData(
            config=config,
            fixtures=[],
            patch_entries=[],
            fixture_libraries=[],
            history=[],
        )
        
        self.save_project(project_data)
        return project_data

    def load_project(self) -> ProjectData:
        if not self.is_initialized():
            raise RuntimeError(f"未找到项目，请先运行 'init' 命令。期望位置: {self.project_dir}")
        
        with open(self.data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return ProjectData(**data)

    def save_project(self, project_data: ProjectData) -> None:
        if not self.project_dir.exists():
            self.project_dir.mkdir(parents=True, exist_ok=True)
        
        project_data.config.modified_at = datetime.now()
        
        data_dict = project_data.model_dump()
        
        def datetime_to_str(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, dict):
                return {k: datetime_to_str(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [datetime_to_str(item) for item in obj]
            return obj
        
        data_dict = datetime_to_str(data_dict)
        
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(data_dict, f, ensure_ascii=False, indent=2)

    def update_config(self, **kwargs) -> ProjectData:
        project = self.load_project()
        for key, value in kwargs.items():
            if hasattr(project.config, key):
                setattr(project.config, key, value)
        self.save_project(project)
        return project

    def generate_id(self) -> str:
        return str(uuid.uuid4())[:8]

    def get_project_path(self) -> Path:
        return self.project_dir

    def get_history_path(self) -> Path:
        return self.history_dir
