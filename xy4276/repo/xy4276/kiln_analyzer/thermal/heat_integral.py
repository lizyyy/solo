from typing import Dict, List, Optional, Tuple

import numpy as np

from kiln_analyzer.models import (
    CurvePhase,
    HeatIntegral,
    TargetCurve,
    ThermocoupleData,
)


class HeatIntegralCalculator:
    def __init__(self, base_temp: float = 20.0):
        self.base_temp = base_temp

    def calculate_all_phases(
        self,
        target_curve: TargetCurve,
        tc_data: List[ThermocoupleData],
        reference_heats: Optional[Dict[str, float]] = None,
    ) -> List[HeatIntegral]:
        results: List[HeatIntegral] = []
        reference_heats = reference_heats or {}

        for phase in target_curve.phases:
            integral = self.calculate_single_phase(phase, tc_data)

            phase_key = phase.name.lower().replace(" ", "_")
            if phase_key in reference_heats:
                integral.reference_heat = reference_heats[phase_key]
                if integral.reference_heat > 0:
                    integral.deviation_percent = (
                        (integral.total_heat - integral.reference_heat)
                        / integral.reference_heat
                        * 100
                    )

            results.append(integral)

        return results

    def calculate_single_phase(
        self,
        phase: CurvePhase,
        tc_data: List[ThermocoupleData],
    ) -> HeatIntegral:
        phase_start = phase.start_time
        phase_end = phase.start_time + phase.duration

        phase_tc_data = [
            d
            for d in tc_data
            if d.elapsed_seconds is not None
            and phase_start <= d.elapsed_seconds <= phase_end
        ]

        if len(phase_tc_data) < 2:
            return HeatIntegral(
                phase_name=phase.name,
                total_heat=0.0,
                heat_by_layer={},
            )

        heat_by_layer: Dict[str, float] = {}
        tc_names = phase_tc_data[0].temperatures.keys()

        for tc_name in tc_names:
            layer_heat = self._calculate_layer_heat(phase_tc_data, tc_name)
            heat_by_layer[tc_name] = layer_heat

        if heat_by_layer:
            total_heat = sum(heat_by_layer.values()) / len(heat_by_layer)
        else:
            total_heat = 0.0

        return HeatIntegral(
            phase_name=phase.name,
            total_heat=total_heat,
            heat_by_layer=heat_by_layer,
        )

    def _calculate_layer_heat(
        self,
        phase_tc_data: List[ThermocoupleData],
        tc_name: str,
    ) -> float:
        temps: List[float] = []
        times: List[float] = []

        for d in phase_tc_data:
            if d.elapsed_seconds is not None:
                temps.append(d.temperatures.get(tc_name, 0.0))
                times.append(d.elapsed_seconds)

        if len(temps) < 2 or len(times) < 2:
            return 0.0

        temps_array = np.array(temps)
        times_array = np.array(times)

        effective_temps = np.maximum(temps_array - self.base_temp, 0.0)

        heat_integral = np.trapz(effective_temps, times_array)

        return float(heat_integral)

    def calculate_total_heat(
        self,
        integrals: List[HeatIntegral],
    ) -> Tuple[float, Dict[str, float]]:
        total_heat = sum(i.total_heat for i in integrals)

        layer_totals: Dict[str, float] = {}
        for integral in integrals:
            for layer_name, heat in integral.heat_by_layer.items():
                if layer_name not in layer_totals:
                    layer_totals[layer_name] = 0.0
                layer_totals[layer_name] += heat

        return total_heat, layer_totals

    def calculate_heat_rate_profile(
        self,
        tc_data: List[ThermocoupleData],
        window_size: int = 5,
    ) -> Dict[str, List[Tuple[float, float]]]:
        profiles: Dict[str, List[Tuple[float, float]]] = {}

        if len(tc_data) < window_size:
            return profiles

        tc_names = tc_data[0].temperatures.keys()

        for tc_name in tc_names:
            profile: List[Tuple[float, float]] = []
            temps = [d.temperatures[tc_name] for d in tc_data]
            times = [
                d.elapsed_seconds for d in tc_data if d.elapsed_seconds is not None
            ]

            if len(times) < window_size:
                continue

            for i in range(window_size, len(temps)):
                window_temps = temps[i - window_size : i]
                window_times = times[i - window_size : i]

                temp_change = window_temps[-1] - window_temps[0]
                time_change = (window_times[-1] - window_times[0]) / 60

                if time_change > 0:
                    rate = temp_change / time_change
                else:
                    rate = 0.0

                mid_time = (window_times[0] + window_times[-1]) / 2
                profile.append((mid_time, rate))

            profiles[tc_name] = profile

        return profiles

    @staticmethod
    def format_heat_value(heat: float) -> str:
        if heat >= 1_000_000:
            return f"{heat / 1_000_000:.2f} M°C·s"
        elif heat >= 1_000:
            return f"{heat / 1_000:.2f} k°C·s"
        else:
            return f"{heat:.2f} °C·s"
