import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass

from models import Path, PathPoint, GridMap, RobotParams, ValidationResult, Pose
from curvature_constraints import CurvatureConstraint, CurvatureCalculation
from evidence_chain import EvidenceChain, OperationType


class PathValidator:
    def __init__(
        self,
        grid_map: GridMap,
        robot_params: RobotParams,
        evidence_chain: Optional[EvidenceChain] = None,
    ):
        self.grid_map = grid_map
        self.robot_params = robot_params
        self.curvature_constraint = CurvatureConstraint(robot_params)
        self.evidence = evidence_chain or EvidenceChain()

        self.collision_check_step = grid_map.resolution * 0.5
        self.robot_radius = robot_params.wheelbase * 0.3

    def validate(self, path: Path) -> ValidationResult:
        self.evidence.record_input_clue(
            "validate_path",
            {
                "points": len(path.points),
                "max_curvature": path.max_curvature,
                "total_length": path.total_length,
            },
            "validator",
        )

        collision_result = self._check_collisions(path)
        curvature_result = self._check_curvature_constraints(path)
        speed_result = self._check_speed_constraints(path)

        passed = (
            not collision_result
            and not curvature_result
            and not speed_result
        )

        details = []
        if passed:
            details.append("✅ 路径通过所有验证")
            details.append(f"   • 无碰撞（共检查 {len(path.points)} 个路径点）")
            details.append(f"   • 曲率均 ≤ {self.robot_params.max_curvature:.4f} 1/m")
            details.append(f"   • 速度均 ≤ {self.robot_params.max_speed:.2f} m/s")
        else:
            if collision_result:
                details.append(f"⚠️  发现 {len(collision_result)} 处碰撞")
            if curvature_result:
                details.append(f"⚠️  发现 {len(curvature_result)} 处曲率超限")
            if speed_result:
                details.append(f"⚠️  发现 {len(speed_result)} 处速度超限")

        result = ValidationResult(
            passed=passed,
            collision_points=collision_result,
            curvature_violations=curvature_result,
            speed_violations=speed_result,
            details=details,
        )

        self.evidence.record_validation_operation(
            OperationType.COLLISION_CHECK,
            {"path_points": len(path.points)},
            {"collision_count": len(collision_result)},
            f"碰撞检查完成：发现 {len(collision_result)} 处碰撞"
            if collision_result else "碰撞检查通过：无穿障点",
        )

        self.evidence.record_validation_operation(
            OperationType.CURVATURE_VALIDATION,
            {"max_curvature_allowed": self.robot_params.max_curvature},
            {"violation_count": len(curvature_result)},
            f"曲率检查完成：发现 {len(curvature_result)} 处超限"
            if curvature_result
            else f"曲率检查通过：所有点曲率 ≤ {self.robot_params.max_curvature:.4f} 1/m",
        )

        self.evidence.record_validation_operation(
            OperationType.SPEED_VALIDATION,
            {"max_speed_allowed": self.robot_params.max_speed},
            {"violation_count": len(speed_result)},
            f"速度检查完成：发现 {len(speed_result)} 处超限"
            if speed_result
            else f"速度检查通过：所有点速度 ≤ {self.robot_params.max_speed:.2f} m/s",
        )

        return result

    def _check_collisions(self, path: Path) -> List[Tuple[float, float, str]]:
        collisions = []

        for i, point in enumerate(path.points):
            pose = point.pose

            check_points = self._get_robot_check_points(pose)

            for px, py, desc in check_points:
                if self.grid_map.is_occupied(px, py):
                    gx, gy = self.grid_map.world_to_grid(px, py)
                    reason = (f"路径点 {i} 处{desc}位置 ({px:.2f}, {py:.2f}) "
                             f"与栅格 ({gx}, {gy}) 障碍物碰撞")

                    collisions.append((px, py, reason))

                    self.evidence.record_validation_operation(
                        OperationType.COLLISION_CHECK,
                        {
                            "path_index": i,
                            "world_point": (px, py),
                            "grid_cell": (gx, gy),
                            "description": desc,
                        },
                        {"collision": True},
                        reason,
                    )

        for i in range(len(path.points) - 1):
            segment_collisions = self._check_segment_collision(
                path.points[i], path.points[i + 1], i
            )
            collisions.extend(segment_collisions)

        return collisions

    def _get_robot_check_points(self, pose: Pose) -> List[Tuple[float, float, str]]:
        points = []
        x, y, theta = pose.x, pose.y, pose.theta

        points.append((x, y, "中心点"))

        corners = [
            (self.robot_radius, self.robot_radius, "右前轮"),
            (self.robot_radius, -self.robot_radius, "左前轮"),
            (-self.robot_radius, self.robot_radius, "右后轮"),
            (-self.robot_radius, -self.robot_radius, "左后轮"),
        ]

        for dx, dy, desc in corners:
            rx = x + dx * np.cos(theta) - dy * np.sin(theta)
            ry = y + dx * np.sin(theta) + dy * np.cos(theta)
            points.append((rx, ry, desc))

        return points

    def _check_segment_collision(
        self, start: PathPoint, end: PathPoint, segment_index: int
    ) -> List[Tuple[float, float, str]]:
        collisions = []

        dist = start.pose.distance_to(end.pose)
        num_steps = max(int(dist / self.collision_check_step), 1)

        for step in range(num_steps + 1):
            alpha = step / num_steps
            x = start.pose.x + alpha * (end.pose.x - start.pose.x)
            y = start.pose.y + alpha * (end.pose.y - start.pose.y)
            theta = start.pose.theta + alpha * (end.pose.theta - start.pose.theta)

            check_pose = Pose(x, y, theta)
            check_points = self._get_robot_check_points(check_pose)

            for px, py, desc in check_points:
                if self.grid_map.is_occupied(px, py):
                    gx, gy = self.grid_map.world_to_grid(px, py)
                    reason = (f"路径段 {segment_index}-{segment_index+1} 插值点 {step}/{num_steps} "
                             f"{desc}位置 ({px:.2f}, {py:.2f}) 与栅格 ({gx}, {gy}) 障碍物碰撞")

                    collisions.append((px, py, reason))

                    self.evidence.record_validation_operation(
                        OperationType.COLLISION_CHECK,
                        {
                            "segment": f"{segment_index}-{segment_index+1}",
                            "interpolation_step": f"{step}/{num_steps}",
                            "world_point": (px, py),
                            "grid_cell": (gx, gy),
                            "description": desc,
                        },
                        {"collision": True},
                        reason,
                    )

        return collisions

    def _check_curvature_constraints(
        self, path: Path
    ) -> List[Tuple[int, float, float]]:
        violations = []
        max_curvature = self.robot_params.max_curvature

        for i in range(1, len(path.points)):
            prev = path.points[i - 1]
            curr = path.points[i]

            delta_s = prev.pose.distance_to(curr.pose)

            calc = self.curvature_constraint.calculate_curvature_from_path(
                prev.pose, curr.pose, delta_s
            )
            curvature = abs(calc.result)

            self.evidence.record_curvature_calculation(
                OperationType.PATH_CURVATURE_CALC, calc
            )

            if curvature > max_curvature + 1e-8:
                violations.append((i, curvature, max_curvature))

                self.evidence.record_validation_operation(
                    OperationType.CURVATURE_VALIDATION,
                    {
                        "path_index": i,
                        "calculated_curvature": curvature,
                        "max_allowed": max_curvature,
                        "delta_s": delta_s,
                        "delta_theta_deg": np.degrees(abs(curr.pose.theta - prev.pose.theta)),
                    },
                    {"violation": True, "excess": curvature - max_curvature},
                    f"曲率超限：路径点 {i} 处曲率 {curvature:.4f} 1/m > 最大允许 "
                    f"{max_curvature:.4f} 1/m，超出 {curvature - max_curvature:.4f} 1/m，"
                    f"对应最小转弯半径 {1.0/curvature:.2f}m < {self.robot_params.min_turning_radius:.2f}m",
                )

        for i, point in enumerate(path.points):
            point_curvature = abs(point.curvature)
            if point_curvature > max_curvature + 1e-8:
                already_recorded = any(v[0] == i for v in violations)
                if not already_recorded:
                    violations.append((i, point_curvature, max_curvature))

                    self.evidence.record_validation_operation(
                        OperationType.CURVATURE_VALIDATION,
                        {
                            "path_index": i,
                            "point_curvature": point_curvature,
                            "max_allowed": max_curvature,
                        },
                        {"violation": True, "excess": point_curvature - max_curvature},
                        f"曲率超限（点属性）：路径点 {i} 存储曲率 {point_curvature:.4f} 1/m > "
                        f"最大允许 {max_curvature:.4f} 1/m",
                    )

        return violations

    def _check_speed_constraints(
        self, path: Path
    ) -> List[Tuple[int, float, float]]:
        violations = []
        max_speed = self.robot_params.max_speed

        for i, point in enumerate(path.points):
            speed = point.speed

            expected_speed_calc = self.curvature_constraint.calculate_speed_for_curvature(
                point.curvature
            )
            expected_speed = expected_speed_calc.result

            self.evidence.record_curvature_calculation(
                OperationType.SPEED_FOR_CURVATURE, expected_speed_calc
            )

            if speed > max_speed + 1e-8:
                violations.append((i, speed, max_speed))

                self.evidence.record_validation_operation(
                    OperationType.SPEED_VALIDATION,
                    {
                        "path_index": i,
                        "actual_speed": speed,
                        "max_allowed": max_speed,
                        "curvature": point.curvature,
                        "expected_speed": expected_speed,
                    },
                    {"violation": True, "excess": speed - max_speed},
                    f"速度超限：路径点 {i} 速度 {speed:.2f} m/s > 最大允许 {max_speed:.2f} m/s，"
                    f"超出 {speed - max_speed:.2f} m/s。该点曲率 {point.curvature:.4f} 1/m "
                    f"对应允许速度应为 {expected_speed:.2f} m/s",
                )
            elif abs(speed - expected_speed) > 0.1 and expected_speed > 1e-3:
                self.evidence.record_validation_operation(
                    OperationType.SPEED_VALIDATION,
                    {
                        "path_index": i,
                        "actual_speed": speed,
                        "expected_speed": expected_speed,
                        "curvature": point.curvature,
                    },
                    {"speed_mismatch": True, "diff": abs(speed - expected_speed)},
                    f"速度与曲率不匹配警告：路径点 {i} 速度 {speed:.2f} m/s 与曲率对应速度 "
                    f"{expected_speed:.2f} m/s 相差 {abs(speed - expected_speed):.2f} m/s，"
                    f"可能是版本更新导致速度约束丢失",
                )

        return violations

    def get_human_readable_report(self, result: ValidationResult) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("📋 路径验证报告")
        lines.append("=" * 60)

        if result.passed:
            lines.append("\n✅ 验证通过：路径无碰撞、曲率超限和速度问题")
        else:
            lines.append("\n❌ 验证失败：发现以下问题")

        if result.collision_points:
            lines.append(f"\n⚠️  碰撞问题（{len(result.collision_points)} 处）：")
            for i, (px, py, reason) in enumerate(result.collision_points[:5], 1):
                lines.append(f"   {i}. {reason}")
            if len(result.collision_points) > 5:
                lines.append(f"   ... 还有 {len(result.collision_points) - 5} 处碰撞")

        if result.curvature_violations:
            lines.append(f"\n⚠️  曲率超限（{len(result.curvature_violations)} 处）：")
            for i, (idx, curv, max_curv) in enumerate(result.curvature_violations[:5], 1):
                min_r = 1.0 / curv if curv > 1e-8 else float('inf')
                allowed_min_r = self.robot_params.min_turning_radius
                lines.append(
                    f"   {i}. 点{idx}: 曲率 {curv:.4f} 1/m > 限制 {max_curv:.4f} 1/m，"
                    f"转弯半径 {min_r:.2f}m < 允许 {allowed_min_r:.2f}m"
                )
            if len(result.curvature_violations) > 5:
                lines.append(f"   ... 还有 {len(result.curvature_violations) - 5} 处曲率超限")

        if result.speed_violations:
            lines.append(f"\n⚠️  速度超限（{len(result.speed_violations)} 处）：")
            for i, (idx, speed, max_speed) in enumerate(result.speed_violations[:5], 1):
                lines.append(
                    f"   {i}. 点{idx}: 速度 {speed:.2f} m/s > 限制 {max_speed:.2f} m/s，"
                    f"超出 {speed - max_speed:.2f} m/s"
                )
            if len(result.speed_violations) > 5:
                lines.append(f"   ... 还有 {len(result.speed_violations) - 5} 处速度超限")

        lines.append("\n📐 机器人参数参考：")
        lines.append(f"   轴距 L = {self.robot_params.wheelbase:.2f} m")
        lines.append(f"   最大转向角 δ_max = {np.degrees(self.robot_params.max_steering_angle):.1f}°")
        lines.append(f"   最小转弯半径 R_min = {self.robot_params.min_turning_radius:.2f} m")
        lines.append(f"   最大曲率 κ_max = {self.robot_params.max_curvature:.4f} 1/m")
        lines.append(f"   最大速度 v_max = {self.robot_params.max_speed:.2f} m/s")

        lines.append("\n" + "=" * 60)
        return "\n".join(lines)

    def explain_why_needed(self) -> str:
        reasons = [
            "🤖 为什么要验证这些？",
            "",
            "1. 碰撞检查：",
            "   机器人有物理尺寸（轴距 {:.2f}m，半径约 {:.2f}m），".format(
                self.robot_params.wheelbase, self.robot_radius
            ),
            "   不能只看中心点，还要检查四个角，插值检查是因为",
            "   路径点之间可能穿过障碍物。",
            "",
            "2. 曲率检查：",
            "   最小转弯半径 {:.2f}m 限制了最大曲率 {:.4f} 1/m，".format(
                self.robot_params.min_turning_radius, self.robot_params.max_curvature
            ),
            "   超过这个值机器人根本转不过来，就像汽车不能原地掉头。",
            "",
            "3. 速度检查：",
            "   转弯越急（曲率越大），速度必须越慢，否则会侧翻或失控。",
            "   这里用 v(κ) = v_max * (1 - κ/κ_max) 来计算允许速度。",
        ]
        return "\n".join(reasons)
