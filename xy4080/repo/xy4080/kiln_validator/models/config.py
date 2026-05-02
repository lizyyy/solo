"""窑炉配置数据模型"""

from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field

DEFAULT_MAX_RAMP_RATE_C_PER_HOUR = 150.0
DEFAULT_GLAZE_TEMPERATURE_TOLERANCE = 15.0
DEFAULT_THERMAL_CONDUCTIVITY_CLAY = 0.8
DEFAULT_KILN_VOLUME_LITERS = 100.0
DEFAULT_TIME_STEP_MINUTES = 1


class KilnConfig(BaseModel):
    """窑炉配置参数 - 影响热计算和校验规则"""

    max_ramp_rate_c_per_hour: float = Field(
        default=DEFAULT_MAX_RAMP_RATE_C_PER_HOUR,
        description="最大允许升温速率 (°C/小时)，超过此值可能导致炸坯",
        ge=10.0,
    )

    glaze_temperature_tolerance: float = Field(
        default=DEFAULT_GLAZE_TEMPERATURE_TOLERANCE,
        description="釉料成熟温区容差 (°C)",
        ge=1.0,
    )

    thermal_conductivity_clay: float = Field(
        default=DEFAULT_THERMAL_CONDUCTIVITY_CLAY,
        description="粘土热传导系数 (W/m·K)",
        gt=0.0,
    )

    kiln_volume_liters: float = Field(
        default=DEFAULT_KILN_VOLUME_LITERS,
        description="窑炉容积 (升)",
        gt=0.0,
    )

    time_step_minutes: int = Field(
        default=DEFAULT_TIME_STEP_MINUTES,
        description="热模拟时间步长 (分钟)",
        ge=1,
    )

    probe_drift_threshold_c: float = Field(
        default=20.0,
        description="探头漂移阈值 (°C)，超过此值标记探头异常",
        ge=5.0,
    )

    thickness_warning_threshold_cm: float = Field(
        default=2.5,
        description="坯体厚度警告阈值 (厘米)，超过此值需要特殊处理",
        gt=0.0,
    )

    thickness_critical_threshold_cm: float = Field(
        default=4.0,
        description="坯体厚度临界阈值 (厘米)，超过此值极高风险",
        gt=0.0,
    )

    @classmethod
    def from_file(cls, path: Path) -> "KilnConfig":
        """从JSON文件加载配置"""
        import json

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls(**data)

    def to_file(self, path: Path) -> None:
        """保存配置到JSON文件"""
        import json

        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.model_dump(), f, indent=2, ensure_ascii=False)

    @classmethod
    def create_default(cls) -> "KilnConfig":
        """创建默认配置"""
        return cls()
