import os
from pathlib import Path


class Config:
    APP_NAME = "perf-trainer"
    APP_VERSION = "0.1.0"
    
    # 数据库配置
    DB_FILENAME = "perf_trainer.db"
    
    # 默认数据目录
    DEFAULT_DATA_DIR = Path.home() / ".perf_trainer"
    
    # Incident 文件配置
    INCIDENT_FILENAME = "incident.yaml"
    
    # 采样文件目录名
    SAMPLES_DIR = "samples"
    
    # 支持的导出格式
    SUPPORTED_EXPORT_FORMATS = ["markdown", "json"]
    
    # 排障阶段
    TROUBLESHOOTING_STAGES = [
        "cpu", 
        "io", 
        "network", 
        "syscall", 
        "hot_function"
    ]
    
    @classmethod
    def get_db_path(cls, data_dir: Path = None) -> Path:
        if data_dir is None:
            data_dir = cls.DEFAULT_DATA_DIR
        return data_dir / cls.DB_FILENAME
    
    @classmethod
    def ensure_data_dir(cls, data_dir: Path = None) -> Path:
        if data_dir is None:
            data_dir = cls.DEFAULT_DATA_DIR
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir
