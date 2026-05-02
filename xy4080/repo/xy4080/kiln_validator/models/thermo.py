"""热计算数据模型"""

from typing import List, Optional

from pydantic import BaseModel, Field


class ProbeDataPoint(BaseModel):
    """实际探头数据点"""

    time_minutes: int = Field(description="时间 (分钟)")
    temperature_c: float = Field(description="探头测量温度 (°C)")
    probe_id: str = Field(default="main", description="探头ID")


class ThermoStep(BaseModel):
    """单次热模拟时间步结果"""

    step_index: int = Field(description="时间步索引")
    time_minutes: int = Field(description="累积时间 (分钟)")
    
    oven_temperature_c: float = Field(description="窑炉环境温度 (°C)")
    surface_temperature_c: float = Field(description="坯体表面温度 (°C)")
    core_temperature_c: float = Field(description="坯体中心温度 (°C)")
    
    delta_surface_core_c: float = Field(description="表面-中心温差 (°C)")
    delta_oven_surface_c: float = Field(description="窑炉-表面温差 (°C)")
    
    ramp_rate_instant_c_per_hour: Optional[float] = Field(
        default=None,
        description="瞬时升温速率 (°C/小时)",
    )
    
    segment_name: Optional[str] = Field(
        default=None,
        description="当前所属烧成段名称",
    )
    
    @property
    def max_internal_delta_c(self) -> float:
        """最大内部温差"""
        return abs(self.delta_surface_core_c)


class ThermoSimulationResult(BaseModel):
    """完整热模拟结果"""

    workpiece_thickness_cm: float = Field(description="模拟使用的坯体厚度 (厘米)")
    time_step_minutes: int = Field(description="时间步长 (分钟)")
    steps: List[ThermoStep] = Field(description="所有时间步结果")
    
    @property
    def total_steps(self) -> int:
        return len(self.steps)

    @property
    def total_minutes(self) -> int:
        """总模拟时长 (分钟)"""
        if not self.steps:
            return 0
        return self.steps[-1].time_minutes

    @property
    def max_internal_delta_c(self) -> float:
        """模拟过程中出现的最大内外温差"""
        if not self.steps:
            return 0.0
        return max(step.max_internal_delta_c for step in self.steps)

    @property
    def max_internal_delta_at_step(self) -> Optional[ThermoStep]:
        """最大温差出现的时间步"""
        if not self.steps:
            return None
        max_val = self.max_internal_delta_c
        for step in self.steps:
            if step.max_internal_delta_c == max_val:
                return step
        return None

    @property
    def peak_oven_temperature_c(self) -> float:
        """最高窑炉温度"""
        if not self.steps:
            return 0.0
        return max(step.oven_temperature_c for step in self.steps)

    def get_steps_in_time_range(self, start_minutes: int, end_minutes: int) -> List[ThermoStep]:
        """获取指定时间范围内的步骤"""
        return [
            step
            for step in self.steps
            if start_minutes <= step.time_minutes <= end_minutes
        ]

    def get_step_by_time(self, minutes: int) -> Optional[ThermoStep]:
        """按时间获取最近的步骤"""
        if not self.steps:
            return None
        
        for step in self.steps:
            if step.time_minutes == minutes:
                return step
        
        closest = min(self.steps, key=lambda s: abs(s.time_minutes - minutes))
        return closest
