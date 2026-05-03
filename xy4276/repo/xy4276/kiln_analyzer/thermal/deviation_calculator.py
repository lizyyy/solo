from typing import Dict, List, Optional, Tuple

import numpy as np

from kiln_analyzer.models import (
    CurvePhase,
    PhaseDeviation,
    PhaseType,
    TargetCurve,
    ThermocoupleData,
)


class PhaseDeviationCalculator:
    def __init__(self, sample_interval: float = 10.0):
        self.sample_interval = sample_interval

    def calculate_all_phases(
        self,
        target_curve: TargetCurve,
        tc_data: List[ThermocoupleData],
    ) -> List[PhaseDeviation]:
        results: List[PhaseDeviation] = []

        for phase in target_curve.phases:
            deviation = self.calculate_single_phase(phase, tc_data)
            results.append(deviation)

        return results

    def calculate_single_phase(
        self,
        phase: CurvePhase,
        tc_data: List[ThermocoupleData],
    ) -> PhaseDeviation:
        phase_start = phase.start_time
        phase_end = phase.start_time + phase.duration

        phase_tc_data = [
            d
            for d in tc_data
            if d.elapsed_seconds is not None
            and phase_start <= d.elapsed_seconds <= phase_end
        ]

        if not phase_tc_data:
            return self._create_empty_deviation(phase)

        target_profile = self._generate_target_profile(phase, len(phase_tc_data))

        actual_profiles: Dict[str, List[float]] = {}
        tc_names = phase_tc_data[0].temperatures.keys()

        for tc_name in tc_names:
            profile = [d.temperatures[tc_name] for d in phase_tc_data]
            actual_profiles[tc_name] = profile

        avg_deviation: Dict[str, float] = {}
        max_deviation: Dict[str, float] = {}

        for tc_name, actual in actual_profiles.items():
            if len(actual) == len(target_profile):
                deviations = np.array(actual) - np.array(target_profile)
                avg_deviation[tc_name] = float(np.mean(deviations))
                max_deviation[tc_name] = float(np.max(np.abs(deviations)))
            else:
                avg_deviation[tc_name] = 0.0
                max_deviation[tc_name] = 0.0

        rate_deviation: Optional[Dict[str, float]] = None
        if phase.phase_type in [PhaseType.HEATING, PhaseType.COOLING]:
            rate_deviation = self._calculate_rate_deviation(
                phase, phase_tc_data, tc_names
            )

        hold_deviation: Optional[float] = None
        if phase.phase_type == PhaseType.HOLDING:
            hold_deviation = self._calculate_hold_deviation(phase, phase_tc_data)

        return PhaseDeviation(
            phase_name=phase.name,
            phase_type=phase.phase_type,
            target_temp_profile=target_profile,
            actual_temp_profile=actual_profiles,
            avg_temp_deviation=avg_deviation,
            max_temp_deviation=max_deviation,
            rate_deviation=rate_deviation,
            hold_deviation_seconds=hold_deviation,
        )

    def _generate_target_profile(
        self, phase: CurvePhase, num_points: int
    ) -> List[float]:
        if num_points < 2:
            return [phase.start_temp]

        if phase.phase_type == PhaseType.HOLDING:
            return [phase.start_temp] * num_points

        temp_range = phase.end_temp - phase.start_temp
        step = temp_range / (num_points - 1)
        return [phase.start_temp + step * i for i in range(num_points)]

    def _calculate_rate_deviation(
        self,
        phase: CurvePhase,
        phase_tc_data: List[ThermocoupleData],
        tc_names: List[str],
    ) -> Dict[str, float]:
        deviations: Dict[str, float] = {}

        if len(phase_tc_data) < 2:
            for tc_name in tc_names:
                deviations[tc_name] = 0.0
            return deviations

        for tc_name in tc_names:
            temps = [d.temperatures[tc_name] for d in phase_tc_data]
            times = [d.elapsed_seconds for d in phase_tc_data if d.elapsed_seconds]

            if len(times) < 2:
                deviations[tc_name] = 0.0
                continue

            temp_change = temps[-1] - temps[0]
            time_change = (times[-1] - times[0]) / 60

            if time_change > 0:
                actual_rate = temp_change / time_change
            else:
                actual_rate = 0.0

            target_rate = phase.target_rate or 0.0

            if phase.phase_type == PhaseType.COOLING and target_rate > 0:
                target_rate = -target_rate

            deviations[tc_name] = actual_rate - target_rate

        return deviations

    def _calculate_hold_deviation(
        self,
        phase: CurvePhase,
        phase_tc_data: List[ThermocoupleData],
        tolerance: float = 5.0,
    ) -> float:
        if len(phase_tc_data) < 2:
            return 0.0

        target_temp = phase.start_temp
        total_time = 0.0
        out_of_tolerance_time = 0.0

        for i in range(len(phase_tc_data) - 1):
            current = phase_tc_data[i]
            next_data = phase_tc_data[i + 1]

            if current.elapsed_seconds is None or next_data.elapsed_seconds is None:
                continue

            interval = next_data.elapsed_seconds - current.elapsed_seconds
            total_time += interval

            avg_temps = [
                (current.temperatures[tc] + next_data.temperatures[tc]) / 2
                for tc in current.temperatures
            ]
            avg_temp = sum(avg_temps) / len(avg_temps)

            if abs(avg_temp - target_temp) > tolerance:
                out_of_tolerance_time += interval

        return out_of_tolerance_time

    def _create_empty_deviation(self, phase: CurvePhase) -> PhaseDeviation:
        return PhaseDeviation(
            phase_name=phase.name,
            phase_type=phase.phase_type,
            target_temp_profile=[],
            actual_temp_profile={},
            avg_temp_deviation={},
            max_temp_deviation={},
            rate_deviation=None,
            hold_deviation_seconds=None,
        )

    @staticmethod
    def get_deviation_summary(
        deviations: List[PhaseDeviation],
    ) -> Dict[str, Dict[str, float]]:
        summary: Dict[str, Dict[str, float]] = {}

        for dev in deviations:
            for tc_name, avg_dev in dev.avg_temp_deviation.items():
                if tc_name not in summary:
                    summary[tc_name] = {
                        "total_abs_deviation": 0.0,
                        "max_deviation": 0.0,
                        "phase_count": 0,
                    }

                summary[tc_name]["total_abs_deviation"] += abs(avg_dev)
                max_dev = dev.max_temp_deviation.get(tc_name, 0.0)
                if max_dev > summary[tc_name]["max_deviation"]:
                    summary[tc_name]["max_deviation"] = max_dev
                summary[tc_name]["phase_count"] += 1

        return summary
