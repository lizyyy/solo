from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class RoastLevel(str, Enum):
    LIGHT = "light"
    MEDIUM = "medium"
    MEDIUM_DARK = "medium-dark"
    DARK = "dark"


class FirstCrackType(str, Enum):
    NORMAL = "normal"
    EARLY = "early"
    LATE = "late"
    MISSING = "missing"


class TemperaturePoint(BaseModel):
    time_seconds: float = Field(..., ge=0)
    bean_temp: float = Field(..., ge=0, le=300)
    exhaust_temp: Optional[float] = Field(None, ge=0, le=400)

    @field_validator("time_seconds")
    @classmethod
    def time_must_be_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("时间必须为非负值")
        return v


class FirstCrackInfo(BaseModel):
    start_time_seconds: float = Field(..., ge=0)
    start_temp: float = Field(..., ge=150, le=240)
    end_time_seconds: Optional[float] = None
    end_temp: Optional[float] = None
    intensity: str = Field(default="medium", pattern="^(low|medium|high)$")
    crack_type: FirstCrackType = FirstCrackType.NORMAL
    notes: Optional[str] = None

    @property
    def duration_seconds(self) -> Optional[float]:
        if self.end_time_seconds and self.start_time_seconds:
            return self.end_time_seconds - self.start_time_seconds
        return None


class CupScore(BaseModel):
    aroma: float = Field(..., ge=0, le=10)
    flavor: float = Field(..., ge=0, le=10)
    aftertaste: float = Field(..., ge=0, le=10)
    acidity: float = Field(..., ge=0, le=10)
    body: float = Field(..., ge=0, le=10)
    balance: float = Field(..., ge=0, le=10)
    uniformity: float = Field(..., ge=0, le=10)
    overall: float = Field(..., ge=0, le=10)
    defects: float = Field(default=0, ge=0)

    @property
    def total_score(self) -> float:
        base = (
            self.aroma + self.flavor + self.aftertaste + self.acidity
            + self.body + self.balance + self.uniformity + self.overall
        )
        return round(base - self.defects, 2)

    @property
    def quality_level(self) -> str:
        score = self.total_score
        if score >= 72:
            return "Excellent (72+, 90%+ of 80)"
        elif score >= 68:
            return "Very Good (68-71.99, 85%+)"
        elif score >= 64:
            return "Good (64-67.99, 80%+)"
        elif score >= 56:
            return "Average (56-63.99, 70%+)"
        else:
            return "Below Average (<56)"


class RoastBatch(BaseModel):
    batch_id: str
    coffee_name: str
    origin: Optional[str] = None
    process_method: Optional[str] = None
    green_weight_g: float = Field(..., gt=0)
    roasted_weight_g: Optional[float] = Field(None, gt=0)
    roast_date: datetime
    curve_points: List[TemperaturePoint] = Field(default_factory=list)
    first_crack: Optional[FirstCrackInfo] = None
    cup_score: Optional[CupScore] = None
    roast_notes: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("green_weight_g")
    @classmethod
    def green_weight_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("生豆重量必须大于0")
        return v

    @property
    def total_roast_time_seconds(self) -> Optional[float]:
        if not self.curve_points:
            return None
        return max(p.time_seconds for p in self.curve_points)

    @property
    def dropout_temp(self) -> Optional[float]:
        if not self.curve_points:
            return None
        return max(self.curve_points, key=lambda p: p.time_seconds).bean_temp

    @property
    def weight_loss_percent(self) -> Optional[float]:
        if not self.roasted_weight_g or not self.green_weight_g:
            return None
        return round((1 - self.roasted_weight_g / self.green_weight_g) * 100, 2)

    def get_first_crack_time_ratio(self) -> Optional[float]:
        if not self.first_crack or not self.total_roast_time_seconds:
            return None
        return round(self.first_crack.start_time_seconds / self.total_roast_time_seconds, 3)


class HeatingRateProfile(BaseModel):
    batch_id: str
    avg_rate_0_to_first_crack: Optional[float] = None
    avg_rate_first_crack_to_drop: Optional[float] = None
    peak_rate: Optional[float] = None
    peak_rate_time: Optional[float] = None
    min_rate: Optional[float] = None
    rate_points: List[Dict[str, Any]] = Field(default_factory=list)
    anomalies: List[str] = Field(default_factory=list)


class ReviewReport(BaseModel):
    report_id: str
    batch_ids: List[str]
    generated_at: datetime
    summary: Dict[str, Any]
    comparison_table: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
    recommendations: List[str]
    chart_paths: List[str] = Field(default_factory=list)
