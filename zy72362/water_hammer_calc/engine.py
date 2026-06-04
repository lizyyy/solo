from __future__ import annotations
import math

from .models import (
    OverrideFlag,
    ParameterEntry,
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
            return "\u9700\u8bbe\u5907\u5de5\u7a0b\u5e08\u590d\u6838"
    if pressure_rise > 10e6:
        return "\u9700\u8bbe\u5907\u5de5\u7a0b\u5e08\u590d\u6838"
    return "\u6b63\u5e38"


def build_replay_narrative(
    entries: list[ParameterEntry], override_flags: list[OverrideFlag]
) -> str:
    lines: list[str] = []
    for entry in entries:
        source_label = entry.provenance.source.value
        line = f"\u53c2\u6570\u300c{entry.name}\u300d\uff08{entry.value} {entry.unit}\uff09\u6765\u6e90\uff1a{source_label}\uff0c{entry.provenance.detail}"
        if entry.is_manually_modified:
            if entry.modification_reason:
                line += f"\uff1b\u5df2\u4eba\u5de5\u4fee\u6539\uff0c\u539f\u56e0\uff1a{entry.modification_reason}"
            else:
                line += "\uff1b\u5df2\u4eba\u5de5\u4fee\u6539\uff0c\u672a\u63d0\u4f9b\u539f\u56e0"
        if entry.missing_materials:
            line += f"\uff1b\u7f3a\u5c11\u6750\u6599\uff1a{', '.join(entry.missing_materials)}"
        if entry.next_action:
            line += f"\uff1b\u4e0b\u4e00\u6b65\uff1a{entry.next_action}"
        lines.append(line)
    for flag in override_flags:
        line = (
            f"\u7cfb\u6570\u300c{flag.parameter_name}\u300d\u5df2\u4ece {flag.original_value} \u4eba\u5de5\u6539\u4e3a {flag.overridden_value}"
        )
        if flag.reason is None:
            line += "\uff0c\u672a\u63d0\u4f9b\u4fee\u6539\u539f\u56e0\uff0c\u9700\u8bbe\u5907\u5de5\u7a0b\u5e08\u590d\u6838"
        lines.append(line)
    return "\n".join(lines)


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
    return WaterHammerResult(
        max_pressure=max_pressure,
        pressure_rise=pressure_rise,
        joukowsky_pressure=joukowsky_pressure,
        wave_speed_used=wave_speed,
        classification=classification,
        parameter_entries=input_data.parameter_entries,
        override_flags=override_flags,
        replay_narrative=replay_narrative,
    )
