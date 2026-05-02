import math
from typing import Optional, Tuple

import numpy as np

from ..models import Point3D, UnitSystem, Speaker, MeasurementPoint


UNIT_CONVERSIONS = {
    (UnitSystem.CENTIMETERS, UnitSystem.METERS): 0.01,
    (UnitSystem.METERS, UnitSystem.CENTIMETERS): 100.0,
    (UnitSystem.FEET, UnitSystem.METERS): 0.3048,
    (UnitSystem.METERS, UnitSystem.FEET): 3.28084,
    (UnitSystem.CENTIMETERS, UnitSystem.FEET): 0.0328084,
    (UnitSystem.FEET, UnitSystem.CENTIMETERS): 30.48,
}


def convert_unit(
    value: float,
    from_unit: UnitSystem,
    to_unit: UnitSystem,
) -> float:
    if from_unit == to_unit:
        return value

    key = (from_unit, to_unit)
    if key in UNIT_CONVERSIONS:
        return value * UNIT_CONVERSIONS[key]

    key = (from_unit, UnitSystem.METERS)
    if key in UNIT_CONVERSIONS:
        value *= UNIT_CONVERSIONS[key]

    key = (UnitSystem.METERS, to_unit)
    if key in UNIT_CONVERSIONS:
        value *= UNIT_CONVERSIONS[key]

    return value


def calculate_distance(
    point1: Point3D,
    point2: Point3D,
    unit: UnitSystem = UnitSystem.METERS,
) -> float:
    dx = point1.x - point2.x
    dy = point1.y - point2.y
    dz = point1.z - point2.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def calculate_distance_2d(
    point1: Point3D,
    point2: Point3D,
) -> float:
    dx = point1.x - point2.x
    dy = point1.y - point2.y
    return math.sqrt(dx * dx + dy * dy)


def calculate_speed_of_sound(
    temperature_c: float,
    humidity_pct: float = 50.0,
    pressure_kpa: float = 101.325,
) -> float:
    T = temperature_c + 273.15
    P = pressure_kpa * 1000

    T_0 = 273.16
    P_sat = 611.21 * math.exp(17.502 * temperature_c / (240.97 + temperature_c))
    X_w = humidity_pct / 100.0 * P_sat / P

    R = 8.314462618
    M_air = 0.0289645
    M_water = 0.01801528

    gamma_d = 1.4
    gamma_v = 1.33

    X_a = 1.0 - X_w
    M_mix = X_a * M_air + X_w * M_water

    gamma = (
        (X_a * gamma_d / (gamma_d - 1) + X_w * gamma_v / (gamma_v - 1))
        / (X_a / (gamma_d - 1) + X_w / (gamma_v - 1))
    )

    c = math.sqrt(gamma * R * T / M_mix)
    return c


def calculate_speed_of_sound_simple(temperature_c: float) -> float:
    return 331.3 + 0.606 * temperature_c


def calculate_expected_time(
    distance_m: float,
    speed_of_sound_mps: float,
) -> float:
    return distance_m / speed_of_sound_mps


def calculate_all_distances(
    speakers: dict[str, Speaker],
    points: dict[str, MeasurementPoint],
    unit: UnitSystem = UnitSystem.METERS,
) -> dict[str, dict[str, float]]:
    distances: dict[str, dict[str, float]] = {}

    for spk_id, speaker in speakers.items():
        distances[spk_id] = {}
        for pt_id, point in points.items():
            dist = calculate_distance(speaker.position, point.position, unit)
            distances[spk_id][pt_id] = dist

    return distances


def calculate_all_expected_times(
    distances: dict[str, dict[str, float]],
    speed_of_sound_mps: float,
) -> dict[str, dict[str, float]]:
    times: dict[str, dict[str, float]] = {}

    for spk_id, spk_distances in distances.items():
        times[spk_id] = {}
        for pt_id, dist in spk_distances.items():
            times[spk_id][pt_id] = calculate_expected_time(dist, speed_of_sound_mps)

    return times


def estimate_speed_of_sound_from_delays(
    distances: dict[str, dict[str, float]],
    measured_times: dict[str, dict[str, float]],
) -> Tuple[float, float, list[float]]:
    ratios = []

    for spk_id in distances:
        if spk_id not in measured_times:
            continue
        for pt_id in distances[spk_id]:
            if pt_id not in measured_times[spk_id]:
                continue

            dist = distances[spk_id][pt_id]
            time = measured_times[spk_id][pt_id]

            if time > 0 and dist > 0:
                ratios.append(dist / time)

    if not ratios:
        return 343.0, 0.0, []

    ratios_arr = np.array(ratios)

    if len(ratios) >= 3:
        q25, q75 = np.percentile(ratios_arr, [25, 75])
        iqr = q75 - q25
        lower_bound = q25 - 1.5 * iqr
        upper_bound = q75 + 1.5 * iqr
        mask = (ratios_arr >= lower_bound) & (ratios_arr <= upper_bound)
        filtered_ratios = ratios_arr[mask]
        if len(filtered_ratios) > 0:
            ratios_arr = filtered_ratios

    mean_speed = float(np.mean(ratios_arr))
    std_speed = float(np.std(ratios_arr))
    confidence = 1.0 / (1.0 + std_speed / mean_speed) if mean_speed > 0 else 0.0

    return mean_speed, confidence, list(ratios_arr)


def calculate_path_difference(
    speaker1: Speaker,
    speaker2: Speaker,
    point: MeasurementPoint,
) -> float:
    dist1 = calculate_distance(speaker1.position, point.position)
    dist2 = calculate_distance(speaker2.position, point.position)
    return dist1 - dist2


def calculate_coverage_angle(
    speaker: Speaker,
    point: MeasurementPoint,
    speaker_orientation: Point3D,
) -> float:
    to_point = np.array([
        point.position.x - speaker.position.x,
        point.position.y - speaker.position.y,
        point.position.z - speaker.position.z,
    ])

    orientation = np.array(speaker_orientation.to_list())

    norm_to_point = np.linalg.norm(to_point)
    norm_orientation = np.linalg.norm(orientation)

    if norm_to_point == 0 or norm_orientation == 0:
        return 0.0

    cos_angle = np.dot(to_point, orientation) / (norm_to_point * norm_orientation)
    cos_angle = max(-1.0, min(1.0, cos_angle))

    return math.degrees(math.acos(cos_angle))
