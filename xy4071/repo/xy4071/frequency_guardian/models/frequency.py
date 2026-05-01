"""频率分配模型"""

from datetime import time
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator


class FrequencyChannel(BaseModel):
    """频率频道模型"""

    channel_id: str = Field(description="频道唯一标识")
    channel_name: Optional[str] = Field(default=None, description="频道名称")
    frequency_mhz: float = Field(description="频率 (MHz)")
    bandwidth_khz: float = Field(default=12.5, description="带宽 (kHz)")
    mode: str = Field(default="FM", description="调制模式: FM, AM, SSB, CW, DATA")
    is_repeater: bool = Field(default=False, description="是否为中继台频道")
    repeater_input_mhz: Optional[float] = Field(default=None, description="中继台上行频率")
    repeater_output_mhz: Optional[float] = Field(default=None, description="中继台下行频率")
    tone: Optional[str] = Field(default=None, description="亚音/PL码")
    usage_type: str = Field(default="general", description="使用类型: emergency, command, tactical, general, simplex")
    priority: int = Field(default=1, ge=1, le=5, description="优先级 (1-5, 1最高)")
    restrictions: Optional[str] = Field(default=None, description="使用限制说明")

    @field_validator("frequency_mhz")
    @classmethod
    def validate_frequency(cls, v: float) -> float:
        """验证频率是否为正数"""
        if v <= 0:
            raise ValueError("频率必须大于0")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        """验证调制模式"""
        valid_modes = ["FM", "AM", "SSB", "LSB", "USB", "CW", "DATA", "DV"]
        if v.upper() not in valid_modes:
            raise ValueError(f"不支持的调制模式: {v}, 有效模式: {valid_modes}")
        return v.upper()

    class Config:
        validate_assignment = True


class FrequencyAssignment(BaseModel):
    """频率分配模型"""

    assignment_id: str = Field(description="分配唯一标识")
    channel_id: str = Field(description="频道ID")
    call_sign: str = Field(description="使用呼号")
    device_id: Optional[str] = Field(default=None, description="设备ID")
    start_time: str = Field(description="开始时间 (HH:MM)")
    end_time: str = Field(description="结束时间 (HH:MM)")
    days: List[str] = Field(default_factory=lambda: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], description="适用日期")
    assignment_type: str = Field(default="permanent", description="分配类型: permanent, temporary, emergency")
    authorized_by: Optional[str] = Field(default=None, description="授权人")
    notes: Optional[str] = Field(default=None, description="备注")

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        """验证时间格式 HH:MM"""
        try:
            h, m = map(int, v.split(":"))
            if not (0 <= h < 24 and 0 <= m < 60):
                raise ValueError("时间超出有效范围")
            return f"{h:02d}:{m:02d}"
        except Exception as e:
            raise ValueError(f"无效的时间格式: {v}, 应为 HH:MM") from e

    class Config:
        validate_assignment = True


class FrequencyPlan(BaseModel):
    """频率计划模型"""

    channels: List[FrequencyChannel] = Field(default_factory=list, description="频道列表")
    assignments: List[FrequencyAssignment] = Field(default_factory=list, description="频率分配列表")
    plan_name: str = Field(default="未命名频率计划", description="频率计划名称")
    effective_date: Optional[str] = Field(default=None, description="生效日期")
    last_updated: Optional[str] = Field(default=None, description="最后更新时间")
    source_file: Optional[str] = Field(default=None, description="来源文件名")

    def get_channel_by_id(self, channel_id: str) -> Optional[FrequencyChannel]:
        """根据频道ID获取频道"""
        for channel in self.channels:
            if channel.channel_id == channel_id:
                return channel
        return None

    def get_channel_by_frequency(self, frequency_mhz: float, tolerance: float = 0.001) -> Optional[FrequencyChannel]:
        """根据频率获取频道（带容差）"""
        for channel in self.channels:
            if abs(channel.frequency_mhz - frequency_mhz) <= tolerance:
                return channel
            if channel.repeater_input_mhz and abs(channel.repeater_input_mhz - frequency_mhz) <= tolerance:
                return channel
            if channel.repeater_output_mhz and abs(channel.repeater_output_mhz - frequency_mhz) <= tolerance:
                return channel
        return None

    def get_assignments_for_channel(self, channel_id: str) -> List[FrequencyAssignment]:
        """获取指定频道的所有分配"""
        return [a for a in self.assignments if a.channel_id == channel_id]

    class Config:
        validate_assignment = True
