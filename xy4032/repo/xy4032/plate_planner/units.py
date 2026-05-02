"""
单位换算模块 - 处理浓度单位、体积单位之间的换算
"""

from enum import Enum
from typing import Dict, Tuple


class VolumeUnit(Enum):
    L = "L"
    ML = "ml"
    UL = "ul"
    NL = "nl"


class ConcentrationUnit(Enum):
    NG_UL = "ng/ul"
    PG_UL = "pg/ul"
    UG_UL = "ug/ul"
    MG_ML = "mg/ml"
    NG_ML = "ng/ml"
    UM = "uM"
    NM = "nM"
    MM = "mM"


VOLUME_CONVERSIONS: Dict[str, Dict[str, float]] = {
    "L": {"L": 1.0, "ml": 1000.0, "ul": 1000000.0, "nl": 1000000000.0},
    "ml": {"L": 0.001, "ml": 1.0, "ul": 1000.0, "nl": 1000000.0},
    "ul": {"L": 0.000001, "ml": 0.001, "ul": 1.0, "nl": 1000.0},
    "nl": {"L": 0.000000001, "ml": 0.000001, "ul": 0.001, "nl": 1.0},
}

MASS_CONVERSIONS: Dict[str, Dict[str, float]] = {
    "g": {"g": 1.0, "mg": 1000.0, "ug": 1000000.0, "ng": 1000000000.0, "pg": 1000000000000.0},
    "mg": {"g": 0.001, "mg": 1.0, "ug": 1000.0, "ng": 1000000.0, "pg": 1000000000.0},
    "ug": {"g": 0.000001, "mg": 0.001, "ug": 1.0, "ng": 1000.0, "pg": 1000000.0},
    "ng": {"g": 0.000000001, "mg": 0.000001, "ug": 0.001, "ng": 1.0, "pg": 1000.0},
    "pg": {"g": 0.000000000001, "mg": 0.000000001, "ug": 0.000001, "ng": 0.001, "pg": 1.0},
}

MOLAR_CONVERSIONS: Dict[str, Dict[str, float]] = {
    "M": {"M": 1.0, "mM": 1000.0, "uM": 1000000.0, "nM": 1000000000.0, "pM": 1000000000000.0},
    "mM": {"M": 0.001, "mM": 1.0, "uM": 1000.0, "nM": 1000000.0, "pM": 1000000000.0},
    "uM": {"M": 0.000001, "mM": 0.001, "uM": 1.0, "nM": 1000.0, "pM": 1000000.0},
    "nM": {"M": 0.000000001, "mM": 0.000001, "uM": 0.001, "nM": 1.0, "pM": 1000.0},
    "pM": {"M": 0.000000000001, "mM": 0.000000001, "uM": 0.000001, "nM": 0.001, "pM": 1.0},
}


def normalize_concentration_unit(unit: str) -> str:
    unit = unit.strip().lower().replace("μ", "u")
    unit_map = {
        "ng/ul": "ng/ul",
        "ng/μl": "ng/ul",
        "ng per ul": "ng/ul",
        "pg/ul": "pg/ul",
        "pg/μl": "pg/ul",
        "pg per ul": "pg/ul",
        "ug/ul": "ug/ul",
        "μg/μl": "ug/ul",
        "ug per ul": "ug/ul",
        "mg/ml": "mg/ml",
        "mg per ml": "mg/ml",
        "ng/ml": "ng/ml",
        "ng per ml": "ng/ml",
        "um": "uM",
        "μm": "uM",
        "μM": "uM",
        "nm": "nM",
        "nM": "nM",
        "mm": "mM",
        "mM": "mM",
    }
    return unit_map.get(unit, unit)


def parse_concentration(conc: float, from_unit: str, to_unit: str, mw_gmol: float = 1000.0) -> float:
    from_unit = normalize_concentration_unit(from_unit)
    to_unit = normalize_concentration_unit(to_unit)

    if from_unit == to_unit:
        return conc

    from_type = _get_concentration_type(from_unit)
    to_type = _get_concentration_type(to_unit)

    if from_type == to_type:
        if from_type == "mass_per_volume":
            return _convert_mass_per_volume(conc, from_unit, to_unit)
        elif from_type == "molar":
            return _convert_molar(conc, from_unit, to_unit)

    return _convert_between_mass_and_molar(conc, from_unit, to_unit, mw_gmol)


def _get_concentration_type(unit: str) -> str:
    mass_per_volume_units = ["ng/ul", "pg/ul", "ug/ul", "mg/ml", "ng/ml"]
    molar_units = ["uM", "nM", "mM"]

    if unit in mass_per_volume_units:
        return "mass_per_volume"
    elif unit in molar_units:
        return "molar"
    else:
        raise ValueError(f"未知浓度单位: {unit}")


def _convert_mass_per_volume(conc: float, from_unit: str, to_unit: str) -> float:
    from_mass, from_vol = _parse_mass_per_volume_unit(from_unit)
    to_mass, to_vol = _parse_mass_per_volume_unit(to_unit)

    mass_factor = MASS_CONVERSIONS[from_mass][to_mass]
    vol_factor = VOLUME_CONVERSIONS[from_vol][to_vol]

    return conc * mass_factor / vol_factor


def _parse_mass_per_volume_unit(unit: str) -> Tuple[str, str]:
    parts = unit.split("/")
    if len(parts) != 2:
        raise ValueError(f"无效的质量/体积单位格式: {unit}")

    mass_part = parts[0].lower()
    vol_part = parts[1].lower()

    return mass_part, vol_part


def _convert_molar(conc: float, from_unit: str, to_unit: str) -> float:
    from_u = _normalize_molar_unit(from_unit)
    to_u = _normalize_molar_unit(to_unit)

    if from_u not in MOLAR_CONVERSIONS:
        raise ValueError(f"未知摩尔浓度单位: {from_unit}")
    if to_u not in MOLAR_CONVERSIONS:
        raise ValueError(f"未知摩尔浓度单位: {to_unit}")

    return conc * MOLAR_CONVERSIONS[from_u][to_u]


def _normalize_molar_unit(unit: str) -> str:
    unit_lower = unit.lower()
    mapping = {
        "m": "M",
        "mm": "mM",
        "um": "uM",
        "nm": "nM",
        "pm": "pM",
    }
    return mapping.get(unit_lower, unit)


def _convert_between_mass_and_molar(
    conc: float, from_unit: str, to_unit: str, mw_gmol: float) -> float:
    from_type = _get_concentration_type(from_unit)
    to_type = _get_concentration_type(to_unit)

    if from_type == "mass_per_volume" and to_type == "molar":
        conc_ug_ml = _convert_mass_per_volume(conc, from_unit, "ng/ml")
        conc_g_l = conc_ug_ml * 1e-6
        molar_conc = conc_g_l / mw_gmol
        return _convert_molar(molar_conc, "M", to_unit)

    elif from_type == "molar" and to_type == "mass_per_volume":
        conc_m = _convert_molar(conc, from_unit, "M")
        conc_g_l = conc_m * mw_gmol
        conc_ng_ml = conc_g_l * 1e6
        return _convert_mass_per_volume(conc_ng_ml, "ng/ml", to_unit)

    raise ValueError(f"无法在 {from_unit} 和 {to_unit} 之间进行转换")


def convert_volume(volume: float, from_unit: str, to_unit: str) -> float:
    from_unit = from_unit.lower()
    to_unit = to_unit.lower()

    if from_unit not in VOLUME_CONVERSIONS:
        raise ValueError(f"未知体积单位: {from_unit}")
    if to_unit not in VOLUME_CONVERSIONS:
        raise ValueError(f"未知体积单位: {to_unit}")

    return volume * VOLUME_CONVERSIONS[from_unit][to_unit]


def to_ul(volume: float, unit: str) -> float:
    return convert_volume(volume, unit, "ul")


def from_ul(volume: float, unit: str) -> float:
    return convert_volume(volume, "ul", unit)
