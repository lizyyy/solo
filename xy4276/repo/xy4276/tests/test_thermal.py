from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np
import pytest

from kiln_analyzer.models import (
    CurvePhase,
    PhaseType,
    TargetCurve,
    ThermocoupleData,
)
from kiln_analyzer.thermal.deviation_calculator import PhaseDeviationCalculator
from kiln_analyzer.thermal.heat_integral import HeatIntegralCalculator


class TestPhaseDeviationCalculator:
    def setup_method(self):
        self.calculator = PhaseDeviationCalculator()

    def _create_sample_tc_data(self, num_points: int = 10) -> list:
        data = []
        for i in range(num_points):
            elapsed = i * 60.0
            temp_base = 25 + (i * 20)
            data.append(
                ThermocoupleData(
                    timestamp=datetime.now(),
                    temperatures={
                        "top": temp_base + 5.0,
                        "middle": temp_base,
                        "bottom": temp_base - 5.0,
                    },
                    elapsed_seconds=elapsed,
                )
            )
        return data

    def _create_sample_curve(self) -> TargetCurve:
        phases = [
            CurvePhase(
                name="升温阶段",
                phase_type=PhaseType.HEATING,
                start_temp=25,
                end_temp=200,
                start_time=0,
                duration=600.0,
                target_rate=17.5,
            ),
            CurvePhase(
                name="保温阶段",
                phase_type=PhaseType.HOLDING,
                start_temp=200,
                end_temp=200,
                start_time=600,
                duration=300.0,
            ),
        ]
        return TargetCurve(
            name="测试曲线",
            phases=phases,
            total_duration=900.0,
            max_temp=200.0,
        )

    def test_calculate_single_phase_heating(self):
        tc_data = self._create_sample_tc_data(20)
        curve = self._create_sample_curve()

        deviations = self.calculator.calculate_all_phases(curve, tc_data)

        assert len(deviations) == 2
        assert deviations[0].phase_name == "升温阶段"
        assert deviations[0].phase_type == PhaseType.HEATING

    def test_generate_target_profile_heating(self):
        phase = CurvePhase(
            name="test",
            phase_type=PhaseType.HEATING,
            start_temp=25,
            end_temp=200,
            start_time=0,
            duration=600,
        )

        profile = self.calculator._generate_target_profile(phase, 10)

        assert len(profile) == 10
        assert profile[0] == 25.0
        assert profile[-1] == 200.0

    def test_generate_target_profile_holding(self):
        phase = CurvePhase(
            name="test",
            phase_type=PhaseType.HOLDING,
            start_temp=1240,
            end_temp=1240,
            start_time=0,
            duration=3600,
        )

        profile = self.calculator._generate_target_profile(phase, 10)

        assert len(profile) == 10
        assert all(t == 1240.0 for t in profile)

    def test_deviation_summary(self):
        tc_data = self._create_sample_tc_data(20)
        curve = self._create_sample_curve()
        deviations = self.calculator.calculate_all_phases(curve, tc_data)

        summary = PhaseDeviationCalculator.get_deviation_summary(deviations)

        assert "top" in summary
        assert "middle" in summary
        assert "bottom" in summary
        assert summary["top"]["phase_count"] > 0


class TestHeatIntegralCalculator:
    def setup_method(self):
        self.calculator = HeatIntegralCalculator(base_temp=20.0)

    def _create_sample_tc_data(self) -> list:
        data = []
        temps = [25, 100, 200, 300, 400, 300, 200, 100, 50]
        for i, temp in enumerate(temps):
            data.append(
                ThermocoupleData(
                    timestamp=datetime.now(),
                    temperatures={
                        "top": temp + 5.0,
                        "middle": temp,
                        "bottom": temp - 5.0,
                    },
                    elapsed_seconds=i * 60.0,
                )
            )
        return data

    def _create_sample_phase(self) -> CurvePhase:
        return CurvePhase(
            name="测试阶段",
            phase_type=PhaseType.HEATING,
            start_temp=25,
            end_temp=400,
            start_time=0,
            duration=480.0,
        )

    def _create_sample_curve(self) -> TargetCurve:
        phase = self._create_sample_phase()
        return TargetCurve(
            name="测试曲线",
            phases=[phase],
            total_duration=480.0,
            max_temp=400.0,
        )

    def test_calculate_single_phase(self):
        tc_data = self._create_sample_tc_data()
        curve = self._create_sample_curve()

        integrals = self.calculator.calculate_all_phases(curve, tc_data)

        assert len(integrals) == 1
        assert integrals[0].phase_name == "测试阶段"
        assert integrals[0].total_heat > 0
        assert len(integrals[0].heat_by_layer) == 3

    def test_calculate_layer_heat(self):
        tc_data = self._create_sample_tc_data()

        heat = self.calculator._calculate_layer_heat(tc_data, "middle")

        assert heat > 0

    def test_calculate_total_heat(self):
        tc_data = self._create_sample_tc_data()
        curve = self._create_sample_curve()
        integrals = self.calculator.calculate_all_phases(curve, tc_data)

        total_heat, layer_totals = self.calculator.calculate_total_heat(integrals)

        assert total_heat > 0
        assert len(layer_totals) == 3

    def test_format_heat_value(self):
        assert HeatIntegralCalculator.format_heat_value(500) == "500.00 °C·s"
        assert HeatIntegralCalculator.format_heat_value(5000) == "5.00 k°C·s"
        assert HeatIntegralCalculator.format_heat_value(5000000) == "5.00 M°C·s"

    def test_heat_rate_profile(self):
        tc_data = self._create_sample_tc_data()

        profiles = self.calculator.calculate_heat_rate_profile(tc_data, window_size=3)

        assert len(profiles) > 0
        assert "middle" in profiles
        assert len(profiles["middle"]) > 0
