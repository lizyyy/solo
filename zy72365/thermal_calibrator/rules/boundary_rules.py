from __future__ import annotations

import re
from typing import Optional

from thermal_calibrator.models.calibration_record import (
    TemperatureUnit,
    UnitConflictAction,
    UnitConflictRecord,
)


_ABSOLUTE_ZERO_C = -273.15
_THERMAL_IMAGER_MIN_C = -40.0
_THERMAL_IMAGER_MAX_C = 2000.0

_CELSIUS_PATTERNS = [
    re.compile(r"°C", re.IGNORECASE),
    re.compile(r"\u2103"),
    re.compile(r"deg\s*c", re.IGNORECASE),
    re.compile(r"degree\s*c", re.IGNORECASE),
    re.compile(r"celsius", re.IGNORECASE),
    re.compile(r"centigrade", re.IGNORECASE),
]

_KELVIN_PATTERNS = [
    re.compile(r"\bK\b"),
    re.compile(r"kelvin", re.IGNORECASE),
    re.compile(r"deg\s*k", re.IGNORECASE),
]


def detect_unit(text: str) -> list[TemperatureUnit]:
    found: list[TemperatureUnit] = []
    for pat in _CELSIUS_PATTERNS:
        if pat.search(text):
            found.append(TemperatureUnit.CELSIUS)
            break
    for pat in _KELVIN_PATTERNS:
        if pat.search(text):
            found.append(TemperatureUnit.KELVIN)
            break
    if not found:
        found.append(TemperatureUnit.CELSIUS)
    return found


def is_unit_conflict(units: list[TemperatureUnit]) -> bool:
    return TemperatureUnit.CELSIUS in units and TemperatureUnit.KELVIN in units


def is_value_plausible_for_unit(value: float, unit: TemperatureUnit) -> bool:
    if unit == TemperatureUnit.CELSIUS:
        return _THERMAL_IMAGER_MIN_C <= value <= _THERMAL_IMAGER_MAX_C
    value_c = value - 273.15
    return _THERMAL_IMAGER_MIN_C <= value_c <= _THERMAL_IMAGER_MAX_C


def celsius_to_kelvin(c: float) -> float:
    return c + 273.15


def kelvin_to_celsius(k: float) -> float:
    return k - 273.15


def judge_conflict(
    line_number: int,
    raw_text: str,
    detected_units: list[TemperatureUnit],
    value: Optional[float] = None,
) -> UnitConflictRecord:
    if not is_unit_conflict(detected_units):
        primary = detected_units[0] if detected_units else TemperatureUnit.CELSIUS
        return UnitConflictRecord(
            line_number=line_number,
            detected_units=detected_units,
            action_taken=UnitConflictAction.KEEP_ORIGINAL,
            original_raw=raw_text,
            resolved_value=value,
            resolved_unit=primary,
            needs_coach_review=False,
        )

    if value is not None:
        plausible_c = is_value_plausible_for_unit(value, TemperatureUnit.CELSIUS)
        plausible_k = is_value_plausible_for_unit(value, TemperatureUnit.KELVIN)

        if plausible_c and not plausible_k:
            return UnitConflictRecord(
                line_number=line_number,
                detected_units=detected_units,
                action_taken=UnitConflictAction.AUTO_CONVERT_KELVIN_TO_CELSIUS,
                original_raw=raw_text,
                resolved_value=value,
                resolved_unit=TemperatureUnit.CELSIUS,
                needs_coach_review=False,
            )

        if plausible_k and not plausible_c:
            converted = kelvin_to_celsius(value)
            return UnitConflictRecord(
                line_number=line_number,
                detected_units=detected_units,
                action_taken=UnitConflictAction.AUTO_CONVERT_KELVIN_TO_CELSIUS,
                original_raw=raw_text,
                resolved_value=converted,
                resolved_unit=TemperatureUnit.CELSIUS,
                needs_coach_review=False,
            )

    return UnitConflictRecord(
        line_number=line_number,
        detected_units=detected_units,
        action_taken=UnitConflictAction.PENDING_COACH_REVIEW,
        original_raw=raw_text,
        resolved_value=value,
        resolved_unit=None,
        needs_coach_review=True,
    )


def rollback_conflict(conflict: UnitConflictRecord) -> UnitConflictRecord:
    return UnitConflictRecord(
        line_number=conflict.line_number,
        detected_units=conflict.detected_units,
        action_taken=UnitConflictAction.ROLLED_BACK,
        original_raw=conflict.original_raw,
        resolved_value=None,
        resolved_unit=None,
        needs_coach_review=True,
        coach_review_note=(conflict.coach_review_note or "") + " [已回滚，等待教练重新复核]",
    )


def coach_resolve_conflict(
    conflict: UnitConflictRecord,
    resolved_value: float,
    resolved_unit: TemperatureUnit,
    coach_note: str,
) -> UnitConflictRecord:
    return UnitConflictRecord(
        line_number=conflict.line_number,
        detected_units=conflict.detected_units,
        action_taken=UnitConflictAction.COACH_RESOLVED,
        original_raw=conflict.original_raw,
        resolved_value=resolved_value,
        resolved_unit=resolved_unit,
        needs_coach_review=False,
        coach_review_note=coach_note,
    )
