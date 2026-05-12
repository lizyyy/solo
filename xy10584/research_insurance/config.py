import os
from pathlib import Path


DEFAULT_WORKSPACE = '.research-insurance'
DB_NAME = 'insurance.db'
DATA_DIR_NAME = 'data'
EXPORT_DIR_NAME = 'exports'
HISTORY_DIR_NAME = 'history'


def get_workspace_path() -> Path:
    return Path.cwd() / DEFAULT_WORKSPACE


def get_db_path() -> Path:
    return get_workspace_path() / DB_NAME


def get_data_dir() -> Path:
    return get_workspace_path() / DATA_DIR_NAME


def get_export_dir() -> Path:
    return get_workspace_path() / EXPORT_DIR_NAME


def get_history_dir() -> Path:
    return get_workspace_path() / HISTORY_DIR_NAME


def ensure_dirs():
    get_data_dir().mkdir(parents=True, exist_ok=True)
    get_export_dir().mkdir(parents=True, exist_ok=True)
    get_history_dir().mkdir(parents=True, exist_ok=True)


def is_initialized() -> bool:
    return get_db_path().exists()
