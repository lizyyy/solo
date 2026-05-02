"""烧成计划数据模型"""

from datetime import timedelta
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class SegmentType(str, Enum):
    """烧成段类型"""

    RAMP_UP = "ramp_up"
    SOAK = "soak"
    RAMP_DOWN = "ramp_down"
    NATURAL_COOL = "natural_cool"


class FiringSegment(BaseModel):
    """单个烧成段"""

    segment_type: SegmentType = Field(description="段类型")
    name: str = Field(description="段名称，如'快速升温'、'氧化保温'")
    start_temperature_c: float = Field(description="起始温度 (°C)", ge=0.0)
    end_temperature_c: float = Field(description="结束温度 (°C)", ge=0.0)
    duration_minutes: int = Field(description="持续时间 (分钟)", gt=0)

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("持续时间必须大于0")
        return v

    @property
    def ramp_rate_c_per_hour(self) -> Optional[float]:
        """计算升温/降温速率 (°C/小时)，保温段返回None"""
        if self.segment_type in (SegmentType.SOAK, SegmentType.NATURAL_COOL):
            return None
        temp_diff = self.end_temperature_c - self.start_temperature_c
        hours = self.duration_minutes / 60.0
        if hours == 0:
            return None
        return temp_diff / hours

    @property
    def is_ramp_up(self) -> bool:
        return self.segment_type == SegmentType.RAMP_UP

    @property
    def is_ramp_down(self) -> bool:
        return self.segment_type == SegmentType.RAMP_DOWN

    @property
    def is_soak(self) -> bool:
        return self.segment_type == SegmentType.SOAK


class FiringPlan(BaseModel):
    """完整烧成计划"""

    name: str = Field(description="计划名称")
    description: str = Field(default="", description="计划描述")
    firing_type: str = Field(description="烧成类型：素烧/釉烧")
    segments: List[FiringSegment] = Field(description="烧成段列表")

    @field_validator("segments")
    @classmethod
    def validate_segments(cls, v: List[FiringSegment]) -> List[FiringSegment]:
        if not v:
            raise ValueError("烧成段列表不能为空")
        return v

    @property
    def total_duration_minutes(self) -> int:
        """总烧成时间 (分钟)"""
        return sum(s.duration_minutes for s in self.segments)

    @property
    def total_duration_hours(self) -> float:
        """总烧成时间 (小时)"""
        return self.total_duration_minutes / 60.0

    @property
    def peak_temperature_c(self) -> float:
        """最高烧成温度"""
        return max(
            s.end_temperature_c
            for s in self.segments
            if s.segment_type != SegmentType.NATURAL_COOL
        )

    @property
    def max_ramp_up_rate(self) -> float:
        """最大升温速率 (°C/小时)"""
        rates = [
            s.ramp_rate_c_per_hour
            for s in self.segments
            if s.is_ramp_up and s.ramp_rate_c_per_hour is not None
        ]
        return max(rates) if rates else 0.0

    def get_temperature_at_time(self, minutes: int) -> Optional[float]:
        """
        获取指定时间点的温度 (基于计划)
        
        Args:
            minutes: 从烧成开始的分钟数
            
        Returns:
            温度(°C)，如果时间超出范围返回None
        """
        if minutes < 0:
            return None

        elapsed = 0
        for segment in self.segments:
            if elapsed <= minutes < elapsed + segment.duration_minutes:
                seg_progress = (minutes - elapsed) / segment.duration_minutes
                temp_range = segment.end_temperature_c - segment.start_temperature_c
                return segment.start_temperature_c + temp_range * seg_progress
            elapsed += segment.duration_minutes

        return None

    def get_segment_at_time(self, minutes: int) -> Optional[FiringSegment]:
        """获取指定时间点所在的段"""
        if minutes < 0:
            return None

        elapsed = 0
        for segment in self.segments:
            if elapsed <= minutes < elapsed + segment.duration_minutes:
                return segment
            elapsed += segment.duration_minutes

        return None
