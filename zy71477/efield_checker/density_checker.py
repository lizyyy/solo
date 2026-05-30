import math
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
from .data_models import Issue, IssueType, SourceInfo, FieldLine, Charge
from .electric_field import ElectricFieldCalculator
from .line_geometry import LineAnalysis


@dataclass
class DensitySample:
    position: Tuple[float, float]
    field_magnitude: float
    distance_to_nearest_line: float
    nearest_line_id: str


class DensityChecker:
    def __init__(
        self,
        field_calculator: ElectricFieldCalculator,
        density_ratio_threshold: float = 2.0,
        grid_spacing: float = 1.0,
    ):
        self.field_calculator = field_calculator
        self.density_ratio_threshold = density_ratio_threshold
        self.grid_spacing = grid_spacing

    def check_density(
        self,
        field_lines: List[FieldLine],
        line_analyses: Dict[str, LineAnalysis],
        charges: List[Charge],
    ) -> List[Issue]:
        issues = []

        if len(field_lines) < 2:
            issues.append(
                Issue(
                    issue_type=IssueType.DENSITY_MISJUDGED,
                    description="电场线数量不足，无法进行密度分析（至少需要2条）",
                    business_explanation="电场线密度是一个相对概念，需要至少2条电场线才能比较疏密。请提供更多电场线数据，或确认这是否为简化示意图。",
                    severity="warning",
                    evidence={"line_count": len(field_lines)},
                )
            )
            return issues

        bbox = self._compute_bounding_box(field_lines, charges)
        grid_samples = self._sample_grid(bbox)
        line_distances = self._compute_distance_to_lines(grid_samples, line_analyses)

        magnitude_density_correlation = self._analyze_magnitude_density_correlation(
            grid_samples, line_distances
        )

        if magnitude_density_correlation is not None:
            correlation, high_field_sparse, low_field_dense = magnitude_density_correlation

            if correlation > -0.3:
                issues.append(
                    Issue(
                        issue_type=IssueType.DENSITY_MISJUDGED,
                        description=f"电场线疏密与电场强度相关性不足（相关系数={correlation:.2f}），密度分布可能存在问题",
                        business_explanation=f"电场线的基本性质是'电场越强的地方电场线越密，电场越弱的地方电场线越疏'。计算显示电场强度与到最近电场线距离的相关系数为{correlation:.2f}（理想值应为-1.0，表示强负相关：场强越大，距离越小=越密集）。当前相关系数大于-0.3，表明学生绘制的电场线疏密分布与理论电场强度的对应关系较弱，可能没有正确理解'场强↔密度'的对应关系。",
                        severity="error",
                        evidence={
                            "correlation_coefficient": correlation,
                            "ideal_value": -1.0,
                            "threshold": -0.3,
                            "high_field_sparse_regions": high_field_sparse[:3],
                            "low_field_dense_regions": low_field_dense[:3],
                        },
                        related_objects=[line.line_id for line in field_lines],
                    )
                )

        local_issues = self._check_local_density_anomalies(
            grid_samples, line_distances
        )
        issues.extend(local_issues)

        charge_issues = self._check_density_near_charges(
            charges, line_analyses
        )
        issues.extend(charge_issues)

        return issues

    def _compute_bounding_box(
        self,
        field_lines: List[FieldLine],
        charges: List[Charge],
    ) -> Tuple[float, float, float, float]:
        all_x = []
        all_y = []

        for line in field_lines:
            for x, y in line.points:
                all_x.append(x)
                all_y.append(y)

        for charge in charges:
            x, y = charge.position
            all_x.append(x)
            all_y.append(y)

        margin = 2.0
        x_min = min(all_x) - margin
        y_min = min(all_y) - margin
        x_max = max(all_x) + margin
        y_max = max(all_y) + margin

        return (x_min, y_min, x_max, y_max)

    def _sample_grid(
        self,
        bbox: Tuple[float, float, float, float],
    ) -> List[Tuple[float, float, float]]:
        x_min, y_min, x_max, y_max = bbox
        samples = []

        x = x_min
        while x <= x_max:
            y = y_min
            while y <= y_max:
                field = self.field_calculator.calculate_at(x, y)
                if field is not None and field.magnitude > 1e-10:
                    samples.append((x, y, field.magnitude))
                y += self.grid_spacing
            x += self.grid_spacing

        return samples

    def _compute_distance_to_lines(
        self,
        grid_samples: List[Tuple[float, float, float]],
        line_analyses: Dict[str, LineAnalysis],
    ) -> List[Tuple[float, float, float, float, str]]:
        results = []

        for x, y, magnitude in grid_samples:
            min_dist = float("inf")
            nearest_line = ""

            for line_id, analysis in line_analyses.items():
                for sample in analysis.sampled_points:
                    sx, sy = sample.position
                    dx = x - sx
                    dy = y - sy
                    dist = math.sqrt(dx * dx + dy * dy)
                    if dist < min_dist:
                        min_dist = dist
                        nearest_line = line_id

            if min_dist < float("inf"):
                results.append((x, y, magnitude, min_dist, nearest_line))

        return results

    def _analyze_magnitude_density_correlation(
        self,
        grid_samples: List[Tuple[float, float, float]],
        line_distances: List[Tuple[float, float, float, float, str]],
    ) -> Optional[Tuple[float, List[Dict], List[Dict]]]:
        if len(line_distances) < 5:
            return None

        magnitudes = []
        distances = []

        for x, y, mag, dist, line_id in line_distances:
            if mag > 1e-10 and dist > 1e-10:
                magnitudes.append(math.log(mag + 1e-10))
                distances.append(dist)

        if len(magnitudes) < 5:
            return None

        n = len(magnitudes)
        mean_mag = sum(magnitudes) / n
        mean_dist = sum(distances) / n

        numerator = sum(
            (magnitudes[i] - mean_mag) * (distances[i] - mean_dist)
            for i in range(n)
        )
        denom_mag = math.sqrt(sum((m - mean_mag) ** 2 for m in magnitudes))
        denom_dist = math.sqrt(sum((d - mean_dist) ** 2 for d in distances))

        if denom_mag < 1e-10 or denom_dist < 1e-10:
            return None

        correlation = numerator / (denom_mag * denom_dist)

        high_field_sparse = []
        low_field_dense = []

        sorted_by_mag = sorted(line_distances, key=lambda x: x[2], reverse=True)
        top_25_pct = int(n * 0.25)
        bottom_25_pct = int(n * 0.75)

        for i in range(min(top_25_pct, len(sorted_by_mag))):
            x, y, mag, dist, line_id = sorted_by_mag[i]
            if dist > mean_dist * 1.5:
                high_field_sparse.append({
                    "position": (x, y),
                    "field_magnitude": mag,
                    "distance_to_nearest_line": dist,
                    "nearest_line": line_id,
                })

        for i in range(bottom_25_pct, len(sorted_by_mag)):
            x, y, mag, dist, line_id = sorted_by_mag[i]
            if dist < mean_dist * 0.5:
                low_field_dense.append({
                    "position": (x, y),
                    "field_magnitude": mag,
                    "distance_to_nearest_line": dist,
                    "nearest_line": line_id,
                })

        return correlation, high_field_sparse, low_field_dense

    def _check_local_density_anomalies(
        self,
        grid_samples: List[Tuple[float, float, float]],
        line_distances: List[Tuple[float, float, float, float, str]],
    ) -> List[Issue]:
        issues = []

        if len(line_distances) < 10:
            return issues

        magnitudes = [d[2] for d in line_distances]
        distances = [d[3] for d in line_distances]

        mean_mag = sum(magnitudes) / len(magnitudes)
        mean_dist = sum(distances) / len(distances)

        anomalies = []
        for x, y, mag, dist, line_id in line_distances:
            if mag > mean_mag * 2 and dist > mean_dist * 2:
                anomalies.append({
                    "type": "high_field_sparse",
                    "position": (x, y),
                    "field_magnitude": mag,
                    "field_magnitude_ratio": mag / mean_mag,
                    "distance_to_line": dist,
                    "distance_ratio": dist / mean_dist,
                    "nearest_line": line_id,
                })
            elif mag < mean_mag * 0.3 and dist < mean_dist * 0.3:
                anomalies.append({
                    "type": "low_field_dense",
                    "position": (x, y),
                    "field_magnitude": mag,
                    "field_magnitude_ratio": mag / mean_mag,
                    "distance_to_line": dist,
                    "distance_ratio": dist / mean_dist,
                    "nearest_line": line_id,
                })

        if len(anomalies) >= 3:
            high_count = sum(1 for a in anomalies if a["type"] == "high_field_sparse")
            low_count = sum(1 for a in anomalies if a["type"] == "low_field_dense")

            issues.append(
                Issue(
                    issue_type=IssueType.DENSITY_MISJUDGED,
                    description=f"发现 {len(anomalies)} 处局部密度异常（{high_count} 处强场区线条过疏，{low_count} 处弱场区线条过密）",
                    business_explanation=f"在{len(anomalies)}个网格点上发现电场线密度与电场强度不匹配。其中{high_count}处在电场较强区域（平均场强{mean_mag:.2f}的{self.density_ratio_threshold:.1f}倍以上），但距离最近电场线的距离是平均距离的{self.density_ratio_threshold:.1f}倍以上，说明此处电场线画得太稀疏；另有{low_count}处正好相反，电场很弱但电场线过于密集。这表明学生对'场强↔密度'的对应关系理解不准确。",
                    severity="warning",
                    evidence={
                        "anomaly_count": len(anomalies),
                        "high_field_sparse_count": high_count,
                        "low_field_dense_count": low_count,
                        "mean_field_magnitude": mean_mag,
                        "mean_distance": mean_dist,
                        "anomalies": anomalies[:5],
                    },
                    related_objects=list(set(a["nearest_line"] for a in anomalies)),
                )
            )

        return issues

    def _check_density_near_charges(
        self,
        charges: List[Charge],
        line_analyses: Dict[str, LineAnalysis],
    ) -> List[Issue]:
        issues = []

        for charge in charges:
            cx, cy = charge.position

            near_lines = []
            for line_id, analysis in line_analyses.items():
                for sample in analysis.sampled_points:
                    sx, sy = sample.position
                    dx = sx - cx
                    dy = sy - cy
                    dist = math.sqrt(dx * dx + dy * dy)
                    if dist < 3.0:
                        near_lines.append((line_id, dist))
                        break

            if charge.magnitude > 1.5 and len(near_lines) < 3:
                sign_name = "正" if charge.sign.value > 0 else "负"
                issues.append(
                    Issue(
                        issue_type=IssueType.DENSITY_MISJUDGED,
                        description=f"电量较大的{sign_name}电荷 (位置: {cx:.2f}, {cy:.2f}, 电量: {charge.magnitude:.1f}) 附近电场线数量不足（仅 {len(near_lines)} 条）",
                        business_explanation=f"根据库仑定律，电荷量越大，附近电场越强，应该有更多的电场线发出或汇入。此{sign_name}电荷电量为{charge.magnitude:.1f}（大于平均值），但半径3单位内仅有{len(near_lines)}条电场线，密度明显不足。学生可能没有考虑到'电量越大，电场线条数应越多'这一规则。",
                        severity="warning",
                        source=charge.source,
                        evidence={
                            "charge_id": charge.charge_id,
                            "charge_position": (cx, cy),
                            "charge_sign": sign_name,
                            "charge_magnitude": charge.magnitude,
                            "nearby_line_count": len(near_lines),
                            "expected_min_lines": 3,
                            "search_radius": 3.0,
                        },
                        related_objects=[charge.charge_id] + [line[0] for line in near_lines],
                    )
                )

        return issues

    def get_business_explanation(self) -> str:
        return "密度校验检查'电场强度越大，电场线越密集'这一基本规律。通过在空间中均匀采样网格点，计算每个点的电场强度与到最近电场线的距离，再用皮尔逊相关系数分析两者的关系。理想情况下相关系数应为-1（场强越大，距离越小=越密集）。相关系数高于-0.3（相关性不足）或存在3处以上局部异常时，判定为疏密误判。"

    def explain_check(self) -> str:
        parts = [
            "密度检查说明：",
            "  1. 在包含所有电荷和电场线的区域内建立网格（默认间距1.0单位）",
            "  2. 对每个网格点计算：(a) 理论电场强度 (b) 到最近电场线的距离",
            "  3. 计算电场强度的对数与距离的皮尔逊相关系数",
            "  4. 理想情况：相关系数 ≈ -1（场强越大，距离越小→越密集）",
            "  5. 异常判定：",
            f"     - 整体相关系数 > -0.3 时，判定为整体疏密颠倒",
            f"     - 存在 3 处以上局部异常（强场处过疏或弱场处过密）时，判定为局部密度误判",
            "     - 大电量电荷（>1.5）附近电场线不足3条时，判定为电荷周边密度不足",
        ]
        parts.append(
            "业务理解：电场线密度是电场强度的直观表示。"
            "学生常见错误包括：(1) 完全不考虑密度，所有区域线条均匀分布；"
            "(2) 疏密画反，强场处稀疏弱场处密集；(3) 忽略电荷量对线条数的影响。"
        )
        return "\n".join(parts)
