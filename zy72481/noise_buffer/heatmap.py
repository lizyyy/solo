from typing import List, Tuple
from .models import SamplePoint, HeatmapCell
import math


def calculate_heatmap(
    samples: List[SamplePoint],
    grid_size: float = 1.0,
    x_range: Tuple[float, float] = (0, 10),
    y_range: Tuple[float, float] = (0, 7),
    influence_radius: float = 2.5
) -> List[HeatmapCell]:
    cells = []
    x_min, x_max = x_range
    y_min, y_max = y_range

    x = x_min
    while x <= x_max:
        y = y_min
        while y <= y_max:
            total_weight = 0.0
            weighted_noise = 0.0
            sample_count = 0
            low_confidence_count = 0
            has_estimated = False
            reasons = []

            for sample in samples:
                dx = x - sample.x
                dy = y - sample.y
                distance = math.sqrt(dx * dx + dy * dy)

                if distance <= influence_radius:
                    weight = 1.0 - (distance / influence_radius)
                    weight = max(0.1, weight)

                    noise_level = sample.noise_level
                    if sample.status == "corrected":
                        pass
                    elif sample.status == "from_complaint":
                        noise_level = sample.noise_level * 1.1

                    weighted_noise += noise_level * weight
                    total_weight += weight
                    sample_count += 1

                    if sample.status == "low_confidence":
                        low_confidence_count += 1
                        if "晚上缺采样" not in reasons:
                            reasons.append("晚上缺采样")
                    if sample.source == "estimated":
                        has_estimated = True
                        if "估算数据" not in reasons:
                            reasons.append("估算数据")

            if sample_count > 0 and total_weight > 0:
                avg_noise = weighted_noise / total_weight
                is_low_confidence = (
                    low_confidence_count > 0 or
                    has_estimated or
                    sample_count < 2
                )

                cells.append(HeatmapCell(
                    x=round(x, 1),
                    y=round(y, 1),
                    noise_level=round(avg_noise, 1),
                    sample_count=sample_count,
                    is_low_confidence=is_low_confidence,
                    reason="; ".join(reasons) if reasons else ""
                ))

            y += grid_size
        x += grid_size

    return cells


def get_night_samples(samples: List[SamplePoint]) -> List[SamplePoint]:
    return [s for s in samples if s.is_night]


def get_low_confidence_samples(samples: List[SamplePoint]) -> List[SamplePoint]:
    return [s for s in samples if s.status == "low_confidence"]


def flag_missing_night_samples(samples: List[SamplePoint]) -> List[str]:
    locations = set(s.location_id for s in samples)
    warnings = []

    for loc in locations:
        loc_samples = [s for s in samples if s.location_id == loc]
        day_samples = [s for s in loc_samples if not s.is_night]
        night_samples = [s for s in loc_samples if s.is_night]

        if day_samples and not night_samples:
            loc_name = loc_samples[0].location_name
            warnings.append(f"{loc_name} ({loc}): 有日间采样但无夜间采样，热力图可能偏低")
        elif night_samples and all(s.status == "low_confidence" for s in night_samples):
            loc_name = loc_samples[0].location_name
            warnings.append(f"{loc_name} ({loc}): 夜间采样数据可信度低，建议复核")

    return warnings
