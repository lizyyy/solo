from __future__ import annotations
import math
from datetime import datetime

from .models import (
    CalcStatus,
    OverrideFlag,
    ParameterEntry,
    ReportExport,
    WaterHammerInput,
    WaterHammerResult,
)

STEEL_ELASTIC_MODULUS = 200e9


def calculate_wave_speed(input_data: WaterHammerInput) -> float:
    if input_data.wave_speed is not None:
        return input_data.wave_speed
    K = input_data.bulk_modulus
    rho = input_data.fluid_density
    D = input_data.pipe_diameter
    t = input_data.wall_thickness
    E = STEEL_ELASTIC_MODULUS
    a = math.sqrt((K / rho) / (1 + (K * D) / (E * t)))
    return a


def calculate_joukowsky(input_data: WaterHammerInput, wave_speed: float) -> float:
    return input_data.fluid_density * wave_speed * input_data.initial_velocity


def classify_result(pressure_rise: float, override_flags: list[OverrideFlag]) -> str:
    for flag in override_flags:
        if flag.needs_review and flag.reason is None:
            return CalcStatus.NEEDS_REVIEW.value
    if pressure_rise > 10e6:
        return CalcStatus.NEEDS_REVIEW.value
    return CalcStatus.DRAFT.value


def aggregate_next_actions(entries: list[ParameterEntry]) -> list[str]:
    actions: list[str] = []
    for entry in entries:
        if entry.next_action:
            actions.append(entry.next_action)
    return actions


def build_replay_narrative(
    entries: list[ParameterEntry], override_flags: list[OverrideFlag]
) -> str:
    lines: list[str] = []
    for entry in entries:
        source_label = entry.provenance.source.value
        line = f"参数「{entry.name}」（{entry.value} {entry.unit}）来源：{source_label}，{entry.provenance.detail}"
        if entry.is_manually_modified:
            if entry.modification_reason:
                line += f"；已人工修改，原因：{entry.modification_reason}"
            else:
                line += "；已人工修改，未提供原因"
        if entry.missing_materials:
            line += f"；缺少材料：{', '.join(entry.missing_materials)}"
        if entry.next_action:
            line += f"；下一步：{entry.next_action}"
        lines.append(line)
    for flag in override_flags:
        line = (
            f"系数「{flag.parameter_name}」已从 {flag.original_value} 人工改为 {flag.overridden_value}"
        )
        if flag.reason is None:
            line += "，未提供修改原因，需设备工程师复核"
        lines.append(line)
    return "\n".join(lines)


def build_report_export(
    calc_id: str, input_data: WaterHammerInput, result: WaterHammerResult
) -> ReportExport:
    summary = {
        "pipe_length": input_data.pipe_length,
        "pipe_diameter": input_data.pipe_diameter,
        "wall_thickness": input_data.wall_thickness,
        "fluid_density": input_data.fluid_density,
        "bulk_modulus": input_data.bulk_modulus,
        "wave_speed_used": result.wave_speed_used,
        "valve_closing_time": input_data.valve_closing_time,
        "initial_velocity": input_data.initial_velocity,
        "joukowsky_pressure": result.joukowsky_pressure,
        "pressure_rise": result.pressure_rise,
        "max_pressure": result.max_pressure,
    }
    return ReportExport(
        calc_id=calc_id,
        export_timestamp=datetime.now(),
        status=result.status.value,
        summary=summary,
        parameter_entries=result.parameter_entries,
        override_flags=result.override_flags,
        replay_narrative=result.replay_narrative,
        change_history=result.change_history,
        next_action_summary=aggregate_next_actions(result.parameter_entries),
    )


def run_calculation(input_data: WaterHammerInput) -> WaterHammerResult:
    wave_speed = calculate_wave_speed(input_data)
    joukowsky_pressure = calculate_joukowsky(input_data, wave_speed)
    pressure_rise = joukowsky_pressure
    override_flags: list[OverrideFlag] = []
    for entry in input_data.parameter_entries:
        if entry.is_manually_modified and entry.modification_reason is None:
            override_flags.append(
                OverrideFlag(
                    parameter_name=entry.name,
                    original_value=entry.value,
                    overridden_value=entry.value,
                    reason=None,
                    needs_review=True,
                    reviewer=None,
                )
            )
    classification = classify_result(pressure_rise, override_flags)
    max_pressure = pressure_rise
    replay_narrative = build_replay_narrative(input_data.parameter_entries, override_flags)
    status_value = classification
    status_enum = CalcStatus(status_value)
    return WaterHammerResult(
        max_pressure=max_pressure,
        pressure_rise=pressure_rise,
        joukowsky_pressure=joukowsky_pressure,
        wave_speed_used=wave_speed,
        classification=classification,
        parameter_entries=input_data.parameter_entries,
        override_flags=override_flags,
        replay_narrative=replay_narrative,
        status=status_enum,
    )
