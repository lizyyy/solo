import pytest
import tempfile
from pathlib import Path

from rain_garden_checker.validators.rules import RuleValidator
from rain_garden_checker.engine.infiltration import HydrologicEngine
from rain_garden_checker.models.data_models import (
    RainfallSeries,
    RainfallDataPoint,
    SoilInfiltrationTest,
    CatchmentArea,
    PondGeometry,
    SimulationConfig,
    SimulationResult,
    SimulationTimeStep,
    WarningLevel,
    WarningType,
    CheckReport,
    InfiltrationModel,
    TimeUnit,
    LengthUnit,
    AreaUnit,
)


class TestRuleValidator:
    def setup_method(self):
        self.validator = RuleValidator()

    def test_check_capacity_insufficient_with_overflow(self):
        time_series = [
            SimulationTimeStep(
                time=0.0,
                rainfall_intensity=0,
                runoff_inflow=0,
                infiltration_rate=0,
                pond_level=0,
                storage_volume=0,
                overflow_rate=0,
                underdrain_rate=0,
                cumulative_infiltration=0,
                cumulative_overflow=0,
            )
        ]

        result = SimulationResult(
            rainfall_name="test_rain",
            return_period=5.0,
            config=SimulationConfig(),
            time_series=time_series,
            total_runoff_volume=100.0,
            total_infiltration_volume=50.0,
            total_overflow_volume=50.0,
            peak_pond_level=1.0,
            peak_storage=100.0,
            drain_time_hours=24.0,
            has_overflow=True,
        )

        pond = PondGeometry(
            name="test_pond",
            surface_area=100.0,
            depth=0.5,
        )

        has_issue = self.validator.check_capacity_insufficient(result, pond)

        assert has_issue is True
        capacity_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.CAPACITY_INSUFFICIENT
        ]
        assert len(capacity_warnings) > 0

    def test_check_capacity_insufficient_without_overflow(self):
        time_series = [
            SimulationTimeStep(
                time=0.0,
                rainfall_intensity=0,
                runoff_inflow=0,
                infiltration_rate=0,
                pond_level=0,
                storage_volume=0,
                overflow_rate=0,
                underdrain_rate=0,
                cumulative_infiltration=0,
                cumulative_overflow=0,
            )
        ]

        result = SimulationResult(
            rainfall_name="test_rain",
            return_period=5.0,
            config=SimulationConfig(),
            time_series=time_series,
            total_runoff_volume=100.0,
            total_infiltration_volume=100.0,
            total_overflow_volume=0.0,
            peak_pond_level=0.3,
            peak_storage=30.0,
            drain_time_hours=12.0,
            has_overflow=False,
        )

        pond = PondGeometry(
            name="test_pond",
            surface_area=100.0,
            depth=0.5,
        )

        has_issue = self.validator.check_capacity_insufficient(result, pond)

        assert has_issue is False
        capacity_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.CAPACITY_INSUFFICIENT
        ]
        assert len(capacity_warnings) == 0

    def test_check_drain_timeout_exceeded(self):
        config = SimulationConfig(max_drain_hours=72.0)

        time_series = []

        result = SimulationResult(
            rainfall_name="test_rain",
            return_period=5.0,
            config=config,
            time_series=time_series,
            total_runoff_volume=100.0,
            total_infiltration_volume=100.0,
            total_overflow_volume=0.0,
            peak_pond_level=0.3,
            peak_storage=30.0,
            drain_time_hours=80.0,
            has_overflow=False,
        )

        has_issue = self.validator.check_drain_timeout(result, config)

        assert has_issue is True
        drain_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.DRAIN_TIMEOUT
        ]
        assert len(drain_warnings) > 0
        assert any(w.level == WarningLevel.WARNING for w in drain_warnings)

    def test_check_drain_timeout_critical(self):
        config = SimulationConfig(max_drain_hours=72.0)

        time_series = []

        result = SimulationResult(
            rainfall_name="test_rain",
            return_period=5.0,
            config=config,
            time_series=time_series,
            total_runoff_volume=100.0,
            total_infiltration_volume=100.0,
            total_overflow_volume=0.0,
            peak_pond_level=0.3,
            peak_storage=30.0,
            drain_time_hours=120.0,
            has_overflow=False,
        )

        has_issue = self.validator.check_drain_timeout(result, config)

        assert has_issue is True
        drain_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.DRAIN_TIMEOUT
        ]
        assert any(w.level == WarningLevel.CRITICAL for w in drain_warnings)

    def test_check_drain_timeout_ok(self):
        config = SimulationConfig(max_drain_hours=72.0)

        time_series = []

        result = SimulationResult(
            rainfall_name="test_rain",
            return_period=5.0,
            config=config,
            time_series=time_series,
            total_runoff_volume=100.0,
            total_infiltration_volume=100.0,
            total_overflow_volume=0.0,
            peak_pond_level=0.3,
            peak_storage=30.0,
            drain_time_hours=24.0,
            has_overflow=False,
        )

        has_issue = self.validator.check_drain_timeout(result, config)

        assert has_issue is False

    def test_check_soil_params_valid(self):
        soil = SoilInfiltrationTest(
            test_id="valid_soil",
            soil_type="sandy_loam",
            initial_moisture=0.2,
            saturated_moisture=0.45,
            saturated_hydraulic_conductivity=15.0,
        )

        has_issue = self.validator.check_soil_params_unreliable(soil)

        assert has_issue is False

    def test_check_soil_params_invalid_moisture(self):
        soil = SoilInfiltrationTest(
            test_id="invalid_soil",
            soil_type="sand",
            initial_moisture=0.5,
            saturated_moisture=0.45,
            saturated_hydraulic_conductivity=50.0,
        )

        has_issue = self.validator.check_soil_params_unreliable(soil)

        assert has_issue is True
        soil_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.SOIL_PARAMS_UNRELIABLE
        ]
        assert len(soil_warnings) > 0
        assert any(w.level == WarningLevel.CRITICAL for w in soil_warnings)

    def test_check_soil_params_extreme_ks(self):
        soil = SoilInfiltrationTest(
            test_id="extreme_ks",
            soil_type="clay",
            initial_moisture=0.2,
            saturated_moisture=0.5,
            saturated_hydraulic_conductivity=100.0,
        )

        has_issue = self.validator.check_soil_params_unreliable(soil)

        assert has_issue is True

    def test_check_runoff_coefficient_valid(self):
        catchments = [
            CatchmentArea(
                name="rooftop",
                area=500.0,
                runoff_coefficient=0.85,
                impervious_ratio=0.95,
            ),
            CatchmentArea(
                name="lawn",
                area=1200.0,
                runoff_coefficient=0.3,
                impervious_ratio=0.1,
            ),
        ]

        has_issue = self.validator.check_runoff_coefficient_conflict(catchments)

        assert has_issue is False

    def test_check_runoff_coefficient_conflict(self):
        catchments = [
            CatchmentArea(
                name="parking",
                area=800.0,
                runoff_coefficient=0.3,
                impervious_ratio=0.9,
            ),
        ]

        has_issue = self.validator.check_runoff_coefficient_conflict(catchments)

        assert has_issue is True
        runoff_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.RUNOFF_COEFFICIENT_CONFLICT
        ]
        assert len(runoff_warnings) > 0

    def test_check_runoff_coefficient_invalid_range(self):
        catchments = [
            CatchmentArea(
                name="invalid",
                area=500.0,
                runoff_coefficient=1.5,
            ),
        ]

        has_issue = self.validator.check_runoff_coefficient_conflict(catchments)

        assert has_issue is True
        runoff_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.RUNOFF_COEFFICIENT_CONFLICT
        ]
        assert any(w.level == WarningLevel.CRITICAL for w in runoff_warnings)

    def test_check_return_period_consistent(self):
        data_points = [
            RainfallDataPoint(time=0, intensity=0),
            RainfallDataPoint(time=5, intensity=10),
        ]

        rainfall_series = [
            RainfallSeries(
                name="rain_5y",
                return_period=5.0,
                data=data_points,
            ),
            RainfallSeries(
                name="rain_5y_2",
                return_period=5.0,
                data=data_points,
            ),
        ]

        has_issue = self.validator.check_return_period_consistency(
            rainfall_series,
            required_return_period=5.0,
        )

        assert has_issue is False

    def test_check_return_period_inconsistent(self):
        data_points = [
            RainfallDataPoint(time=0, intensity=0),
            RainfallDataPoint(time=5, intensity=10),
        ]

        rainfall_series = [
            RainfallSeries(
                name="rain_5y",
                return_period=5.0,
                data=data_points,
            ),
            RainfallSeries(
                name="rain_10y",
                return_period=10.0,
                data=data_points,
            ),
        ]

        has_issue = self.validator.check_return_period_consistency(
            rainfall_series,
            required_return_period=5.0,
        )

        assert has_issue is True

    def test_check_overflow_risk(self):
        time_series_a = []
        time_series_b = []

        results = [
            SimulationResult(
                rainfall_name="rain_a",
                return_period=5.0,
                config=SimulationConfig(),
                time_series=time_series_a,
                total_runoff_volume=100.0,
                total_infiltration_volume=100.0,
                total_overflow_volume=0.0,
                peak_pond_level=0.3,
                peak_storage=30.0,
                drain_time_hours=24.0,
                has_overflow=False,
            ),
            SimulationResult(
                rainfall_name="rain_b",
                return_period=10.0,
                config=SimulationConfig(),
                time_series=time_series_b,
                total_runoff_volume=200.0,
                total_infiltration_volume=150.0,
                total_overflow_volume=50.0,
                peak_pond_level=0.8,
                peak_storage=80.0,
                drain_time_hours=48.0,
                has_overflow=True,
            ),
        ]

        risk_map = self.validator.check_overflow_risk_from_results(results)

        assert risk_map[0] is False
        assert risk_map[1] is True
        overflow_warnings = [
            w for w in self.validator.warnings
            if w.warning_type == WarningType.OVERFLOW_RISK
        ]
        assert len(overflow_warnings) > 0

    def test_validate_all(self):
        engine = HydrologicEngine()

        rainfall_data = [
            RainfallDataPoint(time=0, intensity=0),
            RainfallDataPoint(time=5, intensity=5),
            RainfallDataPoint(time=10, intensity=10),
            RainfallDataPoint(time=15, intensity=5),
            RainfallDataPoint(time=20, intensity=0),
        ]

        rainfall = RainfallSeries(
            name="test_rain",
            return_period=5.0,
            data=rainfall_data,
        )

        soil = SoilInfiltrationTest(
            test_id="soil_01",
            soil_type="sandy_loam",
            initial_moisture=0.2,
            saturated_moisture=0.45,
            saturated_hydraulic_conductivity=15.0,
        )

        catchments = [
            CatchmentArea(
                name="area_1",
                area=1000.0,
                runoff_coefficient=0.8,
                impervious_ratio=0.9,
            ),
        ]

        pond = PondGeometry(
            name="pond_1",
            surface_area=50.0,
            depth=0.5,
            underdrain_rate=30.0,
        )

        config = SimulationConfig(
            max_drain_hours=72.0,
        )

        result = engine.simulate(rainfall, soil, catchments, pond, config)

        report = self.validator.validate_all(
            results=[result] if result else [],
            pond=pond,
            soil=soil,
            catchments=catchments,
            config=config,
        )

        assert isinstance(report, CheckReport)
        summary = self.validator.get_summary()
        assert "total_warnings" in summary
        assert "by_level" in summary

    def test_get_summary(self):
        time_series = []

        result = SimulationResult(
            rainfall_name="test",
            return_period=5.0,
            config=SimulationConfig(max_drain_hours=72.0),
            time_series=time_series,
            total_runoff_volume=100.0,
            total_infiltration_volume=50.0,
            total_overflow_volume=50.0,
            peak_pond_level=0.5,
            peak_storage=50.0,
            drain_time_hours=80.0,
            has_overflow=True,
        )

        pond = PondGeometry(
            name="test",
            surface_area=100.0,
            depth=0.5,
        )

        config = SimulationConfig(max_drain_hours=72.0)

        self.validator.check_capacity_insufficient(result, pond)
        self.validator.check_drain_timeout(result, config)

        summary = self.validator.get_summary()

        assert summary["total_warnings"] > 0
        assert summary["by_level"]["warning"] > 0 or summary["by_level"]["critical"] > 0
        assert "by_type" in summary
