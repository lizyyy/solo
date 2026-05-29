from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class NoiseLabel(str, Enum):
    CLEAN = "clean"
    LOW_NOISE = "low_noise"
    MODERATE_NOISE = "moderate_noise"
    HIGH_NOISE = "high_noise"
    PEAK_NOISE = "peak_noise"


class Direction(str, Enum):
    APPROACHING = "approaching"
    RECEDING = "receding"


class ResultStatus(str, Enum):
    CONFIRMED = "confirmed"
    PENDING_REVIEW = "pending_review"
    REJECTED = "rejected"


class AnomalyType(str, Enum):
    NOISE_PEAK = "noise_peak"
    LANE_MISMATCH = "lane_mismatch"
    DIRECTION_SIGN_REVERSAL = "direction_sign_reversal"


class RadarSample(BaseModel):
    sample_id: str = Field(..., description="样本唯一标识")
    frequency_shift_hz: float = Field(..., description="多普勒频移 (Hz)，正值=接近，负值=远离")
    lane_id: int = Field(..., ge=1, le=8, description="车道编号 (1-8)")
    direction: Direction = Field(..., description="目标运动方向")
    noise_label: NoiseLabel = Field(..., description="噪声标签")
    sampling_time: datetime = Field(..., description="采样时间")
    snr_db: Optional[float] = Field(None, description="信噪比 (dB)，补传字段")
    expected_lane: Optional[int] = Field(None, ge=1, le=8, description="预期车道，补传字段")
    supplementary: bool = Field(False, description="是否为补传数据")


class CalibrationParams(BaseModel):
    version: str = Field(..., description="校准版本号")
    radar_freq_hz: float = Field(..., gt=0, description="雷达发射频率 (Hz)")
    angle_deg: float = Field(..., ge=0, le=90, description="雷达波束与目标方向夹角 (度)")
    speed_of_light: float = Field(299792458.0, description="光速 (m/s)")
    offset_mps: float = Field(0.0, description="系统速度偏移校准值 (m/s)")
    scale_factor: float = Field(1.0, gt=0, description="速度缩放校准因子")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "version": "v1.0",
                    "radar_freq_hz": 24150000000.0,
                    "angle_deg": 30.0,
                    "speed_of_light": 299792458.0,
                    "offset_mps": 0.0,
                    "scale_factor": 1.0,
                }
            ]
        }
    }


class ProcessingStep(BaseModel):
    step_number: int = Field(..., ge=1)
    step_name: str
    description: str
    input_value: str
    output_value: str
    timestamp: datetime


class AnomalyFlag(BaseModel):
    anomaly_type: AnomalyType
    detail: str
    severity: str = Field("warning")
    suggestion: str = "待确认"


class SpeedResult(BaseModel):
    sample_id: str
    raw_speed_mps: Optional[float] = None
    calibrated_speed_mps: Optional[float] = None
    speed_kmh: Optional[float] = None
    status: ResultStatus = ResultStatus.PENDING_REVIEW
    anomalies: list[AnomalyFlag] = Field(default_factory=list)
    processing_steps: list[ProcessingStep] = Field(default_factory=list)
    calibration_version: Optional[str] = None
    processed_at: Optional[datetime] = None


class BatchReport(BaseModel):
    report_id: str
    created_at: datetime
    total_samples: int
    confirmed_count: int
    pending_count: int
    rejected_count: int
    results: list[SpeedResult] = Field(default_factory=list)


class AuditRecord(BaseModel):
    record_id: str
    endpoint: str
    method: str
    request_summary: str
    response_summary: str
    timestamp: datetime
    client_id: Optional[str] = None
