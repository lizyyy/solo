from typing import Dict, List, Optional
from collections import defaultdict
import logging

from .models import (
    DetectionFrame,
    AnomalyReport,
    FailureRecord,
    CheckStatus,
    FailureType,
)
from .config import CalibrationRules

logger = logging.getLogger(__name__)


class AnomalyDetector:
    def __init__(self, rules: CalibrationRules):
        self.rules = rules

    def detect_missing_corners(
        self,
        camera_id: str,
        frames: List[DetectionFrame],
    ) -> List[AnomalyReport]:
        anomalies = []
        missing_corner_frames = [f for f in frames if f.has_missing_corners]

        if missing_corner_frames:
            affected_frame_ids = [f.frame_id for f in missing_corner_frames]
            total_frames = len(frames)
            missing_count = len(missing_corner_frames)
            missing_ratio = missing_count / total_frames

            severity = "WARNING"
            if missing_ratio > 0.5:
                severity = "ERROR"
            elif missing_ratio > 0.2:
                severity = "WARNING"
            else:
                severity = "INFO"

            details_by_frame = {}
            for f in missing_corner_frames:
                details_by_frame[f.frame_id] = {
                    "expected": f.expected_corners,
                    "detected": f.num_detected_corners,
                    "missing": f.expected_corners - f.num_detected_corners,
                    "pattern_id": f.pattern_id,
                    "sequence_id": f.sequence_id,
                }

            anomaly = AnomalyReport(
                camera_id=camera_id,
                anomaly_type="missing_corners",
                severity=severity,
                message=(
                    f"发现 {missing_count}/{total_frames} 帧存在缺角点问题。"
                    f"缺角点比例: {missing_ratio:.1%}"
                ),
                affected_frames=affected_frame_ids,
                details={
                    "total_frames": total_frames,
                    "missing_count": missing_count,
                    "missing_ratio": missing_ratio,
                    "frames_detail": details_by_frame,
                },
            )
            anomalies.append(anomaly)

        return anomalies

    def detect_cross_camera_mismatch(
        self,
        all_frames: Dict[str, List[DetectionFrame]],
    ) -> List[AnomalyReport]:
        anomalies = []

        sequence_to_cameras = defaultdict(set)
        sequence_to_frames = defaultdict(list)

        for camera_id, frames in all_frames.items():
            for frame in frames:
                sequence_to_cameras[frame.sequence_id].add(camera_id)
                sequence_to_frames[frame.sequence_id].append(
                    {
                        "frame_id": frame.frame_id,
                        "camera_id": frame.camera_id,
                        "pattern_id": frame.pattern_id,
                        "timestamp": frame.timestamp.isoformat() if frame.timestamp else None,
                    }
                )

        for sequence_id, camera_ids in sequence_to_cameras.items():
            if len(camera_ids) > 1:
                expected_camera = self.rules.get_camera_by_sequence(sequence_id)
                expected_camera_id = expected_camera.camera_id if expected_camera else None

                unexpected_cameras = [
                    cid for cid in camera_ids if cid != expected_camera_id
                ]

                affected_frames = [
                    f["frame_id"] for f in sequence_to_frames[sequence_id]
                ]

                severity = "ERROR" if expected_camera_id in unexpected_cameras else "WARNING"

                message_parts = [
                    f"序列 {sequence_id} 被分配到了 {len(camera_ids)} 个不同相机: {', '.join(camera_ids)}"
                ]
                if expected_camera_id:
                    message_parts.append(
                        f"根据配置，该序列应属于相机 {expected_camera_id}"
                    )
                    if unexpected_cameras:
                        message_parts.append(
                            f"误归属的相机: {', '.join(unexpected_cameras)}"
                        )

                anomaly = AnomalyReport(
                    camera_id=list(camera_ids)[0],
                    anomaly_type="cross_camera_mismatch",
                    severity=severity,
                    message=" | ".join(message_parts),
                    affected_frames=affected_frames,
                    details={
                        "sequence_id": sequence_id,
                        "assigned_cameras": list(camera_ids),
                        "expected_camera": expected_camera_id,
                        "unexpected_cameras": unexpected_cameras,
                        "all_frames": sequence_to_frames[sequence_id],
                    },
                )
                anomalies.append(anomaly)

        return anomalies

    def create_missing_corners_failure(
        self,
        anomaly: AnomalyReport,
    ) -> FailureRecord:
        return FailureRecord(
            camera_id=anomaly.camera_id,
            failure_type=FailureType.MISSING_CORNERS,
            status=CheckStatus.WARNING if anomaly.severity != "ERROR" else CheckStatus.FAIL,
            message=anomaly.message,
            details=anomaly.details,
        )

    def create_cross_camera_failure(
        self,
        anomaly: AnomalyReport,
    ) -> List[FailureRecord]:
        failures = []
        camera_ids = anomaly.details.get("assigned_cameras", [anomaly.camera_id])
        for camera_id in camera_ids:
            failure = FailureRecord(
                camera_id=camera_id,
                failure_type=FailureType.CROSS_CAMERA_MISMATCH,
                status=CheckStatus.FAIL if anomaly.severity == "ERROR" else CheckStatus.WARNING,
                message=anomaly.message,
                details=anomaly.details,
            )
            failures.append(failure)
        return failures

    def detect_all(
        self,
        all_frames: Dict[str, List[DetectionFrame]],
    ) -> Dict[str, List[AnomalyReport]]:
        all_anomalies: Dict[str, List[AnomalyReport]] = defaultdict(list)

        for camera_id, frames in all_frames.items():
            missing_anomalies = self.detect_missing_corners(camera_id, frames)
            all_anomalies[camera_id].extend(missing_anomalies)

        cross_camera_anomalies = self.detect_cross_camera_mismatch(all_frames)
        for anomaly in cross_camera_anomalies:
            camera_ids = anomaly.details.get("assigned_cameras", [anomaly.camera_id])
            for camera_id in camera_ids:
                all_anomalies[camera_id].append(anomaly)

        return dict(all_anomalies)
