import math
from typing import List, Tuple, Optional
from .data_models import Issue, IssueType, SourceInfo, FieldLine, Arrow
from .electric_field import ElectricFieldCalculator
from .line_geometry import LineAnalysis, LineGeometryAnalyzer


class DirectionChecker:
    def __init__(
        self,
        field_calculator: ElectricFieldCalculator,
        geometry_analyzer: LineGeometryAnalyzer,
        angle_threshold_degrees: float = 90.0,
        min_confidence_ratio: float = 0.6,
    ):
        self.field_calculator = field_calculator
        self.geometry_analyzer = geometry_analyzer
        self.angle_threshold = math.radians(angle_threshold_degrees)
        self.min_confidence_ratio = min_confidence_ratio

    def check_line_direction(
        self,
        field_line: FieldLine,
        line_analysis: LineAnalysis,
    ) -> List[Issue]:
        issues = []

        arrow_issues = self._check_arrows(field_line)
        issues.extend(arrow_issues)

        tangent_issues = self._check_tangent_directions(field_line, line_analysis)
        issues.extend(tangent_issues)

        overall_issue = self._assess_overall_direction(field_line, line_analysis)
        if overall_issue:
            issues.append(overall_issue)

        return issues

    def _check_arrows(self, field_line: FieldLine) -> List[Issue]:
        issues = []

        for arrow in field_line.arrows:
            ax, ay = arrow.position
            adx, ady = arrow.direction

            expected_dir = self.field_calculator.get_expected_direction_at(ax, ay)

            if expected_dir is None:
                issues.append(
                    Issue(
                        issue_type=IssueType.DIRECTION_REVERSED,
                        description=f"箭头 {arrow.arrow_id} 位于电荷位置或零场点，无法判断方向",
                        business_explanation="该箭头正好画在电荷所在位置或电场相互抵消的零场点，理论上电场方向无定义。请确认箭头位置是否准确。",
                        severity="warning",
                        source=arrow.source,
                        evidence={
                            "arrow_id": arrow.arrow_id,
                            "position": (ax, ay),
                            "direction": (adx, ady),
                        },
                        related_objects=[arrow.arrow_id, field_line.line_id],
                    )
                )
                continue

            arrow_mag = math.sqrt(adx * adx + ady * ady)
            if arrow_mag < 1e-10:
                continue

            adx_norm = adx / arrow_mag
            ady_norm = ady / arrow_mag

            edx, edy = expected_dir

            dot_product = adx_norm * edx + ady_norm * edy
            angle = math.acos(max(-1.0, min(1.0, dot_product)))
            angle_deg = math.degrees(angle)

            if angle > self.angle_threshold:
                issues.append(
                    Issue(
                        issue_type=IssueType.DIRECTION_REVERSED,
                        description=f"箭头 {arrow.arrow_id} 方向与理论电场方向偏差 {angle_deg:.1f}°，可能方向画反",
                        business_explanation=f"电场线箭头应指向电场方向。此处理论电场方向为 ({edx:.2f}, {edy:.2f})，与x轴夹角 {math.degrees(math.atan2(edy, edx)):.1f}°；学生箭头方向为 ({adx_norm:.2f}, {ady_norm:.2f})，夹角 {math.degrees(math.atan2(ady_norm, adx_norm)):.1f}°。两者偏差超过{math.degrees(self.angle_threshold):.0f}°阈值，很可能是正/负电荷的方向理解反了。",
                        severity="error",
                        source=arrow.source,
                        evidence={
                            "arrow_id": arrow.arrow_id,
                            "position": (ax, ay),
                            "student_direction": (adx_norm, ady_norm),
                            "expected_direction": (edx, edy),
                            "angle_deviation_deg": angle_deg,
                            "threshold_deg": math.degrees(self.angle_threshold),
                        },
                        related_objects=[arrow.arrow_id, field_line.line_id],
                    )
                )

        return issues

    def _check_tangent_directions(
        self,
        field_line: FieldLine,
        line_analysis: LineAnalysis,
    ) -> List[Issue]:
        issues = []
        reversed_count = 0
        total_valid = 0
        reversed_segments = []

        for sample in line_analysis.sampled_points:
            sx, sy = sample.position
            tdx, tdy = sample.tangent_direction

            expected_dir = self.field_calculator.get_expected_direction_at(sx, sy)
            if expected_dir is None:
                continue

            edx, edy = expected_dir

            dot_product = tdx * edx + tdy * edy
            angle = math.acos(max(-1.0, min(1.0, dot_product)))
            angle_deg = math.degrees(angle)

            total_valid += 1

            if angle > self.angle_threshold:
                reversed_count += 1
                reversed_segments.append({
                    "position": (sx, sy),
                    "distance_from_start": sample.distance_from_start,
                    "angle_deviation_deg": angle_deg,
                    "tangent_direction": (tdx, tdy),
                    "expected_direction": (edx, edy),
                })

        if total_valid == 0:
            return issues

        reversed_ratio = reversed_count / total_valid

        if reversed_ratio >= self.min_confidence_ratio and reversed_count >= 3:
            issues.append(
                Issue(
                    issue_type=IssueType.DIRECTION_REVERSED,
                    description=f"电场线 {field_line.line_id} 整体方向可能颠倒：{reversed_count}/{total_valid} 个采样点方向偏差超过{math.degrees(self.angle_threshold):.0f}°",
                    business_explanation=f"沿电场线采样的{total_valid}个点中，有{reversed_count}个点（占比{reversed_ratio*100:.0f}%）的切线方向与理论电场方向相反。这表明整条电场线可能是从负电荷指向正电荷画的，正好与实际电场方向（正电荷→负电荷）相反。请检查是否混淆了正负电荷的电场线走向。",
                    severity="error",
                    source=field_line.source,
                    evidence={
                        "line_id": field_line.line_id,
                        "reversed_count": reversed_count,
                        "total_valid": total_valid,
                        "reversed_ratio": reversed_ratio,
                        "threshold_ratio": self.min_confidence_ratio,
                        "reversed_segments": reversed_segments[:5],
                    },
                    related_objects=[field_line.line_id],
                )
            )

        return issues

    def _assess_overall_direction(
        self,
        field_line: FieldLine,
        line_analysis: LineAnalysis,
    ) -> Optional[Issue]:
        start_pt = line_analysis.start_point
        end_pt = line_analysis.end_point

        start_field = self.field_calculator.calculate_at(start_pt[0], start_pt[1])
        end_field = self.field_calculator.calculate_at(end_pt[0], end_pt[1])

        if start_field is None or end_field is None:
            return None

        line_dir_x = end_pt[0] - start_pt[0]
        line_dir_y = end_pt[1] - start_pt[1]
        line_mag = math.sqrt(line_dir_x * line_dir_x + line_dir_y * line_dir_y)

        if line_mag < 1e-10:
            return None

        line_dir_x /= line_mag
        line_dir_y /= line_mag

        start_dot = line_dir_x * start_field.ex + line_dir_y * start_field.ey
        end_dot = line_dir_x * end_field.ex + line_dir_y * end_field.ey

        if start_dot < 0 and end_dot < 0:
            start_mag = start_field.magnitude
            end_mag = end_field.magnitude

            return Issue(
                issue_type=IssueType.DIRECTION_REVERSED,
                description=f"电场线 {field_line.line_id} 起止点方向均与电场方向相反",
                business_explanation=f"从起点({start_pt[0]:.2f}, {start_pt[1]:.2f})指向终点({end_pt[0]:.2f}, {end_pt[1]:.2f})的连线方向，与起点处电场方向点积为{start_dot:.2f}，与终点处电场方向点积为{end_dot:.2f}，两者均为负值。起点电场强度{start_mag:.2f}，终点电场强度{end_mag:.2f}。这强烈暗示整条线方向画反了——电场线应从场强大处指向场强小处（正电荷出发，负电荷终止）。",
                severity="error",
                source=field_line.source,
                evidence={
                    "line_id": field_line.line_id,
                    "start_point": start_pt,
                    "end_point": end_pt,
                    "line_direction": (line_dir_x, line_dir_y),
                    "start_field_dot": start_dot,
                    "end_field_dot": end_dot,
                    "start_field_magnitude": start_mag,
                    "end_field_magnitude": end_mag,
                },
                related_objects=[field_line.line_id],
            )

        return None

    def get_business_explanation(self) -> str:
        return "方向校验比较学生绘制的箭头方向、电场线切线方向与理论电场方向的一致性。使用向量点积计算夹角，超过90°判定为方向可能相反。当超过60%的采样点都显示反向时，判定为整条线方向颠倒。"

    def explain_check(self, field_line: FieldLine) -> str:
        parts = [
            f"方向检查说明（电场线 {field_line.line_id}）：",
            "  1. 箭头方向检查：将每个箭头的方向向量与该位置理论电场方向比较",
            "  2. 切线方向检查：沿电场线等间距采样，每点计算切线方向与理论方向的夹角",
            f"  3. 判定阈值：夹角 > {math.degrees(self.angle_threshold):.0f}° 视为异常",
            f"  4. 整体判定：异常采样点比例 ≥ {self.min_confidence_ratio*100:.0f}% 且数量 ≥ 3 时，判定整条线方向反转",
        ]
        parts.append(
            "业务理解：电场线方向规则是'从正电荷出发，终止于负电荷'。"
            "学生常见错误是把方向画反（从负到正），这通常是对'电场方向是正电荷受力方向'这一概念理解有误。"
        )
        return "\n".join(parts)
