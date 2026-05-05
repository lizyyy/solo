from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "海上风电运维AI初筛工具"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # 数据库配置
    DATABASE_URL: str = "sqlite:///./wind_power.db"
    
    # 文件存储配置
    UPLOAD_DIR: str = "./uploads"
    EXPORT_DIR: str = "./exports"
    
    # 图像特征提取配置
    FEATURE_EXTRACTOR_MODEL: str = "simple"  # 简单特征提取，后续可扩展
    
    # 风险评分配置
    CRITICAL_RISK_THRESHOLD: float = 0.8
    HIGH_RISK_THRESHOLD: float = 0.6
    MEDIUM_RISK_THRESHOLD: float = 0.3
    
    class Config:
        env_file = ".env"


settings = Settings()

# 确保目录存在
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.EXPORT_DIR).mkdir(parents=True, exist_ok=True)
