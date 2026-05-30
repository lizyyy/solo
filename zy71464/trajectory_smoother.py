import numpy as np
from typing import List, Tuple, Optional
from scipy.ndimage import gaussian_filter1d

from models import Path, PathPoint, Pose, RobotParams, GridMap
from curvature_constraints import CurvatureConstraint, CurvatureCalculation
from evidence_chain import EvidenceChain, OperationType


class TrajectorySmoother:
    def __init__(
        self,
        robot_params: RobotParams,
        grid_map: Optional[GridMap] = None,
        evidence_chain: Optional[EvidenceChain] = None,
    ):
        self.robot_params = robot_params
        self.grid_map = grid_map
        self.curvature_constraint = CurvatureConstraint(robot_params)
        self.evidence = evidence_chain or EvidenceChain()

        self.max_iterations = 50
        self.smoothness_weight = 0.3
        self.curvature_weight = 0.4
        self.length_weight = 0.2
        self.collision_weight = 0.5

    def smooth(self, path: Path) -> Path:
        if len(path.points) < 3:
            self.evidence.record_smoothing_operation(
                0,
                {"path_length": len(path.points)},
                {"smoothed": False},
                "路径点不足3个，跳过平滑",
            )
            return path

        self.evidence.record_input_clue(
            "original_path",
            {"points": len(path.points), "max_curvature": path.max_curvature, "length": path.total_length},
            "planner",
        )

        points = np.array([
            [p.pose.x, p.pose.y, p.pose.theta]
            for p in path.points
        ])
        original_points = points.copy()

        for iteration in range(self.max_iterations):
            old_points = points.copy()

            forces = self._compute_forces(points, original_points)
            points = points + forces

            for i in range(1, len(points) - 1):
                dx = points[i + 1, 0] - points[i, 0]
                dy = points[i + 1, 1] - points[i, 1]
                points[i, 2] = np.arctan2(dy, dx)

            max_change = np.max(np.abs(points - old_points))

            curvature_ok, max_curv, violation_idx = self._check_curvature_constraints(points)

            if curvature_ok and max_change < 1e-3:
                self.evidence.record_smoothing_operation(
                    iteration + 1,
                    {"max_change": max_change, "max_curvature": max_curv},
                    {"converged": True},
                    f"收敛：最大变化 {max_change:.6f} < 1e-3，最大曲率 {max_curv:.4f} 1/m 满足约束",
                )
                break

            self.evidence.record_smoothing_operation(
                iteration + 1,
                {
                    "max_change": max_change,
                    "max_curvature": max_curv,
                    "curvature_ok": curvature_ok,
                },
                {"points_updated": True},
                f"迭代 {iteration + 1}：最大变化 {max_change:.6f}，最大曲率 {max_curv:.4f} 1/m，"
                f"{'曲率约束满足' if curvature_ok else f'点{violation_idx}曲率超限'}",
            )

        smoothed_path = self._build_path(points, path)

        self.evidence.record_smoothing_operation(
            self.max_iterations,
            {
                "original_points": len(path.points),
                "original_max_curvature": path.max_curvature,
                "original_smoothness": path.smoothness,
            },
            {
                "smoothed_max_curvature": smoothed_path.max_curvature,
                "smoothed_smoothness": smoothed_path.smoothness,
                "smoothed_length": smoothed_path.total_length,
            },
            f"平滑完成：最大曲率从 {path.max_curvature:.4f} → {smoothed_path.max_curvature:.4f} 1/m，"
            f"平滑度从 {path.smoothness:.4f} → {smoothed_path.smoothness:.4f}，"
            f"路径长度从 {path.total_length:.2f} → {smoothed_path.total_length:.2f} m",
        )

        return smoothed_path

    def _compute_forces(
        self,
        points: np.ndarray,
        original_points: np.ndarray,
    ) -> np.ndarray:
        n = len(points)
        forces = np.zeros_like(points)

        for i in range(1, n - 1):
            smoothness_force = self._smoothness_force(points, i)
            curvature_force = self._curvature_force(points, i)
            length_force = self._length_force(points, i)
            collision_force = self._collision_force(points, i)

            forces[i, 0] = (
                self.smoothness_weight * smoothness_force[0]
                + self.curvature_weight * curvature_force[0]
                + self.length_weight * length_force[0]
                + self.collision_weight * collision_force[0]
            )
            forces[i, 1] = (
                self.smoothness_weight * smoothness_force[1]
                + self.curvature_weight * curvature_force[1]
                + self.length_weight * length_force[1]
                + self.collision_weight * collision_force[1]
            )

        return forces

    def _smoothness_force(self, points: np.ndarray, i: int) -> np.ndarray:
        prev = points[i - 1, :2]
        curr = points[i, :2]
        next_p = points[i + 1, :2]

        target = (prev + next_p) / 2.0
        force = 0.1 * (target - curr)

        return np.array([force[0], force[1]])

    def _curvature_force(self, points: np.ndarray, i: int) -> np.ndarray:
        prev = points[i - 1, :2]
        curr = points[i, :2]
        next_p = points[i + 1, :2]

        v1 = curr - prev
        v2 = next_p - curr

        v1_norm = np.linalg.norm(v1)
        v2_norm = np.linalg.norm(v2)

        if v1_norm < 1e-8 or v2_norm < 1e-8:
            return np.zeros(2)

        cross = v1[0] * v2[1] - v1[1] * v2[0]
        curvature = 2 * cross / (v1_norm * v2_norm * (v1_norm + v2_norm))

        max_curv = self.robot_params.max_curvature
        if abs(curvature) > max_curv * 0.8:
            normal = np.array([-v1[1], v1[0]]) / v1_norm
            force_direction = -np.sign(curvature) * normal
            force_magnitude = 0.05 * (abs(curvature) - max_curv * 0.8)
            force = force_magnitude * force_direction

            pose1 = Pose(prev[0], prev[1], np.arctan2(v1[1], v1[0]))
            pose2 = Pose(curr[0], curr[1], np.arctan2(v2[1], v2[0]))
            calc = self.curvature_constraint.calculate_curvature_from_path(
                pose1, pose2, v1_norm
            )
            self.evidence.record_curvature_calculation(
                OperationType.PATH_CURVATURE_CALC, calc
            )

            return force

        return np.zeros(2)

    def _length_force(self, points: np.ndarray, i: int) -> np.ndarray:
        prev = points[i - 1, :2]
        curr = points[i, :2]
        next_p = points[i + 1, :2]

        d_prev = np.linalg.norm(curr - prev)
        d_next = np.linalg.norm(next_p - curr)
        avg_d = (d_prev + d_next) / 2.0

        force = np.zeros(2)

        if d_prev > 1e-8:
            dir_prev = (curr - prev) / d_prev
            force += 0.05 * (avg_d - d_prev) * dir_prev

        if d_next > 1e-8:
            dir_next = (next_p - curr) / d_next
            force += 0.05 * (d_next - avg_d) * dir_next

        return force

    def _collision_force(self, points: np.ndarray, i: int) -> np.ndarray:
        if self.grid_map is None:
            return np.zeros(2)

        curr = points[i, :2]
        force = np.zeros(2)

        if self.grid_map.is_occupied(curr[0], curr[1]):
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    check_x = curr[0] + dx * self.grid_map.resolution
                    check_y = curr[1] + dy * self.grid_map.resolution
                    if not self.grid_map.is_occupied(check_x, check_y):
                        push_dir = np.array([dx, dy], dtype=float)
                        push_dir /= np.linalg.norm(push_dir)
                        force += 0.2 * push_dir
                        break

            self.evidence.record_validation_operation(
                OperationType.COLLISION_CHECK,
                {"point": (curr[0], curr[1])},
                {"collision": True, "force": force.tolist()},
                f"平滑时检测到点 ({curr[0]:.2f}, {curr[1]:.2f}) 碰撞，施加推力 {force}",
            )

        return force

    def _check_curvature_constraints(
        self, points: np.ndarray
    ) -> Tuple[bool, float, Optional[int]]:
        max_curvature = 0.0
        violation_idx = None

        for i in range(1, len(points) - 1):
            pose1 = Pose(points[i-1, 0], points[i-1, 1], points[i-1, 2])
            pose2 = Pose(points[i, 0], points[i, 1], points[i, 2])
            delta_s = np.sqrt(
                (points[i, 0] - points[i-1, 0])**2
                + (points[i, 1] - points[i-1, 1])**2
            )

            calc = self.curvature_constraint.calculate_curvature_from_path(
                pose1, pose2, delta_s
            )
            curvature = abs(calc.result)

            if curvature > max_curvature:
                max_curvature = curvature

            if not calc.boundary_check["curvature_within_limit"]:
                violation_idx = i

        all_ok = violation_idx is None
        return all_ok, max_curvature, violation_idx

    def _build_path(self, points: np.ndarray, original_path: Path) -> Path:
        smoothed_points = []
        timestamp = 0.0

        for i in range(len(points)):
            x, y, theta = points[i]

            if i < len(points) - 1:
                dx = points[i + 1, 0] - x
                dy = points[i + 1, 1] - y
                delta_s = np.sqrt(dx**2 + dy**2)

                pose1 = Pose(x, y, theta)
                pose2 = Pose(points[i + 1, 0], points[i + 1, 1], points[i + 1, 2])
                curv_calc = self.curvature_constraint.calculate_curvature_from_path(
                    pose1, pose2, delta_s
                )
                curvature = curv_calc.result

                speed_calc = self.curvature_constraint.calculate_speed_for_curvature(curvature)
                speed = speed_calc.result

                steering_calc = self.curvature_constraint.calculate_steering_from_curvature(curvature)
                steering = steering_calc.result
            else:
                curvature = 0.0
                speed = self.robot_params.max_speed
                steering = 0.0

            if i > 0:
                prev = smoothed_points[i - 1].pose
                dist = np.sqrt((x - prev.x) ** 2 + (y - prev.y) ** 2)
                timestamp += dist / max(speed, 0.1)

            smoothed_points.append(PathPoint(
                pose=Pose(x, y, theta),
                curvature=curvature,
                speed=speed,
                timestamp=timestamp,
                steering_angle=steering,
            ))

        total_length = sum(
            smoothed_points[i].pose.distance_to(smoothed_points[i+1].pose)
            for i in range(len(smoothed_points) - 1)
        )

        curvatures = [abs(p.curvature) for p in smoothed_points]
        max_curvature = max(curvatures) if curvatures else 0.0
        avg_curvature = sum(curvatures) / len(curvatures) if curvatures else 0.0

        smoothness = sum(
            abs(smoothed_points[i].curvature - smoothed_points[i+1].curvature)
            for i in range(len(smoothed_points) - 1)
        ) / max(len(smoothed_points) - 1, 1)

        return Path(
            points=smoothed_points,
            total_length=total_length,
            max_curvature=max_curvature,
            avg_curvature=avg_curvature,
            smoothness=smoothness,
        )

    def gaussian_smooth(self, path: Path, sigma: float = 1.0) -> Path:
        if len(path.points) < 3:
            return path

        self.evidence.record_input_clue(
            "gaussian_smooth_sigma", sigma, "smoother"
        )

        coords = np.array([
            [p.pose.x, p.pose.y]
            for p in path.points
        ])

        smoothed_x = gaussian_filter1d(coords[:, 0], sigma=sigma)
        smoothed_y = gaussian_filter1d(coords[:, 1], sigma=sigma)

        new_points = np.zeros((len(path.points), 3))
        new_points[:, 0] = smoothed_x
        new_points[:, 1] = smoothed_y

        for i in range(len(new_points) - 1):
            dx = new_points[i + 1, 0] - new_points[i, 0]
            dy = new_points[i + 1, 1] - new_points[i, 1]
            new_points[i, 2] = np.arctan2(dy, dx)
        new_points[-1, 2] = new_points[-2, 2]

        self.evidence.record_smoothing_operation(
            0,
            {"sigma": sigma, "method": "gaussian"},
            {"smoothed": True},
            f"高斯平滑：sigma={sigma}，路径长度 {path.total_length:.2f}m",
        )

        return self._build_path(new_points, path)
