from typing import Optional, Tuple

UNIT_CONVERSIONS = {
    "length": {
        "m": 1.0,
        "cm": 0.01,
        "mm": 0.001,
        "km": 1000.0,
        "inch": 0.0254,
        "ft": 0.3048,
    },
    "mass": {
        "kg": 1.0,
        "g": 0.001,
        "mg": 0.000001,
        "t": 1000.0,
        "lb": 0.453592,
    },
    "time": {
        "s": 1.0,
        "min": 60.0,
        "h": 3600.0,
        "ms": 0.001,
    },
    "area": {
        "m2": 1.0,
        "cm2": 0.0001,
        "mm2": 0.000001,
        "km2": 1000000.0,
        "ha": 10000.0,
    },
    "volume": {
        "m3": 1.0,
        "L": 0.001,
        "mL": 0.000001,
        "cm3": 0.000001,
    },
    "speed": {
        "m/s": 1.0,
        "km/h": 0.277778,
        "mph": 0.44704,
    },
    "temperature": {
        "C": "celsius",
        "K": "kelvin",
        "F": "fahrenheit",
    },
}


def get_unit_category(unit: str) -> Optional[str]:
    for category, units in UNIT_CONVERSIONS.items():
        if unit in units:
            return category
    return None


def convert_unit(value: float, from_unit: str, to_unit: str) -> Tuple[Optional[float], Optional[str]]:
    if from_unit == to_unit:
        return value, None

    category = get_unit_category(from_unit)
    if category is None:
        return None, f"未知单位: {from_unit}"

    if to_unit not in UNIT_CONVERSIONS[category]:
        return None, f"目标单位 {to_unit} 不在 {category} 类别中"

    if category == "temperature":
        return _convert_temperature(value, from_unit, to_unit)

    from_factor = UNIT_CONVERSIONS[category][from_unit]
    to_factor = UNIT_CONVERSIONS[category][to_unit]
    result = value * from_factor / to_factor
    return result, None


def _convert_temperature(value: float, from_unit: str, to_unit: str) -> Tuple[Optional[float], Optional[str]]:
    celsius = None
    if from_unit == "C":
        celsius = value
    elif from_unit == "K":
        celsius = value - 273.15
    elif from_unit == "F":
        celsius = (value - 32) * 5 / 9
    else:
        return None, f"未知温度单位: {from_unit}"

    if to_unit == "C":
        return celsius, None
    elif to_unit == "K":
        return celsius + 273.15, None
    elif to_unit == "F":
        return celsius * 9 / 5 + 32, None
    else:
        return None, f"未知温度单位: {to_unit}"


def derive_result_unit(formula_type: str, unit1: str, unit2: str = None) -> Tuple[Optional[str], Optional[str]]:
    if formula_type == "multiply":
        if unit1 and unit2:
            cat1 = get_unit_category(unit1)
            cat2 = get_unit_category(unit2)
            if cat1 == "length" and cat2 == "length":
                return "m2", None
            if cat1 == "length" and cat2 == "area":
                return "m3", None
        return f"{unit1}*{unit2}", None

    if formula_type == "divide":
        if unit1 and unit2:
            cat1 = get_unit_category(unit1)
            cat2 = get_unit_category(unit2)
            if cat1 == "length" and cat2 == "time":
                return "m/s", None
            if cat1 == "mass" and cat2 == "volume":
                return "kg/m3", None
        return f"{unit1}/{unit2}", None

    if formula_type == "add" or formula_type == "subtract":
        if unit1 == unit2:
            return unit1, None
        return None, "单位不一致，无法进行加减运算"

    return unit1, None
