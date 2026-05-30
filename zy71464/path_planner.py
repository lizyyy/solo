import numpy as np
import heapq
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
import time

from models import GridMap, Pose, Node, Path, PathPoint, RobotParams
from curvature_constraints import CurvatureConstraint, CurvatureCalculation
from evidence_chain import EvidenceChain, OperationType


class HybridAStarPlanner:
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

        self.steering_angles = np.linspace(
            -robot_params.max_steering_angle,
            robot_params.max_steering_angle,
            5,
        )

        self.move_step = grid_map.resolution * 2.0
        self.theta_resolution = np.pi / 12.0

        self._nodes_expanded = 0
        self._max_iterations = 100000

    def _discretize_pose(self, pose: Pose) -> Tuple[int, int, int]:
        gx, gy = self.grid_map.world_to_grid(pose.x, pose.y)
        gtheta = int(pose.theta / self.theta_resolution)
        return (gx, gy, gtheta)

    def _heuristic(self, pose: Pose, goal: Pose) -> float:
        euclidean = pose.distance_to(goal)

        theta_diff = abs(pose.theta - goal.theta)
        theta_diff = min(theta_diff, 2 * np.pi - theta_diff)

        h = euclidean + theta_diff * 0.5

        calc = CurvatureCalculation(
            formula="h = d + wθ * |Δθ|",
            units={"distance": "m", "angle": "rad"},
            inputs={"start_pose": pose.to_tuple(), "goal_pose": goal.to_tuple()},
            intermediate={"euclidean": euclidean, "theta_diff": theta_diff},
            result=h,
            boundary_check={"heuristic_positive": h >= 0},
            reasoning=f"启发式计算：欧氏距离 {euclidean:.2f}m + 航向差权重 {theta_diff:.2f}rad",
        )
        self.evidence.record_curvature_calculation(
            OperationType.HEURISTIC_CALC, calc
        )

        return h

    def _check_collision(self, pose: Pose) -> bool:
        if self.grid_map.is_occupied(pose.x, pose.y):
            return True

        robot_radius = self.robot_params.wheelbase * 0.3
        check_points = [
            (pose.x + robot_radius * np.cos(pose.theta), pose.y + robot_radius * np.sin(pose.theta)),
            (pose.x - robot_radius * np.cos(pose.theta), pose.y - robot_radius * np.sin(pose.theta)),
            (pose.x + robot_radius * np.cos(pose.theta + np.pi/2), pose.y + robot_radius * np.sin(pose.theta + np.pi/2)),
            (pose.x + robot_radius * np.cos(pose.theta - np.pi/2), pose.y + robot_radius * np.sin(pose.theta - np.pi/2)),
        ]

        for px, py in check_points:
            if self.grid_map.is_occupied(px, py):
                return True

        return False

    def _check_path_collision(self, start: Pose, end: Pose, steps: int = 10) -> bool:
        for i in range(steps + 1):
            alpha = i / steps
            x = start.x + alpha * (end.x - start.x)
            y = start.y + alpha * (end.y - start.y)
            theta = start.theta + alpha * (end.theta - start.theta)

            if self.grid_map.is_occupied(x, y):
                self.evidence.record_validation_operation(
                    OperationType.COLLISION_CHECK,
                    {"start": start.to_tuple(), "end": end.to_tuple()},
                    {"collision": True, "point": (x, y)},
                    f"路径段碰撞检测：在 ({x:.2f}, {y:.2f}) 处碰到障碍物",
                )
                return True

        return False

    def _simulate_motion(
        self,
        current_pose: Pose,
        steering_angle: float,
        direction: int,
    ) -> Tuple[Pose, float, CurvatureCalculation, bool]:
        steering_calc = self.curvature_constraint.calculate_curvature_from_steering(steering_angle)
        curvature = steering_calc.result

        self.evidence.record_curvature_calculation(
            OperationType.CURVATURE_FROM_STEERING, steering_calc
        )

        feasible, arc_calc, reason = self.curvature_constraint.check_feasible_arc(
            current_pose,
            Pose(current_pose.x, current_pose.y, current_pose.theta + np.sign(curvature) * 0.1),
        )

        if not feasible:
            self.evidence.record_curvature_calculation(
                OperationType.ARC_FEASIBILITY_CHECK, arc_calc
            )
            return current_pose, 0.0, steering_calc, False

        if abs(curvature) < 1e-10:
            new_x = current_pose.x + direction * self.move_step * np.cos(current_pose.theta)
            new_y = current_pose.y + direction * self.move_step * np.sin(current_pose.theta)
            new_theta = current_pose.theta
        else:
            turning_radius = 1.0 / abs(curvature)
            delta_theta = direction * self.move_step / turning_radius * np.sign(curvature)

            center_x = current_pose.x - turning_radius * np.sign(curvature) * np.sin(current_pose.theta)
            center_y = current_pose.y + turning_radius * np.sign(curvature) * np.cos(current_pose.theta)

            new_theta = current_pose.theta + delta_theta
            new_x = center_x + turning_radius * np.sign(curvature) * np.sin(new_theta)
            new_y = center_y - turning_radius * np.sign(curvature) * np.cos(new_theta)

        new_pose = Pose(new_x, new_y, new_theta)
        return new_pose, curvature, steering_calc, True

    def _is_goal_reached(self, pose: Pose, goal: Pose) -> bool:
        pos_threshold = self.grid_map.resolution * 1.5
        theta_threshold = np.pi / 6.0

        dist = pose.distance_to(goal)
        theta_diff = abs(pose.theta - goal.theta)
        theta_diff = min(theta_diff, 2 * np.pi - theta_diff)

        reached = dist < pos_threshold and theta_diff < theta_threshold

        if reached:
            self.evidence.record_path_search_operation(
                OperationType.PATH_RECONSTRUCTION,
                {"current_pose": pose.to_tuple(), "goal_pose": goal.to_tuple()},
                {"reached": True},
                f"到达目标：位置误差 {dist:.2f}m < {pos_threshold:.2f}m，"
                f"航向误差 {np.degrees(theta_diff):.1f}° < {np.degrees(theta_threshold):.1f}°",
            )

        return reached

    def plan(
        self,
        start: Pose,
        goal: Pose,
    ) -> Optional[Path]:
        self.curvature_constraint.clear_history()
        self._nodes_expanded = 0

        self.evidence.record_input_clue("start_pose", start.to_tuple(), "user")
        self.evidence.record_input_clue("goal_pose", goal.to_tuple(), "user")

        if self._check_collision(start):
            self.evidence.record_validation_operation(
                OperationType.COLLISION_CHECK,
                {"pose": start.to_tuple()},
                {"collision": True},
                f"起点 ({start.x:.2f}, {start.y:.2f}) 位于障碍物中，无法规划",
            )
            return None

        if self._check_collision(goal):
            self.evidence.record_validation_operation(
                OperationType.COLLISION_CHECK,
                {"pose": goal.to_tuple()},
                {"collision": True},
                f"终点 ({goal.x:.2f}, {goal.y:.2f}) 位于障碍物中，无法规划",
            )
            return None

        start_h = self._heuristic(start, goal)
        start_node = Node(
            pose=start,
            g_cost=0.0,
            h_cost=start_h,
            parent=None,
            curvature=0.0,
            speed=self.robot_params.max_speed,
            steering_angle=0.0,
            direction=1,
        )

        open_list: List[Tuple[float, int, Node]] = []
        closed_set: Dict[Tuple[int, int, int], float] = {}

        heapq.heappush(open_list, (start_node.f_cost, 0, start_node))

        goal_node = None
        iterations = 0

        while open_list and iterations < self._max_iterations:
            iterations += 1
            current_f, _, current_node = heapq.heappop(open_list)

            current_key = self._discretize_pose(current_node.pose)

            if current_key in closed_set and closed_set[current_key] <= current_node.g_cost:
                continue

            closed_set[current_key] = current_node.g_cost
            self._nodes_expanded += 1

            if self._is_goal_reached(current_node.pose, goal):
                goal_node = current_node
                break

            for steering in self.steering_angles:
                for direction in [1, -1]:
                    new_pose, curvature, steering_calc, feasible = self._simulate_motion(
                        current_node.pose, steering, direction
                    )

                    if not feasible:
                        continue

                    if self._check_path_collision(current_node.pose, new_pose):
                        continue

                    speed_calc = self.curvature_constraint.calculate_speed_for_curvature(curvature)
                    self.evidence.record_curvature_calculation(
                        OperationType.SPEED_FOR_CURVATURE, speed_calc
                    )
                    speed = speed_calc.result

                    if speed < 1e-3:
                        self.evidence.record_path_search_operation(
                            OperationType.NODE_EXPANSION,
                            {"curvature": curvature, "max_curvature": self.robot_params.max_curvature},
                            {"expanded": False},
                            f"跳过节点：曲率 {abs(curvature):.4f} 1/m 过大，允许速度为 0",
                        )
                        continue

                    move_cost = self.move_step / max(speed, 0.1)
                    curvature_penalty = abs(curvature) * 5.0
                    direction_penalty = 0.5 if direction < 0 else 0.0

                    g_cost = current_node.g_cost + move_cost + curvature_penalty + direction_penalty
                    h_cost = self._heuristic(new_pose, goal)

                    new_node = Node(
                        pose=new_pose,
                        g_cost=g_cost,
                        h_cost=h_cost,
                        parent=current_node,
                        curvature=curvature,
                        speed=speed,
                        steering_angle=steering,
                        direction=direction,
                    )

                    new_key = self._discretize_pose(new_pose)

                    if new_key not in closed_set or closed_set[new_key] > g_cost:
                        heapq.heappush(open_list, (new_node.f_cost, iterations, new_node))

                        self.evidence.record_path_search_operation(
                            OperationType.NODE_EXPANSION,
                            {
                                "from_pose": current_node.pose.to_tuple(),
                                "to_pose": new_pose.to_tuple(),
                                "steering": np.degrees(steering),
                                "direction": "前进" if direction > 0 else "后退",
                            },
                            {"g_cost": g_cost, "h_cost": h_cost, "curvature": curvature},
                            f"扩展节点：从 ({current_node.pose.x:.1f}, {current_node.pose.y:.1f}) "
                            f"到 ({new_pose.x:.1f}, {new_pose.y:.1f})，"
                            f"转向 {np.degrees(steering):.1f}°，曲率 {curvature:.4f} 1/m，"
                            f"速度 {speed:.2f} m/s",
                        )

        if goal_node is None:
            self.evidence.record_path_search_operation(
                OperationType.PATH_RECONSTRUCTION,
                {"start": start.to_tuple(), "goal": goal.to_tuple()},
                {"found": False, "nodes_expanded": self._nodes_expanded},
                f"规划失败：扩展 {self._nodes_expanded} 个节点后仍未找到路径，"
                f"可能是障碍物阻挡或转弯半径不足",
            )
            return None

        path_points = self._reconstruct_path(goal_node)

        total_length = sum(
            path_points[i].pose.distance_to(path_points[i+1].pose)
            for i in range(len(path_points) - 1)
        )

        curvatures = [abs(p.curvature) for p in path_points]
        max_curvature = max(curvatures) if curvatures else 0.0
        avg_curvature = sum(curvatures) / len(curvatures) if curvatures else 0.0

        smoothness = sum(
            abs(path_points[i].curvature - path_points[i+1].curvature)
            for i in range(len(path_points) - 1)
        ) / max(len(path_points) - 1, 1)

        path = Path(
            points=path_points,
            total_length=total_length,
            max_curvature=max_curvature,
            avg_curvature=avg_curvature,
            smoothness=smoothness,
        )

        self.evidence.record_path_search_operation(
            OperationType.PATH_RECONSTRUCTION,
            {"nodes_expanded": self._nodes_expanded},
            {
                "path_length": total_length,
                "path_points": len(path_points),
                "max_curvature": max_curvature,
            },
            f"路径重构完成：共 {len(path_points)} 个点，总长度 {total_length:.2f}m，"
            f"最大曲率 {max_curvature:.4f} 1/m，平均曲率 {avg_curvature:.4f} 1/m",
        )

        return path

    def _reconstruct_path(self, goal_node: Node) -> List[PathPoint]:
        nodes = []
        current = goal_node

        while current is not None:
            nodes.append(current)
            current = current.parent

        nodes.reverse()

        path_points = []
        timestamp = 0.0

        for i, node in enumerate(nodes):
            if i > 0:
                dist = nodes[i-1].pose.distance_to(node.pose)
                timestamp += dist / max(node.speed, 0.1)

            path_points.append(PathPoint(
                pose=node.pose,
                curvature=node.curvature,
                speed=node.speed,
                timestamp=timestamp,
                steering_angle=node.steering_angle,
            ))

        self.evidence.record_path_search_operation(
            OperationType.PATH_RECONSTRUCTION,
            {"node_count": len(nodes)},
            {"path_point_count": len(path_points)},
            f"重构路径：从 {len(nodes)} 个节点生成 {len(path_points)} 个路径点，"
            f"总时长 {timestamp:.2f}s",
        )

        return path_points
