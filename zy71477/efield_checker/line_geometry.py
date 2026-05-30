import math
from typing import List, Tuple, Optional
from dataclasses import dataclass
from .data_models import FieldLine


@dataclass
class SampledPoint:
    position: Tuple[float, float]
    tangent_direction: Tuple[float, float]
    segment_index: int
    distance_from_start: float
    curvature: float = 0.0

    def to_dict(self):
        return {
            "position": self.position,
            "tangent_direction": self.tangent_direction,
            "segment_index": self.segment_index,
            "distance_from_start": self.distance_from_start,
            "curvature": self.curvature,
        }


@dataclass
class LineAnalysis:
    line_id: str
    total_length: float
    sampled_points: List[SampledPoint]
    start_point: Tuple[float, float]
    end_point: Tuple[float, float]
    bounding_box: Tuple[float, float, float, float]

    def to_dict(self):
        return {
            "line_id": self.line_id,
            "total_length": self.total_length,
            "start_point": self.start_point,
            "end_point": self.end_point,
            "bounding_box": {
                "x_min": self.bounding_box[0],
                "y_min": self.bounding_box[1],
                "x_max": self.bounding_box[2],
                "y_max": self.bounding_box[3],
            },
            "sampled_points": [p.to_dict() for p in self.sampled_points],
        }


class LineGeometryAnalyzer:
    def __init__(self, sampling_distance: float = 0.5):
        self.sampling_distance = sampling_distance

    def analyze_line(self, field_line: FieldLine) -> LineAnalysis:
        points = field_line.points
        line_id = field_line.line_id

        total_length = self._calculate_total_length(points)

        sampled_points = self._sample_line(points, total_length)

        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        bounding_box = (min(x_coords), min(y_coords), max(x_coords), max(y_coords))

        return LineAnalysis(
            line_id=line_id,
            total_length=total_length,
            sampled_points=sampled_points,
            start_point=points[0],
            end_point=points[-1],
            bounding_box=bounding_box,
        )

    def _calculate_total_length(self, points: List[Tuple[float, float]]) -> float:
        total = 0.0
        for i in range(len(points) - 1):
            dx = points[i + 1][0] - points[i][0]
            dy = points[i + 1][1] - points[i][1]
            total += math.sqrt(dx * dx + dy * dy)
        return total

    def _sample_line(
        self,
        points: List[Tuple[float, float]],
        total_length: float,
    ) -> List[SampledPoint]:
        if total_length < 1e-10:
            return []

        sampled = []
        num_samples = max(2, int(math.ceil(total_length / self.sampling_distance)))
        step = total_length / (num_samples - 1) if num_samples > 1 else total_length

        for i in range(num_samples):
            target_distance = i * step
            sample = self._get_point_at_distance(points, target_distance)
            if sample:
                sampled.append(sample)

        self._calculate_curvature(sampled)

        return sampled

    def _get_point_at_distance(
        self,
        points: List[Tuple[float, float]],
        target_distance: float,
    ) -> Optional[SampledPoint]:
        accumulated = 0.0

        for seg_idx in range(len(points) - 1):
            p1 = points[seg_idx]
            p2 = points[seg_idx + 1]

            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            seg_length = math.sqrt(dx * dx + dy * dy)

            if seg_length < 1e-10:
                continue

            if accumulated + seg_length >= target_distance:
                remaining = target_distance - accumulated
                t = remaining / seg_length

                x = p1[0] + t * dx
                y = p1[1] + t * dy

                tangent_norm = seg_length
                tx = dx / tangent_norm
                ty = dy / tangent_norm

                return SampledPoint(
                    position=(x, y),
                    tangent_direction=(tx, ty),
                    segment_index=seg_idx,
                    distance_from_start=target_distance,
                )

            accumulated += seg_length

        last_idx = len(points) - 1
        if last_idx >= 1:
            p1 = points[last_idx - 1]
            p2 = points[last_idx]
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            seg_length = math.sqrt(dx * dx + dy * dy)
            if seg_length > 1e-10:
                return SampledPoint(
                    position=p2,
                    tangent_direction=(dx / seg_length, dy / seg_length),
                    segment_index=last_idx - 1,
                    distance_from_start=accumulated,
                )

        return None

    def _calculate_curvature(self, sampled_points: List[SampledPoint]):
        n = len(sampled_points)
        if n < 3:
            return

        for i in range(1, n - 1):
            prev = sampled_points[i - 1].position
            curr = sampled_points[i].position
            next_p = sampled_points[i + 1].position

            dx1 = curr[0] - prev[0]
            dy1 = curr[1] - prev[1]
            dx2 = next_p[0] - curr[0]
            dy2 = next_p[1] - curr[1]

            len1 = math.sqrt(dx1 * dx1 + dy1 * dy1)
            len2 = math.sqrt(dx2 * dx2 + dy2 * dy2)

            if len1 < 1e-10 or len2 < 1e-10:
                sampled_points[i].curvature = 0.0
                continue

            tx1, ty1 = dx1 / len1, dy1 / len1
            tx2, ty2 = dx2 / len2, dy2 / len2

            cross = tx1 * ty2 - ty1 * tx2
            dot = tx1 * tx2 + ty1 * ty2

            curvature = abs(cross) / ((len1 + len2) / 2) if abs(cross) > 1e-10 else 0.0

            sampled_points[i].curvature = curvature

    def get_business_explanation(self) -> str:
        return "电场线采样按等间距方式沿学生绘制的路径取点，计算每点的切线方向。采样密度可配置，默认每0.5单位长度取一个样本点。切线方向用于与理论电场方向比较，判断方向是否颠倒。"

    def explain_sampling(self, line_analysis: LineAnalysis) -> str:
        parts = [
            f"电场线 {line_analysis.line_id} 几何分析：",
            f"  - 总长度: {line_analysis.total_length:.2f} 单位",
            f"  - 采样点数: {len(line_analysis.sampled_points)} 个",
            f"  - 采样间距: 约 {self.sampling_distance:.2f} 单位",
            f"  - 起点: ({line_analysis.start_point[0]:.2f}, {line_analysis.start_point[1]:.2f})",
            f"  - 终点: ({line_analysis.end_point[0]:.2f}, {line_analysis.end_point[1]:.2f})",
        ]
        parts.append(
            "判断规则：采样点的切线方向代表学生绘制的电场线走向，应与该位置的理论电场方向基本一致。"
            "如偏差超过90°，说明方向可能画反了。"
        )
        return "\n".join(parts)
