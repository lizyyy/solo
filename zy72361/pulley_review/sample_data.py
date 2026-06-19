from __future__ import annotations

from datetime import datetime

from .models import (
    ChatScreenshot,
    SamplingIntervalNote,
    TempUnit,
)


def make_normal_screenshot() -> ChatScreenshot:
    return ChatScreenshot(
        id="ss-normal-001",
        equipment_id="PULLEY-A01",
        temperature_value=25.0,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.92,
        captured_at=datetime(2026, 5, 28, 10, 30, 0),
    )


def make_mixed_unit_screenshot() -> ChatScreenshot:
    return ChatScreenshot(
        id="ss-mixed-002",
        equipment_id="PULLEY-A01",
        temperature_value=298.15,
        temperature_unit=TempUnit.KELVIN,
        efficiency=0.89,
        captured_at=datetime(2026, 5, 29, 14, 15, 0),
    )


def make_old_caliber_note() -> SamplingIntervalNote:
    return SamplingIntervalNote(
        id="note-old-003",
        equipment_id="PULLEY-A01",
        temperature_value=26.5,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.88,
        interval_seconds=300,
        documented_at=datetime(2026, 5, 20, 9, 0, 0),
        is_old_caliber=True,
    )


def make_conflicting_note() -> SamplingIntervalNote:
    return SamplingIntervalNote(
        id="note-conflict-004",
        equipment_id="PULLEY-A01",
        temperature_value=35.0,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.75,
        interval_seconds=600,
        documented_at=datetime(2026, 5, 27, 11, 0, 0),
        is_old_caliber=False,
    )


def make_webcalc_screenshot_a() -> ChatScreenshot:
    return ChatScreenshot(
        id="webcalc-A01-celsius",
        equipment_id="PULLEY-A01",
        temperature_value=22.5,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.93,
        captured_at=datetime(2026, 6, 1, 9, 0, 0),
    )


def make_webcalc_screenshot_b_mixed() -> ChatScreenshot:
    return ChatScreenshot(
        id="webcalc-A01-kelvin",
        equipment_id="PULLEY-A01",
        temperature_value=296.65,
        temperature_unit=TempUnit.KELVIN,
        efficiency=0.90,
        captured_at=datetime(2026, 6, 2, 14, 30, 0),
    )


def make_old_caliber_screenshot() -> ChatScreenshot:
    return ChatScreenshot(
        id="ss-old-caliber-005",
        equipment_id="PULLEY-A01",
        temperature_value=26.5,
        temperature_unit=TempUnit.CELSIUS,
        efficiency=0.87,
        captured_at=datetime(2026, 5, 20, 9, 0, 0),
    )
