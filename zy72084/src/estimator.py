import json
import math
import os
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import copy

from .config import ParameterManager


class HoleSample:
    def __init__(self, sample_id: str, raw_data: Dict[str, Any],
                 source: str = "unknown"):
        self.sample_id = sample_id
        self.raw_data = raw_data
        self.source = source
        self.estimated_area: Optional[float] = None
        self.confidence_interval: Optional[Tuple[float, float]] = None
        self.estimation_method: Optional[str] = None
        self.processed_at: Optional[str] = None
        self.metadata: Dict[str, Any] = {}
        self.is_anomaly: bool = False
        self.anomaly_reasons: List[str] = []
        self.manual_override: Optional[float] = None
        self.manual_note: Optional[str] = None
        self.manual_operator: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "raw_data": self.raw_data,
            "source": self.source,
            "estimated_area": self.estimated_area,
            "confidence_interval": list(self.confidence_interval) if self.confidence_interval else None,
            "estimation_method": self.estimation_method,
            "processed_at": self.processed_at,
            "metadata": self.metadata,
            "is_anomaly": self.is_anomaly,
            "anomaly_reasons": self.anomaly_reasons,
            "manual_override": self.manual_override,
            "manual_note": self.manual_note,
            "manual_operator": self.manual_operator,
            "final_area": self.manual_override if self.manual_override is not None else self.estimated_area
        }


class HoleAreaEstimator:
    def __init__(self, param_manager: ParameterManager):
        self.pm = param_manager

    def estimate(self, samples: List[HoleSample]) -> List[HoleSample]:
        for sample in samples:
            self._estimate_single(sample)
        return samples

    def _estimate_single(self, sample: HoleSample) -> None:
        raw = sample.raw_data
        method = self.pm.get("hole_area_estimation.triangulation_method")
        sample.estimation_method = method
        sample.processed_at = datetime.now().isoformat()

        if "vertices" in raw and "faces" in raw:
            area = self._estimate_from_mesh(raw["vertices"], raw["faces"])
            sample.estimated_area = area
            sample.metadata["vertex_count"] = len(raw["vertices"])
            sample.metadata["face_count"] = len(raw["faces"])
        elif "contour_points" in raw:
            area = self._estimate_from_contour(raw["contour_points"])
            sample.estimated_area = area
            sample.metadata["contour_point_count"] = len(raw["contour_points"])
        elif "measured_diameter" in raw:
            area = math.pi * (raw["measured_diameter"] / 2) ** 2
            sample.estimated_area = area
            sample.metadata["estimation_method"] = "circle_from_diameter"
        elif "bounding_box" in raw:
            bb = raw["bounding_box"]
            area = bb.get("width", 0) * bb.get("height", 0)
            sample.estimated_area = area
            sample.metadata["estimation_method"] = "bounding_box"
        else:
            sample.estimated_area = self._estimate_from_statistics(raw)
            sample.estimation_method = "statistical_approximation"
            sample.metadata["warning"] = "无精确几何数据，使用统计近似"

        self._apply_smoothing(sample)
        self._calculate_confidence_interval(sample)
        self._apply_range_check(sample)

    def _estimate_from_mesh(self, vertices: List[List[float]],
                           faces: List[List[int]]) -> float:
        total_area = 0.0
        for face in faces:
            if len(face) >= 3:
                v0 = vertices[face[0]]
                v1 = vertices[face[1]]
                v2 = vertices[face[2]]
                total_area += self._triangle_area(v0, v1, v2)
        return total_area

    def _triangle_area(self, v0: List[float], v1: List[float],
                        v2: List[float]) -> float:
        if len(v0) == 3 and len(v1) == 3 and len(v2) == 3:
            ax, ay, az = v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]
            bx, by, bz = v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]
            cx = ay * bz - az * by
            cy = az * bx - ax * bz
            cz = ax * by - ay * bx
            return 0.5 * math.sqrt(cx * cx + cy * cy + cz * cz)
        else:
            return 0.0

    def _estimate_from_contour(self, points: List[List[float]]) -> float:
        n = len(points)
        if n < 3:
            return 0.0
        area = 0.0
        for i in range(n):
            x1, y1 = points[i][0], points[i][1]
            x2, y2 = points[(i + 1) % n][0], points[(i + 1) % n][1]
            area += (x1 * y2) - (x2 * y1)
        return abs(area) / 2.0

    def _estimate_from_statistics(self, raw: Dict[str, Any]) -> float:
        mean = self.pm.get("hole_area_estimation.normal_distribution_mean")
        std = self.pm.get("hole_area_estimation.normal_distribution_std")

        if "quality_score" in raw:
            quality = raw["quality_score"]
            adjustment = (quality - 0.5) * std * 0.5
            return max(0.1, mean + adjustment)
        return mean

    def _apply_smoothing(self, sample: HoleSample) -> None:
        kernel_size = self.pm.get("hole_area_estimation.smoothing_kernel_size")
        if kernel_size > 1 and sample.estimated_area:
            sample.metadata["smoothing_applied"] = kernel_size

    def _calculate_confidence_interval(self, sample: HoleSample) -> None:
        if not self.pm.get("reporting.include_confidence_interval"):
            return

        area = sample.estimated_area
        if area is None:
            return

        confidence = self.pm.get("hole_area_estimation.confidence_level")
        std = self.pm.get("hole_area_estimation.normal_distribution_std")
        quality = sample.raw_data.get("quality_score", 0.7)

        margin = std * (1.0 - quality) * 1.96
        sample.confidence_interval = (
            max(0.0, area - margin),
            area + margin
        )
        sample.metadata["confidence_level"] = confidence
        sample.metadata["quality_score_used"] = quality

    def _apply_range_check(self, sample: HoleSample) -> None:
        min_area = self.pm.get("hole_area_estimation.min_hole_area")
        max_area = self.pm.get("hole_area_estimation.max_hole_area")

        if sample.estimated_area is not None:
            if sample.estimated_area < min_area:
                sample.metadata["below_min_threshold"] = min_area
                sample.metadata["range_status"] = "below_min"
            elif sample.estimated_area > max_area:
                sample.metadata["above_max_threshold"] = max_area
                sample.metadata["range_status"] = "above_max"
            else:
                sample.metadata["range_status"] = "within_range"


def load_samples_from_file(filepath: str) -> List[HoleSample]:
    if not os.path.exists(filepath):
        return []

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    samples = []
    source = os.path.basename(filepath)

    if isinstance(data, dict) and "samples" in data:
        for item in data["samples"]:
            samples.append(HoleSample(
                sample_id=item.get("sample_id", f"auto_{len(samples)}"),
                raw_data=item.get("raw_data", item),
                source=source
            ))
    elif isinstance(data, list):
        for item in data:
            samples.append(HoleSample(
                sample_id=item.get("sample_id", f"auto_{len(samples)}"),
                raw_data=item.get("raw_data", item),
                source=source
            ))

    return samples


def load_samples_from_directory(directory: str) -> List[HoleSample]:
    samples = []
    if not os.path.exists(directory):
        for filename in sorted(os.listdir(directory)):
            if filename.endswith(".json"):
                filepath = os.path.join(directory, filename)
                samples.extend(load_samples_from_file(filepath))
    return samples


def save_results_to_dict(samples: List[HoleSample]) -> Dict[str, Any]:
    return {
        "generated_at": datetime.now().isoformat(),
        "sample_count": len(samples),
        "samples": [s.to_dict() for s in samples]
    }


def save_results(samples: List[HoleSample], output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(save_results_to_dict(samples), f, indent=2, ensure_ascii=False)
