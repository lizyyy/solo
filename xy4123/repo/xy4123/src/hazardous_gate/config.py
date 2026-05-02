from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "危化品领用闸门"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATABASE_URL: str = Field(default="sqlite:///./hazardous_gate.db")
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"

    ENVIRONMENT: Literal["development", "testing", "production"] = "development"

    # 危化品相关配置
    MAX_LEAD_TIME_DAYS: int = 30  # 最长领用有效期
    MIN_WASTE_VOLUME_THRESHOLD: float = 100.0  # 最小废液回收阈值(ml)

    # 危险等级
    HAZARD_LEVELS: dict[str, int] = {
        "低危": 1,
        "中危": 2,
        "高危": 3,
        "剧毒": 4,
    }

    # 相容分组定义 - 同组不可同车
    INCOMPATIBLE_GROUPS: dict[str, list[str]] = {
        "酸类": ["碱类", "氧化剂", "金属"],
        "碱类": ["酸类", "氧化剂", "有机物"],
        "氧化剂": ["酸类", "碱类", "还原剂", "有机物"],
        "还原剂": ["氧化剂", "酸类"],
        "有机物": ["氧化剂", "碱类", "酸类"],
        "金属": ["酸类", "氧化剂"],
        "氰化物": ["酸类", "氧化剂"],
        "易燃物": ["氧化剂", "酸类", "碱类"],
    }

    # 有效浓度单位
    VALID_CONCENTRATION_UNITS: set[str] = {
        "%",
        "mol/L",
        "M",
        "mM",
        "g/L",
        "mg/mL",
        "μg/mL",
        "ppm",
        "ppb",
    }

    # 有效储柜分类
    VALID_CABINET_TYPES: set[str] = {
        "酸柜",
        "碱柜",
        "氧化剂柜",
        "易燃品柜",
        "毒品柜",
        "通用柜",
        "防爆柜",
        "冷藏柜",
    }

    # 废液去向选项
    VALID_WASTE_DESTINATIONS: set[str] = {
        "酸性废液桶",
        "碱性废液桶",
        "有机废液桶",
        "含卤废液桶",
        "重金属废液桶",
        "氰化物废液桶",
        "统一回收处理",
        "安全中和排放",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
