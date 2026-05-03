from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Any
from datetime import datetime


class CheckStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARNING = "WARNING"


class FailureType(Enum):
    REPROJECTION_ERROR = "reprojection_error"
    FOCAL_LENGTH = "focal_length"
    DISTORTION = "distortion"
    RESOLUTION = "resolution"
    MISSING_CORNERS = "missing_corners"
    CROSS_CAMERA_MISMATCH = "cross_camera_mismatch"


@dataclass
class CameraInfo:
    camera_id: str
    serial_number: str
    model: str
    expected_width: int
    expected_height: int
    expected_fx_min: float
    expected_fx_max: float
    expected_fy_min: float
    expected_fy_max: float
    expected_k1_min: float
    expected_k1_max: float
    expected_k2_min: float
    expected_k2_max: float


@dataclass
class ChessboardPattern:
    pattern_id: str
    sequence_id: str
    camera_id: str
    board_width: int
    board_height: int
    square_size: float


@dataclass
class DetectionFrame:
    frame_id: str
    camera_id: str
    sequence_id: str
    pattern_id: str
    timestamp: datetime
    image_width: int
    image_height: int
    object_points: List[List[float]]
    image_points: List[List[float]]
    num_detected_corners: int
    expected_corners: int
    has_missing_corners: bool = False


@dataclass
class CameraCalibrationResult:
    camera_id: str
    serial_number: str
    camera_matrix: List[List[float]]
    dist_coefficients: List[float]
    reprojection_error: float
    rms: float
    fx: float
    fy: float
    cx: float
    cy: float
    k1: float
    k2: float
    p1: float
    p2: float
    k3: float
    image_width: int
    image_height: int
    num_frames: int
    valid_frames: List[str] = field(default_factory=list)


@dataclass
class CheckResult:
    check_type: str
    status: CheckStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FailureRecord:
    camera_id: str
    failure_type: FailureType
    status: CheckStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CameraCheckReport:
    camera_id: str
    serial_number: str
    overall_status: CheckStatus
    calibration_result: Optional[CameraCalibrationResult] = None
    check_results: List[CheckResult] = field(default_factory=list)
    failures: List[FailureRecord] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class AnomalyReport:
    camera_id: str
    anomaly_type: str
    severity: str
    message: str
    affected_frames: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CalibrationBundle:
    version: str
    generated_at: datetime
    cameras: Dict[str, CameraCalibrationResult] = field(default_factory=dict)
    passed_cameras: int = 0
    failed_cameras: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
