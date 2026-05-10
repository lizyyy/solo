import os
from pathlib import Path

DEFAULT_CONFIG_DIR = Path.cwd() / ".subtitle-qc"
DEFAULT_DATA_DIR = DEFAULT_CONFIG_DIR / "data"
DEFAULT_REPORT_DIR = DEFAULT_CONFIG_DIR / "reports"
DEFAULT_DB_PATH = DEFAULT_CONFIG_DIR / "qc.db"

SUPPORTED_SUBTITLE_FORMATS = {".srt", ".vtt"}
SUPPORTED_DOC_FORMATS = {".txt", ".md", ".doc", ".docx"}


def get_config_dir():
    config_dir = os.environ.get("SUBTITLE_QC_CONFIG_DIR", str(DEFAULT_CONFIG_DIR))
    return Path(config_dir)


def get_data_dir():
    config_dir = get_config_dir()
    return config_dir / "data"


def get_report_dir():
    config_dir = get_config_dir()
    return config_dir / "reports"


def get_db_path():
    config_dir = get_config_dir()
    return config_dir / "qc.db"


def ensure_directories():
    get_config_dir().mkdir(parents=True, exist_ok=True)
    get_data_dir().mkdir(parents=True, exist_ok=True)
    get_report_dir().mkdir(parents=True, exist_ok=True)
