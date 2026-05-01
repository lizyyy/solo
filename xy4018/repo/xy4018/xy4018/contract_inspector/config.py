"""
配置模块
"""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_TASKS_DIR = DEFAULT_DATA_DIR / "tasks"
DEFAULT_RULES_DIR = DEFAULT_DATA_DIR / "rules"
DEFAULT_EXPORTS_DIR = DEFAULT_DATA_DIR / "exports"
DEFAULT_UPLOADS_DIR = DEFAULT_DATA_DIR / "uploads"

def ensure_data_dirs():
    """确保数据目录存在"""
    for dir_path in [DEFAULT_DATA_DIR, DEFAULT_TASKS_DIR, DEFAULT_RULES_DIR, DEFAULT_EXPORTS_DIR, DEFAULT_UPLOADS_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
