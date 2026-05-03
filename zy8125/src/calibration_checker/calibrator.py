import numpy as np
from typing import List, Dict, Optional, Tuple
import logging

from .models import (
    DetectionFrame,
    CameraCalibrationResult,
    CheckResult,
    FailureRecord,
    CheckStatus,
    FailureType,
)
from .config import CalibrationRules

logger = logging.getLogger(__name__)


class CameraCalibrator:
    def __init__(self, rules: CalibrationRules):
        self.rules = rules

    def calibrate(
        self,
        camera_id: str,
        frames: List[DetectionFrame],
    ) -> Optional[CameraCalibrationResult]:
        valid_frames = [f for f in frames if not f.has_missing_corners]

        if len(valid_frames) < self.rules.min_valid_frames:
            logger.warning(
                f"相机 {camera_id}: 有效帧数不足 (需要 {self.rules.min_valid_frames}, 实际 {len(valid_frames)})"
            )
            return None

        object_points_list = []
        image_points_list = []
        valid_frame_ids = []

        for frame in valid_frames:
            obj_points = np.array(frame.object_points, dtype=np.float32)
            img_points = np.array(frame.image_points, dtype=np.float32)
            object_points_list.append(obj_points)
            image_points_list.append(img_points)
            valid_frame_ids.append(frame.frame_id)

        first_frame = valid_frames[0]
        image_size = (first_frame.image_width, first_frame.image_height)

        try:
            rms, camera_matrix, dist_coeffs, rvecs, tvecs = cv2.calibrateCamera(
                object_points_list,
                image_points_list,
                image_size,
                None,
                None,
            )
        except Exception as e:
            logger.error(f"相机 {camera_id}: 标定失败 - {e}")
            return None

        reprojection_error = self._calculate_reprojection_error(
            object_points_list,
            image_points_list,
            rvecs,
            tvecs,
            camera_matrix,
            dist_coeffs,
        )

        fx = camera_matrix[0][0]
        fy = camera_matrix[1][1]
        cx = camera_matrix[0][2]
        cy = camera_matrix[1][2]

        k1 = dist_coeffs[0][0] if len(dist_coeffs) > 0 else 0.0
        k2 = dist_coeffs[0][1] if len(dist_coeffs) > 1 else 0.0
        p1 = dist_coeffs[0][2] if len(dist_coeffs) > 2 else 0.0
        p2 = dist_coeffs[0][3] if len(dist_coeffs) > 3 else 0.0
        k3 = dist_coeffs[0][4] if len(dist_coeffs) > 4 else 0.0

        camera_info = self.rules.get_camera(camera_id)
        serial_number = camera_info.serial_number if camera_info else "UNKNOWN"

        return CameraCalibrationResult(
            camera_id=camera_id,
            serial_number=serial_number,
            camera_matrix=camera_matrix.tolist(),
            dist_coefficients=dist_coeffs.flatten().tolist(),
            reprojection_error=reprojection_error,
            rms=rms,
            fx=float(fx),
            fy=float(fy),
            cx=float(cx),
            cy=float(cy),
            k1=float(k1),
            k2=float(k2),
            p1=float(p1),
            p2=float(p2),
            k3=float(k3),
            image_width=image_size[0],
            image_height=image_size[1],
            num_frames=len(valid_frames),
            valid_frames=valid_frame_ids,
        )

    def _calculate_reprojection_error(
        self,
        object_points: List[np.ndarray],
        image_points: List[np.ndarray],
        rvecs: List[np.ndarray],
        tvecs: List[np.ndarray],
        camera_matrix: np.ndarray,
        dist_coeffs: np.ndarray,
    ) -> float:
        total_error = 0.0
        total_points = 0

        for i in range(len(object_points)):
            img_points_reprojected, _ = cv2.projectPoints(
                object_points[i],
                rvecs[i],
                tvecs[i],
                camera_matrix,
                dist_coeffs,
            )
            error = cv2.norm(image_points[i], img_points_reprojected, cv2.NORM_L2)
            total_error += error * error
            total_points += len(object_points[i])

        if total_points == 0:
            return float("inf")
        return np.sqrt(total_error / total_points)

    def check_resolution(
        self,
        camera_id: str,
        actual_width: int,
        actual_height: int,
    ) -> Tuple[CheckResult, Optional[FailureRecord]]:
        camera_info = self.rules.get_camera(camera_id)
        if not camera_info:
            result = CheckResult(
                check_type="resolution",
                status=CheckStatus.WARNING,
                message=f"相机 {camera_id} 未在设备档案中找到",
            )
            return result, None

        expected_width = camera_info.expected_width
        expected_height = camera_info.expected_height

        if actual_width == expected_width and actual_height == expected_height:
            result = CheckResult(
                check_type="resolution",
                status=CheckStatus.PASS,
                message=f"分辨率匹配: {actual_width}x{actual_height}",
                details={
                    "actual_width": actual_width,
                    "actual_height": actual_height,
                    "expected_width": expected_width,
                    "expected_height": expected_height,
                },
            )
            return result, None
        else:
            result = CheckResult(
                check_type="resolution",
                status=CheckStatus.FAIL,
                message=f"分辨率不匹配: 期望 {expected_width}x{expected_height}, 实际 {actual_width}x{actual_height}",
                details={
                    "actual_width": actual_width,
                    "actual_height": actual_height,
                    "expected_width": expected_width,
                    "expected_height": expected_height,
                },
            )
            failure = FailureRecord(
                camera_id=camera_id,
                failure_type=FailureType.RESOLUTION,
                status=CheckStatus.FAIL,
                message=f"分辨率不匹配: 期望 {expected_width}x{expected_height}, 实际 {actual_width}x{actual_height}",
                details={
                    "actual_width": actual_width,
                    "actual_height": actual_height,
                    "expected_width": expected_width,
                    "expected_height": expected_height,
                },
            )
            return result, failure

    def check_reprojection_error(
        self,
        camera_id: str,
        error: float,
    ) -> Tuple[CheckResult, Optional[FailureRecord]]:
        max_error = self.rules.max_reprojection_error

        if error <= max_error:
            result = CheckResult(
                check_type="reprojection_error",
                status=CheckStatus.PASS,
                message=f"重投影误差: {error:.4f} (阈值: {max_error})",
                details={
                    "error": error,
                    "max_allowed": max_error,
                },
            )
            return result, None
        else:
            result = CheckResult(
                check_type="reprojection_error",
                status=CheckStatus.FAIL,
                message=f"重投影误差超标: {error:.4f} > {max_error}",
                details={
                    "error": error,
                    "max_allowed": max_error,
                },
            )
            failure = FailureRecord(
                camera_id=camera_id,
                failure_type=FailureType.REPROJECTION_ERROR,
                status=CheckStatus.FAIL,
                message=f"重投影误差超标: {error:.4f} > {max_error}",
                details={
                    "error": error,
                    "max_allowed": max_error,
                },
            )
            return result, failure

    def check_focal_length(
        self,
        camera_id: str,
        fx: float,
        fy: float,
    ) -> Tuple[CheckResult, Optional[FailureRecord]]:
        camera_info = self.rules.get_camera(camera_id)
        if not camera_info:
            result = CheckResult(
                check_type="focal_length",
                status=CheckStatus.WARNING,
                message=f"相机 {camera_id} 未在设备档案中找到，无法验证焦距范围",
            )
            return result, None

        fx_ok = camera_info.expected_fx_min <= fx <= camera_info.expected_fx_max
        fy_ok = camera_info.expected_fy_min <= fy <= camera_info.expected_fy_max

        if fx_ok and fy_ok:
            result = CheckResult(
                check_type="focal_length",
                status=CheckStatus.PASS,
                message=f"焦距在范围内: fx={fx:.2f}, fy={fy:.2f}",
                details={
                    "fx": fx,
                    "fy": fy,
                    "fx_range": [camera_info.expected_fx_min, camera_info.expected_fx_max],
                    "fy_range": [camera_info.expected_fy_min, camera_info.expected_fy_max],
                },
            )
            return result, None
        else:
            issues = []
            if not fx_ok:
                issues.append(
                    f"fx={fx:.2f} 超出范围 [{camera_info.expected_fx_min}, {camera_info.expected_fx_max}]"
                )
            if not fy_ok:
                issues.append(
                    f"fy={fy:.2f} 超出范围 [{camera_info.expected_fy_min}, {camera_info.expected_fy_max}]"
                )

            result = CheckResult(
                check_type="focal_length",
                status=CheckStatus.FAIL,
                message=f"焦距超出范围: {'; '.join(issues)}",
                details={
                    "fx": fx,
                    "fy": fy,
                    "fx_range": [camera_info.expected_fx_min, camera_info.expected_fx_max],
                    "fy_range": [camera_info.expected_fy_min, camera_info.expected_fy_max],
                },
            )
            failure = FailureRecord(
                camera_id=camera_id,
                failure_type=FailureType.FOCAL_LENGTH,
                status=CheckStatus.FAIL,
                message=f"焦距超出范围: {'; '.join(issues)}",
                details={
                    "fx": fx,
                    "fy": fy,
                    "fx_range": [camera_info.expected_fx_min, camera_info.expected_fx_max],
                    "fy_range": [camera_info.expected_fy_min, camera_info.expected_fy_max],
                },
            )
            return result, failure

    def check_distortion(
        self,
        camera_id: str,
        k1: float,
        k2: float,
    ) -> Tuple[CheckResult, Optional[FailureRecord]]:
        camera_info = self.rules.get_camera(camera_id)
        if not camera_info:
            result = CheckResult(
                check_type="distortion",
                status=CheckStatus.WARNING,
                message=f"相机 {camera_id} 未在设备档案中找到，无法验证畸变范围",
            )
            return result, None

        k1_ok = camera_info.expected_k1_min <= k1 <= camera_info.expected_k1_max
        k2_ok = camera_info.expected_k2_min <= k2 <= camera_info.expected_k2_max

        if k1_ok and k2_ok:
            result = CheckResult(
                check_type="distortion",
                status=CheckStatus.PASS,
                message=f"畸变系数在范围内: k1={k1:.4f}, k2={k2:.4f}",
                details={
                    "k1": k1,
                    "k2": k2,
                    "k1_range": [camera_info.expected_k1_min, camera_info.expected_k1_max],
                    "k2_range": [camera_info.expected_k2_min, camera_info.expected_k2_max],
                },
            )
            return result, None
        else:
            issues = []
            if not k1_ok:
                issues.append(
                    f"k1={k1:.4f} 超出范围 [{camera_info.expected_k1_min}, {camera_info.expected_k1_max}]"
                )
            if not k2_ok:
                issues.append(
                    f"k2={k2:.4f} 超出范围 [{camera_info.expected_k2_min}, {camera_info.expected_k2_max}]"
                )

            result = CheckResult(
                check_type="distortion",
                status=CheckStatus.FAIL,
                message=f"畸变系数超出范围: {'; '.join(issues)}",
                details={
                    "k1": k1,
                    "k2": k2,
                    "k1_range": [camera_info.expected_k1_min, camera_info.expected_k1_max],
                    "k2_range": [camera_info.expected_k2_min, camera_info.expected_k2_max],
                },
            )
            failure = FailureRecord(
                camera_id=camera_id,
                failure_type=FailureType.DISTORTION,
                status=CheckStatus.FAIL,
                message=f"畸变系数超出范围: {'; '.join(issues)}",
                details={
                    "k1": k1,
                    "k2": k2,
                    "k1_range": [camera_info.expected_k1_min, camera_info.expected_k1_max],
                    "k2_range": [camera_info.expected_k2_min, camera_info.expected_k2_max],
                },
            )
            return result, failure


try:
    import cv2
except ImportError:
    logger.warning("OpenCV 未安装，将使用模拟标定模式")

    class MockCalibrator:
        @staticmethod
        def calibrateCamera(
            object_points: List[np.ndarray],
            image_points: List[np.ndarray],
            image_size: Tuple[int, int],
            camera_matrix: Optional[np.ndarray],
            dist_coeffs: Optional[np.ndarray],
        ) -> Tuple[float, np.ndarray, np.ndarray, List[np.ndarray], List[np.ndarray]]:
            width, height = image_size
            fx = 1000.0 + np.random.randn() * 50
            fy = 1000.0 + np.random.randn() * 50
            cx = width / 2.0
            cy = height / 2.0

            camera_matrix = np.array(
                [[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float64
            )
            dist_coeffs = np.array([[0.05, -0.1, 0, 0, 0.001]], dtype=np.float64)

            rms = 0.3 + np.random.rand() * 0.5

            rvecs = [np.array([0.1, 0.2, 0.3], dtype=np.float64) for _ in object_points]
            tvecs = [np.array([1.0, 0.5, 5.0], dtype=np.float64) for _ in object_points]

            return rms, camera_matrix, dist_coeffs, rvecs, tvecs

        @staticmethod
        def projectPoints(
            object_points: np.ndarray,
            rvec: np.ndarray,
            tvec: np.ndarray,
            camera_matrix: np.ndarray,
            dist_coeffs: np.ndarray,
        ) -> Tuple[np.ndarray, np.ndarray]:
            reprojected = object_points[:, :2].copy() + np.random.randn(*object_points[:, :2].shape) * 0.5
            return reprojected.reshape(-1, 1, 2), np.array([])

        @staticmethod
        def norm(a: np.ndarray, b: np.ndarray, norm_type: int) -> float:
            return float(np.linalg.norm(a - b))

    cv2 = type("cv2", (), {
        "calibrateCamera": MockCalibrator.calibrateCamera,
        "projectPoints": MockCalibrator.projectPoints,
        "norm": MockCalibrator.norm,
        "NORM_L2": 4,
    })()
