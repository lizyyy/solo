import math
import numpy as np
import pytest
from pathlib import Path
from tempfile import TemporaryDirectory

from ..models import (
    Point3D,
    Speaker,
    MeasurementPoint,
    ImpulseResponse,
    ClimateData,
    PointOverride,
    OverrideType,
    CalibrationState,
    UnitSystem,
)
from ..peak_detection.direct_peak import (
    detect_peaks,
    find_direct_peak,
    find_direct_peak_simple,
    PeakDetectionConfig,
)
from ..geometry.calculations import (
    calculate_distance,
    calculate_speed_of_sound,
    calculate_speed_of_sound_simple,
    calculate_expected_time,
    estimate_speed_of_sound_from_delays,
)
from ..validation.rules import (
    SampleRateConsistencyRule,
    TimeZeroRule,
    CoordinateUnitsRule,
    BadRowsRule,
    DuplicatePointsRule,
    run_all_validations,
)
from ..solver.delay_solver import (
    solve_delays,
    SolverConfig,
    calculate_phase_risk,
)


def generate_test_ir(
    direct_time_sec: float = 0.01,
    sample_rate: float = 48000.0,
    duration_sec: float = 0.2,
    has_reflections: bool = True,
) -> ImpulseResponse:
    n_samples = int(duration_sec * sample_rate)
    dt = 1.0 / sample_rate

    times = [i * dt for i in range(n_samples)]
    amplitudes = np.zeros(n_samples)

    direct_sample = int(direct_time_sec / dt)

    window = np.hanning(32)
    start = max(0, direct_sample - 16)
    end = min(n_samples, direct_sample + 16)
    window_len = end - start
    amplitudes[start:end] = window[:window_len]

    if has_reflections:
        reflections = [
            (direct_time_sec + 0.005, 0.7),
            (direct_time_sec + 0.012, 0.4),
            (direct_time_sec + 0.020, 0.25),
        ]
        for ref_time, ref_amp in reflections:
            ref_sample = int(ref_time / dt)
            start = max(0, ref_sample - 12)
            end = min(n_samples, ref_sample + 12)
            window_len = end - start
            amplitudes[start:end] += ref_amp * np.hanning(window_len)

    np.random.seed(42)
    amplitudes += np.random.normal(0, 0.02, n_samples)

    return ImpulseResponse(
        speaker_id="test_spk",
        point_id="test_pt",
        sample_rate=sample_rate,
        time_samples=times,
        amplitude=list(amplitudes),
    )


class TestPeakDetection:
    def test_detect_peaks_basic(self):
        ir = generate_test_ir(direct_time_sec=0.01)
        amplitude = np.array(ir.amplitude)

        peaks, heights, prominences = detect_peaks(
            amplitude, ir.sample_rate, PeakDetectionConfig()
        )

        assert len(peaks) > 0
        assert len(peaks) == len(heights) == len(prominences)

    def test_find_direct_peak(self):
        expected_time = 0.01
        ir = generate_test_ir(direct_time_sec=expected_time)

        direct_peak, all_peaks = find_direct_peak(ir)

        assert direct_peak is not None
        assert direct_peak.is_direct

        time_diff = abs(direct_peak.time_sec - expected_time)
        dt = 1.0 / ir.sample_rate
        assert time_diff < dt * 5

    def test_find_direct_peak_with_hint(self):
        expected_time = 0.015
        ir = generate_test_ir(direct_time_sec=expected_time)

        direct_peak, _ = find_direct_peak(
            ir,
            expected_time_sec=expected_time,
            config=PeakDetectionConfig(direct_peak_search_window_ms=10.0),
        )

        assert direct_peak is not None
        assert abs(direct_peak.time_sec - expected_time) < 0.002

    def test_find_direct_peak_simple(self):
        ir = generate_test_ir(direct_time_sec=0.005)
        idx, time = find_direct_peak_simple(ir)

        assert idx >= 0
        assert time >= 0


class TestGeometryCalculations:
    def test_calculate_distance(self):
        p1 = Point3D(x=0, y=0, z=0)
        p2 = Point3D(x=3, y=4, z=0)

        dist = calculate_distance(p1, p2)
        assert dist == pytest.approx(5.0)

    def test_calculate_distance_3d(self):
        p1 = Point3D(x=0, y=0, z=0)
        p2 = Point3D(x=1, y=2, z=2)

        dist = calculate_distance(p1, p2)
        assert dist == pytest.approx(3.0)

    def test_calculate_speed_of_sound(self):
        c0 = calculate_speed_of_sound_simple(0)
        c20 = calculate_speed_of_sound_simple(20)

        assert c0 == pytest.approx(331.3, abs=0.1)
        assert c20 == pytest.approx(343.4, abs=0.5)

    def test_calculate_speed_of_sound_with_humidity(self):
        c_dry = calculate_speed_of_sound(20, humidity_pct=0)
        c_humid = calculate_speed_of_sound(20, humidity_pct=100)

        assert c_humid > c_dry

    def test_calculate_expected_time(self):
        distance = 10.0
        speed = 343.0
        expected_time = distance / speed

        result = calculate_expected_time(distance, speed)
        assert result == pytest.approx(expected_time)

    def test_estimate_speed_of_sound(self):
        distances = {
            "spk1": {"pt1": 10.0, "pt2": 15.0},
            "spk2": {"pt1": 12.0, "pt2": 18.0},
        }

        true_sos = 345.0
        measured_times = {}
        for spk in distances:
            measured_times[spk] = {}
            for pt in distances[spk]:
                measured_times[spk][pt] = distances[spk][pt] / true_sos

        estimated, confidence, _ = estimate_speed_of_sound_from_delays(distances, measured_times)

        assert estimated == pytest.approx(true_sos, rel=0.01)
        assert confidence > 0.9


class TestValidationRules:
    def create_test_state(self) -> CalibrationState:
        state = CalibrationState(unit_system=UnitSystem.METERS)

        state.speakers["spk1"] = Speaker(
            id="spk1",
            name="Speaker 1",
            position=Point3D(x=-5, y=0, z=2),
        )
        state.speakers["spk2"] = Speaker(
            id="spk2",
            name="Speaker 2",
            position=Point3D(x=5, y=0, z=2),
        )

        state.points["pt1"] = MeasurementPoint(
            id="pt1",
            name="Point 1",
            position=Point3D(x=0, y=10, z=1.5),
        )
        state.points["pt2"] = MeasurementPoint(
            id="pt2",
            name="Point 2",
            position=Point3D(x=0, y=15, z=1.5),
        )

        ir1 = generate_test_ir(direct_time_sec=0.03)
        ir2 = generate_test_ir(direct_time_sec=0.045)

        state.impulse_responses["spk1"] = {"pt1": ir1, "pt2": ir2}
        state.impulse_responses["spk2"] = {"pt1": ir1, "pt2": ir2}

        return state

    def test_sample_rate_consistency_valid(self):
        state = self.create_test_state()
        rule = SampleRateConsistencyRule()
        errors, warnings = rule.check(state)

        assert len(errors) == 0

    def test_sample_rate_consistency_invalid(self):
        state = self.create_test_state()

        ir_diff = generate_test_ir()
        ir_diff.sample_rate = 44100.0
        state.impulse_responses["spk1"]["pt1"] = ir_diff

        rule = SampleRateConsistencyRule()
        errors, warnings = rule.check(state)

        assert len(errors) > 0

    def test_time_zero_valid(self):
        state = self.create_test_state()
        rule = TimeZeroRule()
        errors, warnings = rule.check(state)

        assert len(errors) == 0

    def test_coordinate_units_reasonable(self):
        state = self.create_test_state()
        rule = CoordinateUnitsRule()
        errors, warnings = rule.check(state)

        assert len(errors) == 0

    def test_duplicate_points(self):
        state = self.create_test_state()

        state.points["pt3"] = MeasurementPoint(
            id="pt3",
            name="Point 3 (duplicate)",
            position=Point3D(x=0, y=10, z=1.5),
        )

        rule = DuplicatePointsRule(position_tolerance_m=0.1)
        errors, warnings = rule.check(state)

        assert len(warnings) > 0

    def test_run_all_validations(self):
        state = self.create_test_state()
        result = run_all_validations(state)

        assert result.valid is True


class TestSolver:
    def create_solver_test_state(self) -> CalibrationState:
        state = CalibrationState(unit_system=UnitSystem.METERS)

        state.speakers["spk_ref"] = Speaker(
            id="spk_ref",
            name="Reference",
            position=Point3D(x=0, y=0, z=2),
        )
        state.speakers["spk_delayed"] = Speaker(
            id="spk_delayed",
            name="Delayed",
            position=Point3D(x=5, y=0, z=2),
        )

        state.points["pt1"] = MeasurementPoint(
            id="pt1",
            name="Point 1",
            position=Point3D(x=0, y=10, z=1.5),
        )
        state.points["pt2"] = MeasurementPoint(
            id="pt2",
            name="Point 2",
            position=Point3D(x=2, y=10, z=1.5),
        )

        state.climate_data = ClimateData(
            temperature_c=22.0,
            humidity_pct=50.0,
        )

        sos = calculate_speed_of_sound_simple(22.0)

        distances = {
            ("spk_ref", "pt1"): calculate_distance(
                state.speakers["spk_ref"].position,
                state.points["pt1"].position,
            ),
            ("spk_ref", "pt2"): calculate_distance(
                state.speakers["spk_ref"].position,
                state.points["pt2"].position,
            ),
            ("spk_delayed", "pt1"): calculate_distance(
                state.speakers["spk_delayed"].position,
                state.points["pt1"].position,
            ),
            ("spk_delayed", "pt2"): calculate_distance(
                state.speakers["spk_delayed"].position,
                state.points["pt2"].position,
            ),
        }

        expected_delay_ms = 5.0

        for spk_id in ["spk_ref", "spk_delayed"]:
            state.impulse_responses[spk_id] = {}
            for pt_id in ["pt1", "pt2"]:
                dist = distances[(spk_id, pt_id)]
                direct_time = dist / sos

                if spk_id == "spk_delayed":
                    direct_time += expected_delay_ms / 1000.0

                ir = generate_test_ir(direct_time_sec=direct_time)
                state.impulse_responses[spk_id][pt_id] = ir

        return state, expected_delay_ms

    def test_calculate_phase_risk(self):
        score_low, level_low = calculate_phase_risk(0.1)
        assert level_low == "low"

        score_med, level_med = calculate_phase_risk(0.6)
        assert level_med == "medium"

        score_high, level_high = calculate_phase_risk(1.5)
        assert level_high == "high"

    def test_solve_delays(self):
        state, expected_delay_ms = self.create_solver_test_state()

        config = SolverConfig(reference_speaker_id="spk_ref")
        result = solve_delays(state, config)

        assert result.reference_speaker_id == "spk_ref"
        assert result.estimated_speed_of_sound > 330
        assert result.estimated_speed_of_sound < 360

        assert "spk_ref" in result.speaker_delays
        assert "spk_delayed" in result.speaker_delays

        ref_delay = result.speaker_delays["spk_ref"]
        assert ref_delay.delay_ms == pytest.approx(0.0, abs=0.1)

        delayed = result.speaker_delays["spk_delayed"]
        assert delayed.delay_ms == pytest.approx(expected_delay_ms, abs=1.0)


class TestPointOverride:
    def test_override_exclude(self):
        state = CalibrationState()

        state.overrides.append(PointOverride(
            point_id="pt_bad",
            speaker_id=None,
            override_type=OverrideType.EXCLUDE,
            reason="反射太强",
        ))

        state.overrides.append(PointOverride(
            point_id="pt_locked",
            speaker_id="spk1",
            override_type=OverrideType.LOCK,
            reason="已知可靠点",
        ))

        assert len(state.overrides) == 2
        assert state.overrides[0].override_type == OverrideType.EXCLUDE
        assert state.overrides[1].override_type == OverrideType.LOCK


class TestDataModels:
    def test_point3d(self):
        p = Point3D(x=1.0, y=2.0, z=3.0)

        assert p.to_tuple() == (1.0, 2.0, 3.0)
        assert p.to_list() == [1.0, 2.0, 3.0]

    def test_speaker_creation(self):
        speaker = Speaker(
            id="L",
            name="左主音箱",
            position=Point3D(x=-5.0, y=0.0, z=2.5),
            group="主扩",
            channel=1,
        )

        assert speaker.id == "L"
        assert speaker.name == "左主音箱"
        assert speaker.group == "主扩"
        assert speaker.channel == 1

    def test_climate_data(self):
        climate = ClimateData(
            temperature_c=22.5,
            humidity_pct=55.0,
            pressure_kpa=101.3,
        )

        assert climate.temperature_c == 22.5
        assert climate.humidity_pct == 55.0

    def test_impulse_response_duration(self):
        ir = ImpulseResponse(
            speaker_id="test",
            point_id="test",
            sample_rate=48000.0,
            time_samples=[0.0, 1/48000, 2/48000, 3/48000],
            amplitude=[0.0, 0.5, 1.0, 0.5],
        )

        assert ir.duration == pytest.approx(3/48000)
