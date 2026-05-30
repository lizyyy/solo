import math
from typing import List, Tuple, Optional, Dict
from .data_models import Issue, IssueType, SourceInfo, FieldLine, Charge
from .line_geometry import LineAnalysis, SampledPoint


class LineTraversalChecker:
    def __init__(
        self,
        charge_radius: float = 0.3,
        entry_exit_margin: float = 0.5,
    ):
        self.charge_radius = charge_radius
        self.entry_exit_margin = entry_exit_margin

    def check_line_traversal(
        self,
        field_line: FieldLine,
        line_analysis: LineAnalysis,
        charges: List[Charge],
    ) -> List[Issue]:
        issues = []

        for charge in charges:
            charge_issues = self._check_line_vs_charge(
                field_line, line_analysis, charge
            )
            issues.extend(charge_issues)

        return issues

    def _check_line_vs_charge(
        self,
        field_line: FieldLine,
        line_analysis: LineAnalysis,
        charge: Charge,
    ) -> List[Issue]:
        issues = []
        cx, cy = charge.position

        points_inside = []
        points_near = []

        for i, sample in enumerate(line_analysis.sampled_points):
            sx, sy = sample.position
            dx = sx - cx
            dy = sy - cy
            dist = math.sqrt(dx * dx + dy * dy)

            if dist < self.charge_radius:
                points_inside.append((i, sample, dist))
            elif dist < self.charge_radius + self.entry_exit_margin:
                points_near.append((i, sample, dist))

        start_dist = math.sqrt(
            (line_analysis.start_point[0] - cx) ** 2
            + (line_analysis.start_point[1] - cy) ** 2
        )
        end_dist = math.sqrt(
            (line_analysis.end_point[0] - cx) ** 2
            + (line_analysis.end_point[1] - cy) ** 2
        )

        starts_at_charge = start_dist < self.charge_radius + self.entry_exit_margin
        ends_at_charge = end_dist < self.charge_radius + self.entry_exit_margin

        sign_name = "正" if charge.sign.value > 0 else "负"

        if points_inside and not (starts_at_charge or ends_at_charge):
            crossing_indices = [i for i, _, _ in points_inside]
            first_cross = min(crossing_indices)
            last_cross = max(crossing_indices)

            enters_from_outside = first_cross > 0
            exits_to_outside = last_cross < len(line_analysis.sampled_points) - 1

            if enters_from_outside and exits_to_outside:
                min_dist = min(d for _, _, d in points_inside)
                issues.append(
                    Issue(
                        issue_type=IssueType.LINE_TRAVERSES_CHARGE,
                        description=f"电场线 {field_line.line_id} 穿过{sign_name}电荷 (位置: {cx:.2f}, {cy:.2f})，这是不允许的",
                        business_explanation=f"电场线的基本规则是：电场线只能'始于正电荷、终于负电荷'，绝对不能穿过电荷内部。此电场线在采样点 {first_cross} 到 {last_cross} 之间进入了电荷半径 {self.charge_radius:.1f} 范围内（最近距离 {min_dist:.2f}），并且从另一侧穿出。这违反了电场线的基本性质，通常是学生没有理解'电荷是电场线的源或汇'这一概念。",
                        severity="error",
                        source=field_line.source,
                        evidence={
                            "line_id": field_line.line_id,
                            "charge_id": charge.charge_id,
                            "charge_position": (cx, cy),
                            "charge_sign": sign_name,
                            "charge_radius": self.charge_radius,
                            "traversal_type": "full_traversal",
                            "entry_sample_index": first_cross,
                            "exit_sample_index": last_cross,
                            "penetration_depth": self.charge_radius - min_dist,
                            "crossing_points": [
                                {
                                    "sample_index": i,
                                    "position": s.position,
                                    "distance_to_charge": d,
                                }
                                for i, s, d in points_inside[:5]
                            ],
                        },
                        related_objects=[field_line.line_id, charge.charge_id],
                    )
                )
            elif enters_from_outside:
                issues.append(
                    Issue(
                        issue_type=IssueType.LINE_TRAVERSES_CHARGE,
                        description=f"电场线 {field_line.line_id} 进入{sign_name}电荷内部但未穿出，可能绘制错误",
                        business_explanation=f"电场线只能终止于电荷表面，不应深入电荷内部。此电场线有 {len(points_inside)} 个采样点进入了{sign_name}电荷半径 {self.charge_radius:.1f} 范围内，但没有从另一侧穿出。如果这是要表示终止于电荷，请确保线条终点在电荷表面附近，而不是深入内部。",
                        severity="warning",
                        source=field_line.source,
                        evidence={
                            "line_id": field_line.line_id,
                            "charge_id": charge.charge_id,
                            "charge_position": (cx, cy),
                            "charge_sign": sign_name,
                            "traversal_type": "enters_only",
                            "points_inside_count": len(points_inside),
                            "crossing_points": [
                                {
                                    "sample_index": i,
                                    "position": s.position,
                                    "distance_to_charge": d,
                                }
                                for i, s, d in points_inside[:5]
                            ],
                        },
                        related_objects=[field_line.line_id, charge.charge_id],
                    )
                )

        elif points_inside and (starts_at_charge or ends_at_charge):
            deep_points = [
                (i, s, d) for i, s, d in points_inside
                if d < self.charge_radius * 0.5
            ]
            if deep_points:
                issues.append(
                    Issue(
                        issue_type=IssueType.LINE_TRAVERSES_CHARGE,
                        description=f"电场线 {field_line.line_id} 起止点在{sign_name}电荷处，但深入电荷内部过多",
                        business_explanation=f"即使电场线从{sign_name}电荷出发或终止，线条也应从电荷表面开始/结束，而不是深入电荷内部。此电场线有 {len(deep_points)} 个采样点深入到电荷半径的50%以内（最深达 {min(d for _,_,d in deep_points):.2f}）。这可能是坐标点定位不准确导致的。",
                        severity="warning",
                        source=field_line.source,
                        evidence={
                            "line_id": field_line.line_id,
                            "charge_id": charge.charge_id,
                            "charge_position": (cx, cy),
                            "charge_sign": sign_name,
                            "charge_radius": self.charge_radius,
                            "traversal_type": "deep_start_or_end",
                            "deep_point_count": len(deep_points),
                            "min_distance": min(d for _, _, d in deep_points),
                            "deep_points": [
                                {
                                    "sample_index": i,
                                    "position": s.position,
                                    "distance_to_charge": d,
                                }
                                for i, s, d in deep_points[:5]
                            ],
                        },
                        related_objects=[field_line.line_id, charge.charge_id],
                    )
                )

        else:
            segments_crossing = self._check_segment_intersections(
                field_line.points, charge
            )
            if segments_crossing:
                issues.append(
                    Issue(
                        issue_type=IssueType.LINE_TRAVERSES_CHARGE,
                        description=f"电场线 {field_line.line_id} 的线段穿过{sign_name}电荷边界",
                        business_explanation=f"虽然采样点未检测到明显穿越，但电场线的某段线段精确穿过了{sign_name}电荷的边界（半径 {self.charge_radius:.1f}）。在 {len(segments_crossing)} 处线段与电荷圆相交。电场线不应穿过电荷，这可能是绘制时的坐标点间距过大导致采样未检测到。",
                        severity="warning",
                        source=field_line.source,
                        evidence={
                            "line_id": field_line.line_id,
                            "charge_id": charge.charge_id,
                            "charge_position": (cx, cy),
                            "charge_sign": sign_name,
                            "charge_radius": self.charge_radius,
                            "traversal_type": "segment_crossing",
                            "crossing_segments": [
                                {
                                    "segment_index": idx,
                                    "segment_points": (p1, p2),
                                    "intersection_type": itype,
                                }
                                for idx, p1, p2, itype in segments_crossing[:5]
                            ],
                        },
                        related_objects=[field_line.line_id, charge.charge_id],
                    )
                )

        return issues

    def _check_segment_intersections(
        self,
        points: List[Tuple[float, float]],
        charge: Charge,
    ) -> List[Tuple[int, Tuple[float, float], Tuple[float, float], str]]:
        crossings = []
        cx, cy = charge.position
        r = self.charge_radius

        for i in range(len(points) - 1):
            p1 = points[i]
            p2 = points[i + 1]

            (x1, y1), (x2, y2) = p1, p2

            d1 = math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2)
            d2 = math.sqrt((x2 - cx) ** 2 + (y2 - cy) ** 2)

            dx = x2 - x1
            dy = y2 - y1
            fx = x1 - cx
            fy = y1 - cy

            a = dx * dx + dy * dy
            b = 2 * (fx * dx + fy * dy)
            c = fx * fx + fy * fy - r * r

            discriminant = b * b - 4 * a * c

            if discriminant >= 0:
                disc_sqrt = math.sqrt(discriminant)
                t1 = (-b - disc_sqrt) / (2 * a)
                t2 = (-b + disc_sqrt) / (2 * a)

                intersections = []
                if 0 <= t1 <= 1:
                    intersections.append(t1)
                if 0 <= t2 <= 1:
                    intersections.append(t2)

                if len(intersections) == 2:
                    crossings.append((i, p1, p2, "entry_and_exit"))
                elif len(intersections) == 1:
                    if d1 < r and d2 >= r:
                        crossings.append((i, p1, p2, "exit"))
                    elif d1 >= r and d2 < r:
                        crossings.append((i, p1, p2, "entry"))

        return crossings

    def get_business_explanation(self) -> str:
        return "线条穿电荷检测基于'电场线不能穿过电荷'这一基本电磁学规则。通过检查电场线的采样点和线段是否进入电荷的半径范围（默认0.3单位）来判断。如果一条电场线从电荷的一侧进入、另一侧穿出，则判定为严重错误；如果只是起点/终点靠近电荷但深入过多，则为警告。"

    def explain_check(self) -> str:
        parts = [
            "线条穿电荷检查说明：",
            f"  1. 电荷半径阈值：{self.charge_radius:.1f} 单位（可调）",
            f"  2. 起止点容差：{self.entry_exit_margin:.1f} 单位（用于判断是否从电荷出发/终止）",
            "  3. 两级检查：",
            "     (a) 采样点检查：沿电场线的等间距采样点是否进入电荷半径内",
            "     (b) 线段相交检查：电场线的每一段线段是否与电荷圆相交",
            "  4. 判定规则：",
            "     - 线条从一侧进入、另一侧穿出 → 严重错误（full_traversal）",
            "     - 线条进入电荷但未穿出 → 警告（enters_only）",
            "     - 起止点在电荷处但深入过多 → 警告（deep_start_or_end）",
            "     - 线段与电荷边界相交但采样未捕获 → 警告（segment_crossing）",
        ]
        parts.append(
            "业务理解：电场线只能'始于正电荷、终于负电荷'，电荷是电场线的'源'和'汇'。"
            "学生常见错误是把电场线画成穿过电荷的连续曲线，这表明没有理解电场线的本质。"
            "对于从电荷出发的线条，应确保起点在电荷表面附近，而不是深入内部。"
        )
        return "\n".join(parts)
