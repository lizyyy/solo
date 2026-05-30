import math
from models import Seat, Stage, Obstruction, PriceTier


def compute_elevation_angle(seat: Seat, stage: Stage) -> float:
    dx = seat.x - stage.center_x
    dy = seat.y - stage.center_y
    horizontal_dist = math.sqrt(dx * dx + dy * dy)
    if horizontal_dist == 0:
        return 90.0
    vertical_diff = stage.height - seat.elevation
    angle_rad = math.atan2(vertical_diff, horizontal_dist)
    return math.degrees(angle_rad)


def is_obstruction_blocking(seat: Seat, stage: Stage, obs: Obstruction) -> bool:
    sx, sy = seat.x, seat.y
    tx, ty = stage.center_x, stage.center_y
    ox, oy = obs.x, obs.y

    dx = tx - sx
    dy = ty - sy
    line_len_sq = dx * dx + dy * dy
    if line_len_sq == 0:
        return False

    t = ((ox - sx) * dx + (oy - sy) * dy) / line_len_sq
    if t < 0 or t > 1:
        return False

    closest_x = sx + t * dx
    closest_y = sy + t * dy
    dist_to_line = math.sqrt((ox - closest_x) ** 2 + (oy - closest_y) ** 2)

    return dist_to_line <= obs.radius


def compute_obstruction_impact(seat: Seat, stage: Stage, obs: Obstruction) -> float:
    if not is_obstruction_blocking(seat, stage, obs):
        return 0.0

    sx, sy = seat.x, seat.y
    tx, ty = stage.center_x, stage.center_y
    dx = tx - sx
    dy = ty - sy
    line_len = math.sqrt(dx * dx + dy * dy)
    if line_len == 0:
        return 0.0

    ux, uy = dx / line_len, dy / line_len
    vx, vy = obs.x - sx, obs.y - sy
    proj = vx * ux + vy * uy
    perp_dist = abs(vx * uy - vy * ux)

    stage_width_at_t = stage.width * 0.5
    blocked_ratio = min(1.0, (obs.radius * 2) / stage_width_at_t) if stage_width_at_t > 0 else 1.0

    height_factor = obs.height / stage.height if stage.height > 0 else 0.5
    proximity_factor = proj / line_len if line_len > 0 else 0.5

    if obs.height >= seat.elevation:
        angular_factor = 1.0
    else:
        vertical_angle = math.atan2(obs.height - seat.elevation, max(proj, 0.1))
        stage_angle = math.atan2(stage.height - seat.elevation, max(proj, 0.1))
        angular_factor = max(0.0, vertical_angle / stage_angle) if stage_angle > 0 else 0.0

    impact = blocked_ratio * 0.4 + angular_factor * 0.4 + proximity_factor * 0.2
    return min(1.0, impact)


def compute_sightline_score(
    seat: Seat,
    stage: Stage,
    obstructions: list[Obstruction],
) -> float:
    elevation_angle = compute_elevation_angle(seat, stage)
    angle_score = min(1.0, max(0.0, (elevation_angle + 10) / 40))

    sx, sy = seat.x, seat.y
    tx, ty = stage.center_x, stage.center_y
    dist = math.sqrt((sx - tx) ** 2 + (sy - ty) ** 2)
    max_dist = 50.0
    dist_score = max(0.0, 1.0 - dist / max_dist)

    stage_half = stage.width / 2
    offset = abs(sx - stage.center_x)
    if stage_half > 0:
        lateral_score = max(0.0, 1.0 - (offset / (stage_half * 2.5)))
    else:
        lateral_score = 1.0

    total_obstruction_impact = 0.0
    for obs in obstructions:
        total_obstruction_impact += compute_obstruction_impact(seat, stage, obs)
    total_obstruction_impact = min(1.0, total_obstruction_impact)

    raw = (
        angle_score * 0.30
        + dist_score * 0.20
        + lateral_score * 0.20
        + (1.0 - total_obstruction_impact) * 0.30
    )
    return round(max(0.0, min(100.0, raw * 100)), 1)


def compute_price_tier(score: float) -> PriceTier:
    if score >= 85:
        return PriceTier.VIP
    elif score >= 70:
        return PriceTier.A
    elif score >= 55:
        return PriceTier.B
    elif score >= 40:
        return PriceTier.C
    else:
        return PriceTier.D


def compute_price_range(tier: PriceTier) -> tuple[float, float]:
    ranges: dict[PriceTier, tuple[float, float]] = {
        PriceTier.VIP: (880.0, 1280.0),
        PriceTier.A: (580.0, 880.0),
        PriceTier.B: (380.0, 580.0),
        PriceTier.C: (180.0, 380.0),
        PriceTier.D: (80.0, 180.0),
    }
    return ranges[tier]
