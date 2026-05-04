import os
import yaml
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict


@dataclass
class BackupTask:
    name: str
    source_dir: str
    target_dir: str
    retention_days: int = 0
    enabled: bool = True
    extensions: Optional[List[str]] = None
    
    def validate(self) -> List[str]:
        errors = []
        
        if not self.name:
            errors.append("Task name cannot be empty")
        
        if not self.source_dir:
            errors.append(f"Task '{self.name}': source_dir cannot be empty")
        elif not os.path.isdir(self.source_dir):
            errors.append(f"Task '{self.name}': source_dir does not exist: {self.source_dir}")
        
        if not self.target_dir:
            errors.append(f"Task '{self.name}': target_dir cannot be empty")
        elif not os.path.isdir(self.target_dir):
            errors.append(f"Task '{self.name}': target_dir does not exist: {self.target_dir}")
        
        if self.retention_days < 0:
            errors.append(f"Task '{self.name}': retention_days cannot be negative")
        
        return errors


@dataclass
class AppConfig:
    tasks: List[BackupTask]
    db_path: str = "backup_checker.db"
    reports_dir: str = "reports"
    hash_type: str = "md5"
    parallel: bool = True
    max_workers: int = 4
    
    def validate(self) -> List[str]:
        errors = []
        
        task_names = set()
        for task in self.tasks:
            if task.name in task_names:
                errors.append(f"Duplicate task name: {task.name}")
            task_names.add(task.name)
            errors.extend(task.validate())
        
        return errors


def load_config(config_path: str) -> AppConfig:
    config_path = os.path.abspath(config_path)
    
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    
    tasks_data = data.get('tasks', [])
    tasks = []
    
    for task_data in tasks_data:
        task = BackupTask(
            name=task_data.get('name', ''),
            source_dir=os.path.expanduser(task_data.get('source_dir', '')),
            target_dir=os.path.expanduser(task_data.get('target_dir', '')),
            retention_days=task_data.get('retention_days', 0),
            enabled=task_data.get('enabled', True),
            extensions=task_data.get('extensions'),
        )
        tasks.append(task)
    
    app_config = AppConfig(
        tasks=tasks,
        db_path=data.get('db_path', 'backup_checker.db'),
        reports_dir=data.get('reports_dir', 'reports'),
        hash_type=data.get('hash_type', 'md5'),
        parallel=data.get('parallel', True),
        max_workers=data.get('max_workers', 4),
    )
    
    return app_config


def generate_sample_config() -> str:
    sample = {
        'db_path': 'backup_checker.db',
        'reports_dir': 'reports',
        'hash_type': 'md5',
        'parallel': True,
        'max_workers': 4,
        'tasks': [
            {
                'name': 'family_photos_to_nas',
                'source_dir': '~/Photos/Family',
                'target_dir': '/Volumes/NAS/Backup/FamilyPhotos',
                'retention_days': 90,
                'enabled': True,
            },
            {
                'name': 'travel_photos_to_external',
                'source_dir': '~/Photos/Travel',
                'target_dir': '/Volumes/ExternalHD/Backup/TravelPhotos',
                'retention_days': 0,
                'enabled': True,
                'extensions': ['.jpg', '.jpeg', '.png', '.raw'],
            }
        ]
    }
    
    return yaml.dump(sample, default_flow_style=False, allow_unicode=True)
