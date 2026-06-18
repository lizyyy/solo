from __future__ import annotations

import re
from typing import Tuple, Optional, List

from models import NormalizedTide, TideUnit


UNIT_ALIASES = {
    TideUnit.METERS: ['m', 'meter', 'meters', 'metre', 'metres', '米', '公尺'],
    TideUnit.CENTIMETERS: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres', '厘米', '公分'],
    TideUnit.FEET: ['ft', 'feet', 'foot', '英尺', '呎'],
}

FEET_TO_METERS = 0.3048
CM_TO_METERS = 0.01


def _detect_unit(raw_unit: str) -> Tuple[TideUnit, str]:
    if raw_unit is None:
        return TideUnit.UNKNOWN, ''

    cleaned = raw_unit.strip().lower()
    if not cleaned:
        return TideUnit.UNKNOWN, raw_unit

    for unit, aliases in UNIT_ALIASES.items():
        if cleaned in [a.lower() for a in aliases]:
            return unit, raw_unit

    for unit, aliases in UNIT_ALIASES.items():
        for alias in aliases:
            if alias.lower() in cleaned:
                return unit, raw_unit

    return TideUnit.UNKNOWN, raw_unit


def _extract_value_and_unit(raw_value: str, raw_unit: str) -> Tuple[Optional[float], TideUnit, str, List[str]]:
    notes: List[str] = []
    original_value_raw = raw_value.strip() if raw_value else ''
    combined = f"{raw_value or ''} {raw_unit or ''}".strip()

    if raw_unit:
        detected_unit, unit_raw = _detect_unit(raw_unit)
    else:
        detected_unit = TideUnit.UNKNOWN
        unit_raw = ''

    value_match = re.search(r'(-?\d+\.?\d*)', original_value_raw)
    if not value_match:
        value_match = re.search(r'(-?\d+\.?\d*)', combined)

    if not value_match:
        return None, detected_unit, unit_raw, [f"无法从 '{combined}' 中提取数值"]

    try:
        raw_numeric = float(value_match.group(1))
    except ValueError:
        return None, detected_unit, unit_raw, [f"数值解析失败: {value_match.group(1)}"]

    if detected_unit == TideUnit.UNKNOWN:
        unit_from_combined = re.search(r'(m|cm|ft|米|厘米|公分|英尺|呎)', combined, re.IGNORECASE)
        if unit_from_combined:
            detected_unit, _ = _detect_unit(unit_from_combined.group(1))
            if detected_unit != TideUnit.UNKNOWN:
                notes.append(f"从数值串中识别单位: {unit_from_combined.group(1)}")
                unit_raw = unit_from_combined.group(1)

    return raw_numeric, detected_unit, unit_raw if unit_raw else raw_unit, notes


def normalize_tide(raw_value: str, raw_unit: str) -> NormalizedTide:
    raw_numeric, detected_unit, original_unit_raw, notes = _extract_value_and_unit(raw_value, raw_unit)

    if raw_numeric is None:
        return NormalizedTide(
            value_meters=0.0,
            original_value=raw_value or '',
            original_unit=TideUnit.UNKNOWN,
            original_unit_raw=raw_unit or '',
            normalize_notes=notes
        )

    if detected_unit == TideUnit.METERS:
        value_m = raw_numeric
    elif detected_unit == TideUnit.CENTIMETERS:
        value_m = raw_numeric * CM_TO_METERS
        notes.append(f"厘米转米: {raw_numeric} cm × {CM_TO_METERS} = {value_m} m")
    elif detected_unit == TideUnit.FEET:
        value_m = raw_numeric * FEET_TO_METERS
        notes.append(f"英尺转米: {raw_numeric} ft × {FEET_TO_METERS} = {value_m:.4f} m")
    else:
        value_m = raw_numeric
        notes.append(
            f"单位未识别，保留原始数值 {raw_numeric}，按米处理（需人工复核）。原始单位字符串: '{raw_unit or '(空)'}"
        )

    return NormalizedTide(
        value_meters=round(value_m, 6),
        original_value=raw_value or '',
        original_unit=detected_unit,
        original_unit_raw=original_unit_raw or (raw_unit or ''),
        normalize_notes=notes
    )


def tide_to_original_string(tide: NormalizedTide) -> str:
    if tide.original_unit == TideUnit.UNKNOWN:
        return f"{tide.original_value} (单位未知)"
    unit_display = {
        TideUnit.METERS: 'm',
        TideUnit.CENTIMETERS: 'cm',
        TideUnit.FEET: 'ft',
    }.get(tide.original_unit, tide.original_unit_raw)
    return f"{tide.original_value} {unit_display}".strip()
