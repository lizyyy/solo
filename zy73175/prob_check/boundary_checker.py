from typing import Optional, Dict
from .models import BoundaryInfo


DEFAULT_BOUNDARIES: Dict[str, Dict] = {
    "temperature_c": {"lower": -50.0, "upper": 60.0, "label": "摄氏温度"},
    "probability": {"lower": 0.0, "upper": 1.0, "label": "概率值"},
    "speed_kmh": {"lower": 0.0, "upper": 350.0, "label": "速度(km/h)"},
    "height_m": {"lower": 0.0, "upper": 9000.0, "label": "高度(m)"},
    "weight_kg": {"lower": 0.0, "upper": 500.0, "label": "重量(kg)"},
    "time_seconds": {"lower": 0.0, "upper": 86400.0, "label": "时长(秒)"},
    "percentage": {"lower": 0.0, "upper": 100.0, "label": "百分比(%)"},
}


def check_boundary(variable_key: str, value: float, custom_boundaries: Optional[Dict[str, Dict]] = None) -> Optional[BoundaryInfo]:
    boundaries = {**DEFAULT_BOUNDARIES, **(custom_boundaries or {})}
    if variable_key not in boundaries:
        return None
    b = boundaries[variable_key]
    lower = b["lower"]
    upper = b["upper"]
    if value < lower:
        return BoundaryInfo(
            variable=b.get("label", variable_key),
            current_value=value,
            lower_bound=lower,
            upper_bound=upper,
            direction="低于下限",
        )
    if value > upper:
        return BoundaryInfo(
            variable=b.get("label", variable_key),
            current_value=value,
            lower_bound=lower,
            upper_bound=upper,
            direction="高于上限",
        )
    return None
