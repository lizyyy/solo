import math
from typing import List, Tuple, Optional
from dataclasses import dataclass, field

from .physics import ShotParams, ShotResult, compute_trajectory, G, RIM_HEIGHT, FREE_THROW_DIST


@dataclass
class HitWindow:
    angle_min_deg: float
    angle_max_deg: float
    velocity_min_ms: float
    velocity_max_ms: float
    center_angle_deg: float
    center_velocity_ms: float
    angle_span_deg: float
    velocity_span_ms: float
    resolution_angle: float
    resolution_velocity: float
    grid: List[List[bool]] = field(default_factory=list)
    grid_angles: List[float] = field(default_factory=list)
    grid_velocities: List[float] = field(default_factory=list)


def compute_hit_window(
    base_params: ShotParams,
    angle_range: Tuple[float, float] = (30.0, 80.0),
    velocity_range: Tuple[float, float] = (4.0, 12.0),
    resolution: int = 50,
) -> HitWindow:
    angle_step = (angle_range[1] - angle_range[0]) / resolution
    velocity_step = (velocity_range[1] - velocity_range[0]) / resolution

    grid_angles = [angle_range[0] + i * angle_step for i in range(resolution + 1)]
    grid_velocities = [velocity_range[0] + i * velocity_step for i in range(resolution + 1)]

    grid: List[List[bool]] = []
    angle_min = angle_max = None
    vel_min = vel_max = None

    for v in grid_velocities:
        row: List[bool] = []
        for a in grid_angles:
            sp = ShotParams(
                angle_deg=a,
                velocity_ms=v,
                release_height=base_params.release_height,
                rim_height=base_params.rim_height,
                rim_distance=base_params.rim_distance,
                rim_tolerance=base_params.rim_tolerance,
            )
            result = compute_trajectory(sp)
            row.append(result.hit)
            if result.hit:
                if angle_min is None or a < angle_min:
                    angle_min = a
                if angle_max is None or a > angle_max:
                    angle_max = a
                if vel_min is None or v < vel_min:
                    vel_min = v
                if vel_max is None or v > vel_max:
                    vel_max = v
        grid.append(row)

    if angle_min is None:
        angle_min = angle_max = 0.0
        vel_min = vel_max = 0.0

    return HitWindow(
        angle_min_deg=round(angle_min, 2),
        angle_max_deg=round(angle_max, 2),
        velocity_min_ms=round(vel_min, 2),
        velocity_max_ms=round(vel_max, 2),
        center_angle_deg=round((angle_min + angle_max) / 2, 2),
        center_velocity_ms=round((vel_min + vel_max) / 2, 2),
        angle_span_deg=round(angle_max - angle_min, 2),
        velocity_span_ms=round(vel_max - vel_min, 2),
        resolution_angle=round(angle_step, 4),
        resolution_velocity=round(velocity_step, 4),
        grid=grid,
        grid_angles=grid_angles,
        grid_velocities=grid_velocities,
    )


def format_hit_window(hw: HitWindow) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("命中窗口")
    lines.append(f"  角度范围  : {hw.angle_min_deg:.2f}° ~ {hw.angle_max_deg:.2f}° (跨度 {hw.angle_span_deg:.2f}°)")
    lines.append(f"  速度范围  : {hw.velocity_min_ms:.2f} ~ {hw.velocity_max_ms:.2f} m/s (跨度 {hw.velocity_span_ms:.2f} m/s)")
    lines.append(f"  中心点    : {hw.center_angle_deg:.2f}° / {hw.center_velocity_ms:.2f} m/s")
    lines.append(f"  搜索精度  : 角度 {hw.resolution_angle:.4f}°, 速度 {hw.resolution_velocity:.4f} m/s")
    lines.append("-" * 60)
    lines.append("命中矩阵 (行=速度, 列=角度, ●=命中 ○=未命中)")

    header = "       "
    step_a = max(1, len(hw.grid_angles) // 10)
    for j in range(0, len(hw.grid_angles), step_a):
        header += f"{hw.grid_angles[j]:6.1f}"
    lines.append(header)

    step_v = max(1, len(hw.grid_velocities) // 15)
    for i in range(0, len(hw.grid_velocities), step_v):
        row_str = f"{hw.grid_velocities[i]:5.2f} "
        for j in range(0, len(hw.grid_angles), step_a):
            row_str += "  ●  " if hw.grid[i][j] else "  ○  "
        lines.append(row_str)

    lines.append("=" * 60)
    return "\n".join(lines)
