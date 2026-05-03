from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

from .models import (
    CameraCheckReport,
    CalibrationBundle,
    CameraCalibrationResult,
    CheckStatus,
    FailureRecord,
    AnomalyReport,
    FailureType,
)


class ReportGenerator:
    def __init__(self):
        self.generated_at = datetime.now()

    def generate_calibration_bundle(
        self,
        camera_reports: Dict[str, CameraCheckReport],
        version: str = "1.0.0",
    ) -> dict:
        passed_cameras = []
        failed_cameras = []
        cameras_data = {}

        for camera_id, report in camera_reports.items():
            if report.calibration_result:
                calib = report.calibration_result
                cameras_data[camera_id] = {
                    "camera_id": calib.camera_id,
                    "serial_number": calib.serial_number,
                    "status": report.overall_status.value,
                    "camera_matrix": calib.camera_matrix,
                    "dist_coefficients": calib.dist_coefficients,
                    "reprojection_error": calib.reprojection_error,
                    "rms": calib.rms,
                    "intrinsics": {
                        "fx": calib.fx,
                        "fy": calib.fy,
                        "cx": calib.cx,
                        "cy": calib.cy,
                    },
                    "distortion": {
                        "k1": calib.k1,
                        "k2": calib.k2,
                        "p1": calib.p1,
                        "p2": calib.p2,
                        "k3": calib.k3,
                    },
                    "image_resolution": {
                        "width": calib.image_width,
                        "height": calib.image_height,
                    },
                    "num_valid_frames": calib.num_frames,
                    "valid_frames": calib.valid_frames,
                    "check_results": [
                        {
                            "check_type": cr.check_type,
                            "status": cr.status.value,
                            "message": cr.message,
                            "details": cr.details,
                        }
                        for cr in report.check_results
                    ],
                }

                if report.overall_status == CheckStatus.PASS:
                    passed_cameras.append(camera_id)
                else:
                    failed_cameras.append(camera_id)

        bundle = {
            "version": version,
            "generated_at": self.generated_at.isoformat(),
            "summary": {
                "total_cameras": len(camera_reports),
                "passed_cameras": len(passed_cameras),
                "failed_cameras": len(failed_cameras),
                "passed_camera_ids": passed_cameras,
                "failed_camera_ids": failed_cameras,
            },
            "cameras": cameras_data,
        }
        return bundle

    def generate_failures_csv_data(
        self,
        camera_reports: Dict[str, CameraCheckReport],
        anomalies: Dict[str, List[AnomalyReport]],
    ) -> List[dict]:
        failures_data = []

        for camera_id, report in camera_reports.items():
            for failure in report.failures:
                row = {
                    "camera_id": camera_id,
                    "failure_type": failure.failure_type.value,
                    "status": failure.status.value,
                    "message": failure.message,
                    "details": str(failure.details),
                }
                failures_data.append(row)

            camera_anomalies = anomalies.get(camera_id, [])
            for anomaly in camera_anomalies:
                if anomaly.anomaly_type == "missing_corners":
                    status = "FAIL" if anomaly.severity == "ERROR" else "WARNING"
                    row = {
                        "camera_id": camera_id,
                        "failure_type": "missing_corners",
                        "status": status,
                        "message": anomaly.message,
                        "details": str(anomaly.details),
                    }
                    failures_data.append(row)
                elif anomaly.anomaly_type == "cross_camera_mismatch":
                    status = "FAIL" if anomaly.severity == "ERROR" else "WARNING"
                    row = {
                        "camera_id": camera_id,
                        "failure_type": "cross_camera_mismatch",
                        "status": status,
                        "message": anomaly.message,
                        "details": str(anomaly.details),
                    }
                    failures_data.append(row)

        return failures_data

    def generate_markdown_report(
        self,
        camera_reports: Dict[str, CameraCheckReport],
        anomalies: Dict[str, List[AnomalyReport]],
    ) -> str:
        lines = []

        lines.append("# 工业相机标定复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        total_cameras = len(camera_reports)
        passed_cameras = sum(
            1 for r in camera_reports.values() if r.overall_status == CheckStatus.PASS
        )
        failed_cameras = sum(
            1 for r in camera_reports.values() if r.overall_status != CheckStatus.PASS
        )

        lines.append("## 执行摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总相机数 | {total_cameras} |")
        lines.append(f"| 通过 | {passed_cameras} |")
        lines.append(f"| 失败/警告 | {failed_cameras} |")
        lines.append("")

        all_anomalies = []
        for cam_anomalies in anomalies.values():
            all_anomalies.extend(cam_anomalies)

        missing_corner_anomalies = [
            a for a in all_anomalies if a.anomaly_type == "missing_corners"
        ]
        cross_camera_anomalies = [
            a for a in all_anomalies if a.anomaly_type == "cross_camera_mismatch"
        ]

        if missing_corner_anomalies or cross_camera_anomalies:
            lines.append("## 异常检测")
            lines.append("")

            if missing_corner_anomalies:
                lines.append("### 缺角点异常")
                lines.append("")
                for anomaly in missing_corner_anomalies:
                    lines.append(f"**相机 {anomaly.camera_id}** - [{anomaly.severity}]")
                    lines.append(f"> {anomaly.message}")
                    lines.append("")
                    if anomaly.affected_frames:
                        lines.append(f"影响帧数: {len(anomaly.affected_frames)}")
                        lines.append("")

            if cross_camera_anomalies:
                lines.append("### 跨相机误归属异常")
                lines.append("")
                for anomaly in cross_camera_anomalies:
                    lines.append(f"**序列 {anomaly.details.get('sequence_id', '未知')}** - [{anomaly.severity}]")
                    lines.append(f"> {anomaly.message}")
                    lines.append("")
                    assigned_cameras = anomaly.details.get("assigned_cameras", [])
                    if assigned_cameras:
                        lines.append(f"涉及相机: {', '.join(assigned_cameras)}")
                    expected = anomaly.details.get("expected_camera")
                    if expected:
                        lines.append(f"期望归属: {expected}")
                    lines.append("")

        lines.append("## 各相机详细报告")
        lines.append("")

        for camera_id, report in camera_reports.items():
            status_icon = "✅" if report.overall_status == CheckStatus.PASS else "❌"
            lines.append(f"### {status_icon} 相机 {camera_id}")
            lines.append("")
            lines.append(f"**序列号**: {report.serial_number}")
            lines.append(f"**整体状态**: {report.overall_status.value}")
            lines.append("")

            if report.calibration_result:
                calib = report.calibration_result
                lines.append("#### 标定结果")
                lines.append("")
                lines.append(f"- 分辨率: {calib.image_width}x{calib.image_height}")
                lines.append(f"- 有效帧数: {calib.num_frames}")
                lines.append(f"- 重投影误差 (RMS): {calib.rms:.4f}")
                lines.append(f"- 平均重投影误差: {calib.reprojection_error:.4f}")
                lines.append("")
                lines.append("**内参矩阵**:")
                lines.append("```")
                lines.append(f"  [{calib.fx:>10.2f}, {0:>10.2f}, {calib.cx:>10.2f}]")
                lines.append(f"  [{0:>10.2f}, {calib.fy:>10.2f}, {calib.cy:>10.2f}]")
                lines.append(f"  [{0:>10.2f}, {0:>10.2f}, {1:>10.2f}]")
                lines.append("```")
                lines.append("")
                lines.append("**畸变系数**:")
                lines.append(f"- k1: {calib.k1:.6f}")
                lines.append(f"- k2: {calib.k2:.6f}")
                lines.append(f"- p1: {calib.p1:.6f}")
                lines.append(f"- p2: {calib.p2:.6f}")
                lines.append(f"- k3: {calib.k3:.6f}")
                lines.append("")

            lines.append("#### 检查项结果")
            lines.append("")
            lines.append("| 检查类型 | 状态 | 消息 |")
            lines.append("|----------|------|------|")
            for check_result in report.check_results:
                status_emoji = (
                    "✅"
                    if check_result.status == CheckStatus.PASS
                    else ("⚠️" if check_result.status == CheckStatus.WARNING else "❌")
                )
                lines.append(
                    f"| {check_result.check_type} | {status_emoji} {check_result.status.value} | {check_result.message} |"
                )
            lines.append("")

            if report.failures:
                lines.append("#### 失败记录")
                lines.append("")
                for failure in report.failures:
                    lines.append(f"- **{failure.failure_type.value}** ({failure.status.value}): {failure.message}")
                lines.append("")

            if report.warnings:
                lines.append("#### 警告")
                lines.append("")
                for warning in report.warnings:
                    lines.append(f"- ⚠️ {warning}")
                lines.append("")

        return "\n".join(lines)
