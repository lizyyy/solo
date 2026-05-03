import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import CameraInfo, DetectionFrame, CameraCalibrationResult
from .config import CalibrationRules


def read_cameras_csv(csv_path: str) -> Dict[str, CameraInfo]:
    cameras = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            camera = CameraInfo(
                camera_id=row["camera_id"],
                serial_number=row["serial_number"],
                model=row["model"],
                expected_width=int(row["expected_width"]),
                expected_height=int(row["expected_height"]),
                expected_fx_min=float(row["expected_fx_min"]),
                expected_fx_max=float(row["expected_fx_max"]),
                expected_fy_min=float(row["expected_fy_min"]),
                expected_fy_max=float(row["expected_fy_max"]),
                expected_k1_min=float(row["expected_k1_min"]),
                expected_k1_max=float(row["expected_k1_max"]),
                expected_k2_min=float(row["expected_k2_min"]),
                expected_k2_max=float(row["expected_k2_max"]),
            )
            cameras[row["camera_id"]] = camera
    return cameras


def read_detection_jsonl(jsonl_path: str, rules: CalibrationRules) -> List[DetectionFrame]:
    frames = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            pattern = rules.get_pattern(data["pattern_id"])
            if pattern:
                expected_corners = pattern.board_width * pattern.board_height
            else:
                expected_corners = data.get("expected_corners", 0)

            num_detected = len(data["image_points"])
            has_missing = num_detected < expected_corners

            frame = DetectionFrame(
                frame_id=data["frame_id"],
                camera_id=data["camera_id"],
                sequence_id=data["sequence_id"],
                pattern_id=data["pattern_id"],
                timestamp=datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00")),
                image_width=data["image_width"],
                image_height=data["image_height"],
                object_points=data["object_points"],
                image_points=data["image_points"],
                num_detected_corners=num_detected,
                expected_corners=expected_corners,
                has_missing_corners=has_missing,
            )
            frames.append(frame)
    return frames


def read_all_detections(detections_dir: str, rules: CalibrationRules) -> Dict[str, List[DetectionFrame]]:
    detections_path = Path(detections_dir)
    all_frames: Dict[str, List[DetectionFrame]] = {}

    for jsonl_file in detections_path.glob("*.jsonl"):
        frames = read_detection_jsonl(str(jsonl_file), rules)
        for frame in frames:
            if frame.camera_id not in all_frames:
                all_frames[frame.camera_id] = []
            all_frames[frame.camera_id].append(frame)

    return all_frames


def write_calibration_bundle(
    output_path: str,
    bundle: dict,
):
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(bundle, f, indent=2, ensure_ascii=False, default=str)


def write_failures_csv(output_path: str, failures: List[dict]):
    if not failures:
        return
    fieldnames = list(failures[0].keys())
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(failures)


def write_report_md(output_path: str, report_content: str):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_content)
