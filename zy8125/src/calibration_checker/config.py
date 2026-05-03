import os
import yaml
from typing import Dict, List, Optional
from pathlib import Path

from .models import CameraInfo, ChessboardPattern


class CalibrationRules:
    def __init__(self, rules_path: str):
        self.rules_path = Path(rules_path)
        self.rules = self._load_rules()
        self.max_reprojection_error = self.rules.get("max_reprojection_error", 1.0)
        self.min_valid_frames = self.rules.get("min_valid_frames", 5)
        self.cameras: Dict[str, CameraInfo] = {}
        self.patterns: Dict[str, ChessboardPattern] = {}
        self._parse_cameras()
        self._parse_patterns()

    def _load_rules(self) -> dict:
        with open(self.rules_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def _parse_cameras(self):
        camera_list = self.rules.get("cameras", [])
        for cam in camera_list:
            camera_info = CameraInfo(
                camera_id=cam["camera_id"],
                serial_number=cam["serial_number"],
                model=cam["model"],
                expected_width=cam["resolution"]["width"],
                expected_height=cam["resolution"]["height"],
                expected_fx_min=cam["focal_length"]["fx_min"],
                expected_fx_max=cam["focal_length"]["fx_max"],
                expected_fy_min=cam["focal_length"]["fy_min"],
                expected_fy_max=cam["focal_length"]["fy_max"],
                expected_k1_min=cam["distortion"]["k1_min"],
                expected_k1_max=cam["distortion"]["k1_max"],
                expected_k2_min=cam["distortion"]["k2_min"],
                expected_k2_max=cam["distortion"]["k2_max"],
            )
            self.cameras[cam["camera_id"]] = camera_info

    def _parse_patterns(self):
        pattern_list = self.rules.get("patterns", [])
        for pattern in pattern_list:
            pattern_info = ChessboardPattern(
                pattern_id=pattern["pattern_id"],
                sequence_id=pattern["sequence_id"],
                camera_id=pattern["camera_id"],
                board_width=pattern["board_width"],
                board_height=pattern["board_height"],
                square_size=pattern["square_size"],
            )
            self.patterns[pattern["pattern_id"]] = pattern_info

    def get_camera(self, camera_id: str) -> Optional[CameraInfo]:
        return self.cameras.get(camera_id)

    def get_pattern(self, pattern_id: str) -> Optional[ChessboardPattern]:
        return self.patterns.get(pattern_id)

    def get_camera_by_sequence(self, sequence_id: str) -> Optional[CameraInfo]:
        for pattern in self.patterns.values():
            if pattern.sequence_id == sequence_id:
                return self.cameras.get(pattern.camera_id)
        return None

    def get_all_camera_ids(self) -> List[str]:
        return list(self.cameras.keys())

    def get_patterns_for_camera(self, camera_id: str) -> List[ChessboardPattern]:
        return [p for p in self.patterns.values() if p.camera_id == camera_id]
