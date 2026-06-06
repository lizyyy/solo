import re
from typing import Tuple, Optional
from ..models.enums import TemperatureUnit


def parse_temperature(raw_value: str) -> Tuple[Optional[float], TemperatureUnit, bool]:
    if not raw_value or not isinstance(raw_value, str):
        return None, TemperatureUnit.UNKNOWN, False

    raw_clean = raw_value.strip()

    celsius_patterns = [
        r'(-?\d+\.?\d*)\s*°?\s*C(?:elsius)?\b',
        r'(-?\d+\.?\d*)\s*摄氏度',
        r'\bC\s*=\s*(-?\d+\.?\d*)',
    ]

    kelvin_patterns = [
        r'(-?\d+\.?\d*)\s*K(?:elvin)?\b',
        r'(-?\d+\.?\d*)\s*开尔文',
        r'\bK\s*=\s*(-?\d+\.?\d*)',
    ]

    celsius_matches = []
    for pattern in celsius_patterns:
        matches = re.findall(pattern, raw_clean, re.IGNORECASE)
        celsius_matches.extend(matches)

    kelvin_matches = []
    for pattern in kelvin_patterns:
        matches = re.findall(pattern, raw_clean, re.IGNORECASE)
        kelvin_matches.extend(matches)

    has_celsius = len(celsius_matches) > 0
    has_kelvin = len(kelvin_matches) > 0
    has_mixed = has_celsius and has_kelvin

    if has_mixed:
        all_matches = celsius_matches + kelvin_matches
        try:
            first_val = float(all_matches[0]) if all_matches else None
        except (ValueError, IndexError):
            first_val = None
        return first_val, TemperatureUnit.MIXED, True

    if has_celsius:
        try:
            val = float(celsius_matches[0])
            return val, TemperatureUnit.CELSIUS, False
        except (ValueError, IndexError):
            pass

    if has_kelvin:
        try:
            val = float(kelvin_matches[0])
            return val, TemperatureUnit.KELVIN, False
        except (ValueError, IndexError):
            pass

    number_match = re.search(r'(-?\d+\.?\d*)', raw_clean)
    if number_match:
        try:
            val = float(number_match.group(1))
            return val, TemperatureUnit.UNKNOWN, False
        except ValueError:
            pass

    return None, TemperatureUnit.UNKNOWN, False


def celsius_to_kelvin(celsius: float) -> float:
    return celsius + 273.15


def kelvin_to_celsius(kelvin: float) -> float:
    return kelvin - 273.15


def normalize_to_celsius(value: float, unit: TemperatureUnit) -> Optional[float]:
    if unit == TemperatureUnit.CELSIUS:
        return value
    elif unit == TemperatureUnit.KELVIN:
        return kelvin_to_celsius(value)
    return None
