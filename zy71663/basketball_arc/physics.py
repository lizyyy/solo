import math
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

G = 9.80665

RIM_DIAMETER = 0.4572
BALL_DIAMETER = 0.23876
RIM_HEIGHT = 3.048
FREE_THROW_DIST = 4.225
THREE_POINT_DIST = 6.75


@dataclass
class ShotParams:
    angle_deg: float
    velocity_ms: float
    release_height: float = 1.95
    rim_height: float = RIM_HEIGHT
    rim_distance: float = FREE_THROW_DIST
    rim_tolerance: float = (RIM_DIAMETER - BALL_DIAMETER) / 2.0

    def __post_init__(self):
        self.angle_deg = float(self.angle_deg)
        self.velocity_ms = float(self.velocity_ms)
        self.release_height = float(self.release_height)
        self.rim_height = float(self.rim_height)
        self.rim_distance = float(self.rim_distance)


@dataclass
class TrajectoryPoint:
    t: float
    x: float
    y: float
    vx: float
    vy: float


@dataclass
class ShotResult:
    params: ShotParams
    hit: bool
    entry_angle_deg: Optional[float] = None
    apex_height: Optional[float] = None
    apex_x: Optional[float] = None
    rim_y_at_distance: Optional[float] = None
    y_deviation: Optional[float] = None
    trajectory: List[TrajectoryPoint] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    correction_log: List[str] = field(default_factory=list)


def compute_trajectory(params: ShotParams, dt: float = 0.005, t_max: float = 5.0) -> ShotResult:
    warnings: List[str] = []
    correction_log: List[str] = []

    angle_rad = math.radians(params.angle_deg)
    vx = params.velocity_ms * math.cos(angle_rad)
    vy = params.velocity_ms * math.sin(angle_rad)

    points: List[TrajectoryPoint] = []
    t = 0.0
    apex_height = params.release_height
    apex_x = 0.0

    while t <= t_max:
        x = vx * t
        y = params.release_height + vy * t - 0.5 * G * t * t
        curr_vx = vx
        curr_vy = vy - G * t

        pt = TrajectoryPoint(t=round(t, 6), x=round(x, 6), y=round(y, 6),
                             vx=round(curr_vx, 6), vy=round(curr_vy, 6))
        points.append(pt)

        if y > apex_height:
            apex_height = y
            apex_x = x

        if x >= params.rim_distance and curr_vy < 0:
            break
        if y < -1.0:
            break

        t += dt

    rim_y_at_distance = None
    for i in range(1, len(points)):
        if points[i - 1].x < params.rim_distance <= points[i].x:
            x0, x1 = points[i - 1].x, points[i].x
            y0, y1 = points[i - 1].y, points[i].y
            frac = (params.rim_distance - x0) / (x1 - x0) if x1 != x0 else 0.0
            rim_y_at_distance = y0 + frac * (y1 - y0)
            break

    hit = False
    y_deviation = None
    entry_angle_deg = None

    if rim_y_at_distance is not None:
        y_deviation = rim_y_at_distance - params.rim_height
        hit = abs(y_deviation) <= params.rim_tolerance

        for i in range(1, len(points)):
            if points[i - 1].x < params.rim_distance <= points[i].x:
                speed_at_rim = math.sqrt(points[i].vx ** 2 + points[i].vy ** 2)
                if speed_at_rim > 0:
                    entry_angle_deg = math.degrees(math.asin(abs(points[i].vy) / speed_at_rim))
                break
    else:
        warnings.append("球未到达篮筐水平距离，轨迹结束前已落地或超出计算时限")

    result = ShotResult(
        params=params,
        hit=hit,
        entry_angle_deg=round(entry_angle_deg, 2) if entry_angle_deg is not None else None,
        apex_height=round(apex_height, 4),
        apex_x=round(apex_x, 4),
        rim_y_at_distance=round(rim_y_at_distance, 4) if rim_y_at_distance is not None else None,
        y_deviation=round(y_deviation, 4) if y_deviation is not None else None,
        trajectory=points,
        warnings=warnings,
        correction_log=correction_log,
    )
    return result


def format_result_detail(result: ShotResult) -> str:
    lines = []
    p = result.params
    lines.append("=" * 60)
    lines.append("投篮参数")
    lines.append(f"  出手角度  : {p.angle_deg:.2f}°")
    lines.append(f"  出手速度  : {p.velocity_ms:.2f} m/s")
    lines.append(f"  出手高度  : {p.release_height:.2f} m")
    lines.append(f"  篮筐高度  : {p.rim_height:.2f} m")
    lines.append(f"  篮筐距离  : {p.rim_distance:.2f} m")
    lines.append(f"  容差半径  : {p.rim_tolerance:.4f} m")
    lines.append("-" * 60)
    lines.append("计算结果")
    if result.rim_y_at_distance is not None:
        lines.append(f"  球过筐处Y : {result.rim_y_at_distance:.4f} m")
        lines.append(f"  篮筐Y     : {p.rim_height:.4f} m")
        lines.append(f"  Y偏差     : {result.y_deviation:+.4f} m")
        lines.append(f"  入筐角度  : {result.entry_angle_deg:.2f}°" if result.entry_angle_deg else "  入筐角度  : N/A")
    else:
        lines.append("  球未到达篮筐水平位置")
    lines.append(f"  最高点    : ({result.apex_x:.2f} m, {result.apex_height:.2f} m)")
    lines.append(f"  是否命中  : {'✓ 命中' if result.hit else '✗ 未命中'}")
    if result.warnings:
        lines.append("-" * 60)
        lines.append("警告")
        for w in result.warnings:
            lines.append(f"  ⚠ {w}")
    if result.correction_log:
        lines.append("-" * 60)
        lines.append("修正记录")
        for c in result.correction_log:
            lines.append(f"  → {c}")
    lines.append("=" * 60)
    return "\n".join(lines)
