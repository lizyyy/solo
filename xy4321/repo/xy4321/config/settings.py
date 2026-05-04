import os
import json
import platform
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from enum import Enum


class StorageLocation(Enum):
    PROJECT_FOLDER = "project_folder"
    USER_DATA = "user_data"
    CUSTOM = "custom"


@dataclass
class AppSettings:
    db_storage_location: str = StorageLocation.USER_DATA.value
    custom_db_path: str = ""
    recent_projects: List[str] = None
    default_sample_rate: int = 48000
    default_channels: int = 2
    max_silence_seconds: float = 10.0
    silence_threshold_db: float = -50.0
    theme: str = "light"
    language: str = "zh_CN"
    auto_scan_on_open: bool = True
    auto_validate_on_scan: bool = True
    
    def __post_init__(self):
        if self.recent_projects is None:
            self.recent_projects = []


class SettingsManager:
    _instance = None
    _settings: AppSettings = None
    _config_file: Optional[Path] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._settings is None:
            self._config_file = self._get_config_file_path(create_dir=False)
            self._load_settings()
    
    def _get_config_file_path(self, create_dir: bool = True) -> Path:
        system = platform.system()
        
        if system == "Windows":
            config_dir = Path(os.environ.get("APPDATA", "")) / "MultiTrackDelivery"
        elif system == "Darwin":
            config_dir = Path.home() / "Library" / "Application Support" / "MultiTrackDelivery"
        else:
            config_dir = Path.home() / ".config" / "multitrackdelivery"
        
        if create_dir:
            try:
                config_dir.mkdir(parents=True, exist_ok=True)
            except (OSError, PermissionError):
                pass
        
        return config_dir / "settings.json"
    
    def _load_settings(self):
        try:
            if self._config_file and self._config_file.exists():
                with open(self._config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._settings = AppSettings(**data)
            else:
                self._settings = AppSettings()
        except Exception as e:
            print(f"加载配置失败: {e}")
            self._settings = AppSettings()
    
    def _ensure_config_dir(self) -> bool:
        try:
            if self._config_file:
                self._config_file.parent.mkdir(parents=True, exist_ok=True)
                return True
        except (OSError, PermissionError) as e:
            print(f"无法创建配置目录: {e}")
        return False
    
    def _save_settings(self) -> bool:
        try:
            if not self._ensure_config_dir():
                return False
            
            if self._config_file:
                with open(self._config_file, "w", encoding="utf-8") as f:
                    json.dump(asdict(self._settings), f, indent=2, ensure_ascii=False)
                return True
        except Exception as e:
            print(f"保存配置失败: {e}")
        return False
    
    def get_settings(self) -> AppSettings:
        return self._settings
    
    def update_settings(self, updates: Dict[str, Any]) -> bool:
        try:
            for key, value in updates.items():
                if hasattr(self._settings, key):
                    setattr(self._settings, key, value)
            return self._save_settings()
        except Exception as e:
            print(f"更新配置失败: {e}")
            return False
    
    def get_db_path(self, project_folder: str = None) -> str:
        location = self._settings.db_storage_location
        
        if location == StorageLocation.PROJECT_FOLDER.value:
            if project_folder:
                return str(Path(project_folder) / ".mtd_delivery" / "data.db")
            else:
                return self._get_default_db_path()
        
        elif location == StorageLocation.CUSTOM.value:
            if self._settings.custom_db_path:
                return self._settings.custom_db_path
            else:
                return self._get_default_db_path()
        
        else:
            return self._get_default_db_path()
    
    def _get_default_db_path(self) -> str:
        system = platform.system()
        
        if system == "Windows":
            data_dir = Path(os.environ.get("APPDATA", "")) / "MultiTrackDelivery" / "data"
        elif system == "Darwin":
            data_dir = Path.home() / "Library" / "Application Support" / "MultiTrackDelivery" / "data"
        else:
            data_dir = Path.home() / ".local" / "share" / "multitrackdelivery"
        
        try:
            data_dir.mkdir(parents=True, exist_ok=True)
        except (OSError, PermissionError):
            pass
        
        return str(data_dir / "multitrack.db")
    
    def add_recent_project(self, folder_path: str):
        folder_path = str(Path(folder_path).resolve())
        
        if folder_path in self._settings.recent_projects:
            self._settings.recent_projects.remove(folder_path)
        
        self._settings.recent_projects.insert(0, folder_path)
        
        if len(self._settings.recent_projects) > 10:
            self._settings.recent_projects = self._settings.recent_projects[:10]
        
        self._save_settings()
    
    def remove_recent_project(self, folder_path: str):
        folder_path = str(Path(folder_path).resolve())
        
        if folder_path in self._settings.recent_projects:
            self._settings.recent_projects.remove(folder_path)
            self._save_settings()
    
    def get_recent_projects(self) -> List[str]:
        valid_projects = []
        to_remove = []
        
        for path in self._settings.recent_projects:
            if Path(path).exists():
                valid_projects.append(path)
            else:
                to_remove.append(path)
        
        for path in to_remove:
            self._settings.recent_projects.remove(path)
        
        if to_remove:
            self._save_settings()
        
        return valid_projects


settings_manager = SettingsManager()
