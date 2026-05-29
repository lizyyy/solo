import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/ci_cache_pollution.db")

STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

REPORT_EXPORT_DIR = STORAGE_DIR / "exports"
REPORT_EXPORT_DIR.mkdir(exist_ok=True)

MATERIAL_STORAGE_DIR = STORAGE_DIR / "materials"
MATERIAL_STORAGE_DIR.mkdir(exist_ok=True)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

MATERIAL_TYPES = {
    "pipeline_log": "流水线日志",
    "dependency_cache": "依赖缓存",
    "test_report": "测试报告",
    "commit_hash": "提交哈希",
    "env_vars": "环境变量",
    "analysis_report": "定位报告",
}

ANOMALY_TYPES = {
    "cache_miss_error": "缓存命中错误",
    "test_artifact_leftover": "测试产物未清",
    "env_var_drift": "环境变量漂移",
    "dependency_conflict": "依赖冲突",
    "unknown": "未知异常",
}
