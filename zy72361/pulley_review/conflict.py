from __future__ import annotations

from datetime import datetime

from .models import (
    ChatScreenshot,
    ConflictEvidence,
    ConflictResolution,
    SamplingIntervalNote,
    TempUnit,
)


def _temps_conflict(
    s_val: float, s_unit: TempUnit, n_val: float, n_unit: TempUnit, tolerance: float = 0.5
) -> bool:
    if s_unit == n_unit:
        return abs(s_val - n_val) > tolerance
    if s_unit == TempUnit.CELSIUS and n_unit == TempUnit.KELVIN:
        return abs(s_val + 273.15 - n_val) > tolerance
    if s_unit == TempUnit.KELVIN and n_unit == TempUnit.CELSIUS:
        return abs(s_val - 273.15 - n_val) > tolerance
    return True


def _efficiency_conflict(s_eff: float, n_eff: float, tolerance: float = 0.01) -> bool:
    return abs(s_eff - n_eff) > tolerance


def detect_conflicts(
    screenshots: list[ChatScreenshot],
    notes: list[SamplingIntervalNote],
) -> list[ConflictEvidence]:
    conflicts: list[ConflictEvidence] = []
    for ss in screenshots:
        for note in notes:
            if ss.equipment_id != note.equipment_id:
                continue
            temp_conflict = _temps_conflict(
                ss.temperature_value, ss.temperature_unit,
                note.temperature_value, note.temperature_unit,
            )
            eff_conflict = _efficiency_conflict(ss.efficiency, note.efficiency)
            if temp_conflict or eff_conflict:
                conflicts.append(
                    ConflictEvidence(
                        screenshot_id=ss.id,
                        note_id=note.id,
                        equipment_id=ss.equipment_id,
                        screenshot_temp=(ss.temperature_value, ss.temperature_unit),
                        note_temp=(note.temperature_value, note.temperature_unit),
                        screenshot_efficiency=ss.efficiency,
                        note_efficiency=note.efficiency,
                    )
                )
    return conflicts


def resolve_conflict(
    conflict: ConflictEvidence,
    resolution: ConflictResolution,
    resolved_by: str,
    note: str = "",
) -> ConflictEvidence:
    conflict.resolution = resolution
    conflict.resolved_by = resolved_by
    conflict.resolved_at = datetime.now()
    conflict.resolution_note = note
    return conflict
