"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any

import numpy as np


class UnitType(Enum):
    """声压级单位类型"""
    DB = "dB"
    DB_A = "dB(A)"
    DB_C = "dB(C)"
    DB_Z = "dB(Z)"


class AnomalyType(Enum):
    """异常类型"""
    CLIPPING = "削波"
    NOISE_FLOOR = "噪声底过高"
    MISSING_SEGMENTS = "数据缺失"
    MULTIPLE_REFLECTIONS = "多次反射干扰"
    NON_LINEAR_DECAY = "非线性衰减"
    LOW_SNR = "信噪比过低"


class ValidationStatus(Enum):
    """校验状态"""
    PASS = "通过"
    WARNING = "警告"
    FAIL = "失败"


@dataclass
class ValidationResult:
    """校验结果"""
    status: ValidationStatus
    messages: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    def add_warning(self, message: str, details: Optional[Dict] = None):
        if self.status != ValidationStatus.FAIL:
            self.status = ValidationStatus.WARNING
        self.messages.append(f"[警告] {message}")
        if details:
            self.details.update(details)

    def add_error(self, message: str, details: Optional[Dict] = None):
        self.status = ValidationStatus.FAIL
        self.messages.append(f"[错误] {message}")
        if details:
            self.details.update(details)


@dataclass
class MeasurementData:
    """测量数据"""
    time: np.ndarray
    spl: np.ndarray
    sample_rate: float
    unit: UnitType
    start_time: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration(self) -> float:
        """测量持续时间（秒）"""
        return float(self.time[-1] - self.time[0]) if len(self.time) > 0 else 0.0

    @property
    def num_samples(self) -> int:
        """采样点数"""
        return len(self.time)


@dataclass
class FitResult:
    """拟合结果"""
    rt_value: float
    confidence: float
    fit_start_db: float
    fit_end_db: float
    fit_start_time: float
    fit_end_time: float
    slope: float
    intercept: float
    r_squared: float
    anomalies: List[AnomalyType] = field(default_factory=list)
    anomaly_reasons: List[str] = field(default_factory=list)


@dataclass
class AcousticMetrics:
    """声学指标"""
    rt20: Optional[FitResult] = None
    rt30: Optional[FitResult] = None
    edt: Optional[FitResult] = None
    c80: Optional[float] = None
    d50: Optional[float] = None
    center_time: Optional[float] = None
    validation: ValidationResult = field(default_factory=lambda: ValidationResult(ValidationStatus.PASS))
    schroeder_curve: Optional[np.ndarray] = None
    schroeder_time: Optional[np.ndarray] = None


@dataclass
class MeasurementPoint:
    """测点"""
    id: str
    name: str
    position: Optional[Dict[str, float]] = None
    measurements: Dict[str, MeasurementData] = field(default_factory=dict)
    metrics: Dict[str, AcousticMetrics] = field(default_factory=dict)
    validation: ValidationResult = field(default_factory=lambda: ValidationResult(ValidationStatus.PASS))


@dataclass
class Room:
    """房间"""
    id: str
    name: str
    volume: Optional[float] = None
    area: Optional[float] = None
    description: Optional[str] = None
    points: Dict[str, MeasurementPoint] = field(default_factory=dict)
    validation: ValidationResult = field(default_factory=lambda: ValidationResult(ValidationStatus.PASS))


@dataclass
class BatchResult:
    """批处理结果"""
    rooms: Dict[str, Room] = field(default_factory=dict)
    processed_at: datetime = field(default_factory=datetime.now)
    total_measurements: int = 0
    passed_measurements: int = 0
    failed_measurements: int = 0
