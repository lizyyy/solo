import json
import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional, Dict, Any
import yaml


DEFAULT_CONFIG_NAME = ".cqc_config.yaml"
DEFAULT_DATA_DIR = ".cqc_data"


@dataclass
class ProjectConfig:
    project_name: str = "未命名项目"
    language: str = "zh"
    
    clustering: Dict[str, Any] = field(default_factory=lambda: {
        "method": "tfidf",
        "similarity_threshold": 0.6,
        "min_cluster_size": 2,
        "max_features": 10000,
        "ngram_range": (1, 2),
    })
    
    chapter_matching: Dict[str, Any] = field(default_factory=lambda: {
        "time_tolerance_seconds": 300,
    })
    
    storage: Dict[str, Any] = field(default_factory=lambda: {
        "raw_data_dir": "raw",
        "processed_data_dir": "processed",
        "clusters_dir": "clusters",
        "reviews_dir": "reviews",
        "reports_dir": "reports",
    })


def find_project_root(start_path: Path) -> Optional[Path]:
    current = start_path.resolve()
    while current.parent != current:
        config_file = current / DEFAULT_CONFIG_NAME
        if config_file.exists():
            return current
        current = current.parent
    return None


def load_config(project_root: Path) -> ProjectConfig:
    config_file = project_root / DEFAULT_CONFIG_NAME
    if not config_file.exists():
        return ProjectConfig()
    
    with open(config_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    
    return ProjectConfig(
        project_name=data.get("project_name", "未命名项目"),
        language=data.get("language", "zh"),
        clustering=data.get("clustering", ProjectConfig().clustering),
        chapter_matching=data.get("chapter_matching", ProjectConfig().chapter_matching),
        storage=data.get("storage", ProjectConfig().storage),
    )


def save_config(project_root: Path, config: ProjectConfig) -> None:
    config_file = project_root / DEFAULT_CONFIG_NAME
    with open(config_file, "w", encoding="utf-8") as f:
        yaml.dump(asdict(config), f, default_flow_style=False, allow_unicode=True)


def get_data_path(project_root: Path, config: ProjectConfig, subdir: str) -> Path:
    data_dir = project_root / DEFAULT_DATA_DIR
    subdir_key = subdir.rstrip("s") + "s_dir"
    subdir_name = config.storage.get(subdir_key, subdir)
    full_path = data_dir / subdir_name
    full_path.mkdir(parents=True, exist_ok=True)
    return full_path
