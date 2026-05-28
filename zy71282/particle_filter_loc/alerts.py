import math


NOISE_THRESHOLDS = {
    "motion_dx": 2.0,
    "motion_dy": 2.0,
    "motion_dtheta": 0.5,
    "sensor_range": 3.0,
    "sensor_bearing": 0.3,
}


def check_excessive_noise(motion_noise, sensor_noise):
    alerts = []

    dx_noise = motion_noise.get("dx", 0)
    dy_noise = motion_noise.get("dy", 0)
    dtheta_noise = motion_noise.get("dtheta", 0)

    if dx_noise > NOISE_THRESHOLDS["motion_dx"]:
        alerts.append({
            "type": "excessive_noise",
            "parameter": "motion_noise.dx",
            "value": dx_noise,
            "threshold": NOISE_THRESHOLDS["motion_dx"],
            "reason": (
                f"运动噪声dx={dx_noise:.3f}超过阈值{NOISE_THRESHOLDS['motion_dx']:.3f}，"
                f"位移方向扰动过大，粒子扩散将远超实际运动，"
                f"定位精度会显著下降，建议缩小至阈值以下"
            )
        })

    if dy_noise > NOISE_THRESHOLDS["motion_dy"]:
        alerts.append({
            "type": "excessive_noise",
            "parameter": "motion_noise.dy",
            "value": dy_noise,
            "threshold": NOISE_THRESHOLDS["motion_dy"],
            "reason": (
                f"运动噪声dy={dy_noise:.3f}超过阈值{NOISE_THRESHOLDS['motion_dy']:.3f}，"
                f"位移方向扰动过大，粒子扩散将远超实际运动，"
                f"定位精度会显著下降，建议缩小至阈值以下"
            )
        })

    if dtheta_noise > NOISE_THRESHOLDS["motion_dtheta"]:
        alerts.append({
            "type": "excessive_noise",
            "parameter": "motion_noise.dtheta",
            "value": dtheta_noise,
            "threshold": NOISE_THRESHOLDS["motion_dtheta"],
            "reason": (
                f"运动噪声dtheta={dtheta_noise:.3f}超过阈值{NOISE_THRESHOLDS['motion_dtheta']:.3f}，"
                f"航向扰动过大，粒子朝向将快速发散，"
                f"导致观测匹配困难，建议缩小至阈值以下"
            )
        })

    range_noise = sensor_noise.get("range", 0)
    bearing_noise = sensor_noise.get("bearing", 0)

    if range_noise > NOISE_THRESHOLDS["sensor_range"]:
        alerts.append({
            "type": "excessive_noise",
            "parameter": "sensor_noise.range",
            "value": range_noise,
            "threshold": NOISE_THRESHOLDS["sensor_range"],
            "reason": (
                f"传感器距离噪声={range_noise:.3f}超过阈值{NOISE_THRESHOLDS['sensor_range']:.3f}，"
                f"距离观测扰动过大，粒子权重区分度不足，"
                f"几乎无法通过观测修正位置，建议降低传感器噪声或更换更精确的传感器"
            )
        })

    if bearing_noise > NOISE_THRESHOLDS["sensor_bearing"]:
        alerts.append({
            "type": "excessive_noise",
            "parameter": "sensor_noise.bearing",
            "value": bearing_noise,
            "threshold": NOISE_THRESHOLDS["sensor_bearing"],
            "reason": (
                f"传感器方位噪声={bearing_noise:.3f}超过阈值{NOISE_THRESHOLDS['sensor_bearing']:.3f}，"
                f"方位观测扰动过大，粒子权重区分度不足，"
                f"几乎无法通过观测修正朝向，建议降低传感器噪声或更换更精确的传感器"
            )
        })

    return alerts


def check_obstacle_crossing_estimated(world_map, trajectory):
    alerts = []
    for i in range(1, len(trajectory)):
        prev = trajectory[i - 1]
        curr = trajectory[i]
        obs = world_map.crosses_obstacle(prev[0], prev[1], curr[0], curr[1])
        if obs:
            alerts.append({
                "type": "obstacle_crossing_estimated",
                "step": i,
                "obstacle_id": obs.id,
                "from": [round(prev[0], 2), round(prev[1], 2)],
                "to": [round(curr[0], 2), round(curr[1], 2)],
                "reason": (
                    f"第{i}步估计轨迹穿越障碍'{obs.id}'，"
                    f"从({prev[0]:.2f},{prev[1]:.2f})到({curr[0]:.2f},{curr[1]:.2f})，"
                    f"定位结果在物理上不可行，请检查地图与传感器数据是否一致"
                )
            })
    return alerts
