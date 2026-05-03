DEFAULT_CONFIG = {
    "units": {
        "temperature": "°C",
        "dissolved_oxygen": "mg/L",
        "fish_density": "kg/ha",
        "feeding_rate": "kg/ha/day",
        "pond_area": "ha",
        "water_depth": "m",
    },
    "valid_ranges": {
        "temperature": {"min": 0, "max": 40},
        "dissolved_oxygen": {"min": 0, "max": 15},
        "fish_density": {"min": 0, "max": 20000},
        "feeding_rate": {"min": 0, "max": 500},
        "pond_area": {"min": 0.1, "max": 100},
        "water_depth": {"min": 0.5, "max": 3},
    },
    "oxygen": {
        "critical_level": 3.0,
        "warning_level": 4.0,
        "saturation_reference": 7.0,
    },
    "aerator": {
        "power_per_unit": 1.5,
        "efficiency": 2.0,
        "typical_count": 4,
    },
    "electricity": {
        "price_per_kwh": 0.6,
        "night_start_hour": 18,
        "night_end_hour": 6,
    },
    "interpolation": {
        "method": "linear",
        "max_gap_hours": 4,
    },
    "model": {
        "fish_respiration_rate": 0.05,
        "phytoplankton_respiration": 0.02,
        "sediment_oxygen_demand": 0.01,
        "reaeration_coefficient": 0.1,
        "photosynthesis_rate": 0.03,
    },
}
