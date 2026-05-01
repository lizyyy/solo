"""配置模型"""

from datetime import time
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings


class ProjectConfig(BaseModel):
    """项目配置模型"""

    project_name: str = Field(default="应急演练频率管理", description="项目名称")
    exercise_name: str = Field(default="未命名演练", description="演练名称")
    exercise_date: Optional[str] = Field(default=None, description="演练日期 (YYYY-MM-DD)")
    timezone: str = Field(default="Asia/Shanghai", description="时区")
    max_power_watts: float = Field(default=25.0, description="最大允许功率 (瓦)")
    min_frequency_mhz: float = Field(default=144.0, description="最小频率 (MHz)")
    max_frequency_mhz: float = Field(default=148.0, description="最大频率 (MHz)")
    call_sign_pattern: str = Field(
        default=r"^[A-Z0-9]+/[A-Z0-9]+$|^[A-Z]{1,2}[0-9][A-Z]{1,4}$",
        description="呼号正则表达式",
    )
    data_dir: Path = Field(default=Path("./data"), description="数据目录")
    output_dir: Path = Field(default=Path("./output"), description="输出目录")
    quarantine_file: Path = Field(default=Path("./quarantine.json"), description="隔离文件路径")
    review_file: Path = Field(default=Path("./review.json"), description="复核记录文件路径")

    @field_validator("data_dir", "output_dir", "quarantine_file", "review_file")
    @classmethod
    def resolve_path(cls, v: Path) -> Path:
        """解析路径为绝对路径"""
        return v.resolve()

    class Config:
        validate_assignment = True


class FrequencyGuardianConfig(BaseSettings):
    """全局配置"""

    default_project_config: ProjectConfig = Field(default_factory=ProjectConfig)
    config_file_name: str = Field(default=".frequency-guardian.json", description="项目配置文件名")

    class Config:
        env_prefix = "FG_"
        case_sensitive = False
