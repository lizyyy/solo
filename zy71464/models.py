from dataclasses import dataclass, field
from typing import List, Tuple, Optional
import numpy as np


@dataclass
class GridMap:
    resolution: float
    width_m: float
    height_m: float
    obstacles: np.ndarray
    origin: Tuple[float, float] = (0.0, 0.0)

    @property
    def width_cells(self) -> int:
        return int(self.width_m / self.resolution)

    @property
    def height_cells(self) -> int:
        return int(self.height_m / self.resolution)

    def world_to_grid(self, x: float, y: float) -> Tuple[int, int]:
        gx = int((x - self.origin[0]) / self.resolution)
        gy = int((y - self.origin[1]) / self.resolution)
        return gx, gy

    def grid_to_world(self, gx: int, gy: int) -> Tuple[float, float]:
        x = gx * self.resolution + self.origin[0] + self.resolution / 2
        y = gy * self.resolution + self.origin[1] + self.resolution / 2
        return x, y

    def is_occupied(self, x: float, y: float) -> bool:
        gx, gy = self.world_to_grid(x, y)
        if gx < 0 or gx >= self.width_cells or gy < 0 or gy >= self.height_cells:
            return True
        return self.obstacles[gy, gx] > 0.5


@dataclass
class Pose:
    x: float
    y: float
    theta: float

    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.x, self.y, self.theta)

    def distance_to(self, other: "Pose") -> float:
        return np.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)


@dataclass
class PathPoint:
    pose: Pose
    curvature: float
    speed: float
    timestamp: float
    steering_angle: float = 0.0


@dataclass
class Node:
    pose: Pose
    g_cost: float
    h_cost: float
    parent: Optional["Node"]
    curvature: float = 0.0
    speed: float = 0.0
    steering_angle: float = 0.0
    direction: int = 1

    @property
    def f_cost(self) -> float:
        return self.g_cost + self.h_cost

    def __lt__(self, other: "Node") -> bool:
        return self.f_cost < other.f_cost

    def __le__(self, other: "Node") -> bool:
        return self.f_cost <= other.f_cost

    def __gt__(self, other: "Node") -> bool:
        return self.f_cost > other.f_cost

    def __ge__(self, other: "Node") -> bool:
        return self.f_cost >= other.f_cost

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Node):
            return False
        return (
            self.pose.x == other.pose.x
            and self.pose.y == other.pose.y
            and abs(self.pose.theta - other.pose.theta) < 1e-6
        )

    def __hash__(self) -> int:
        return hash((round(self.pose.x, 3), round(self.pose.y, 3), round(self.pose.theta, 3)))


@dataclass
class RobotParams:
    wheelbase: float
    max_steering_angle: float
    min_turning_radius: float
    max_speed: float
    max_curvature: float

    @classmethod
    def from_wheelbase_steering(cls, wheelbase: float, max_steering_angle: float, max_speed: float) -> "RobotParams":
        min_turning_radius = wheelbase / np.tan(max_steering_angle)
        max_curvature = 1.0 / min_turning_radius
        return cls(
            wheelbase=wheelbase,
            max_steering_angle=max_steering_angle,
            min_turning_radius=min_turning_radius,
            max_speed=max_speed,
            max_curvature=max_curvature,
        )


@dataclass
class Path:
    points: List[PathPoint]
    total_length: float
    max_curvature: float
    avg_curvature: float
    smoothness: float

    def __len__(self) -> int:
        return len(self.points)


@dataclass
class ValidationResult:
    passed: bool
    collision_points: List[Tuple[float, float, str]]
    curvature_violations: List[Tuple[int, float, float]]
    speed_violations: List[Tuple[int, float, float]]
    details: List[str] = field(default_factory=list)


@dataclass
class EvidenceRecord:
    timestamp: float
    module: str
    operation: str
    inputs: dict
    outputs: dict
    reasoning: str

    def format_for_humans(self) -> str:
        return f"[{self.module}] {self.reasoning}"
