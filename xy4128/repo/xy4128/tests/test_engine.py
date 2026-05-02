import pytest
import math

from rain_garden_checker.engine.infiltration import InfiltrationModels, HydrologicEngine
from rain_garden_checker.models.data_models import (
    RainfallSeries,
    RainfallDataPoint,
    SoilInfiltrationTest,
    CatchmentArea,
    PondGeometry,
    SimulationConfig,
    InfiltrationModel,
    TimeUnit,
    LengthUnit,
    AreaUnit,
)


class TestInfiltrationModels:
    def test_horton_model(self):
        f0 = 50.0
        fc = 10.0
        k = 0.5

        f_at_0 = InfiltrationModels.horton(f0, fc, k, 0.0)
        assert abs(f_at_0 - f0) < 0.01

        f_at_large = InfiltrationModels.horton(f0, fc, k, 100.0)
        assert abs(f_at_large - fc) < 0.01

        cumulative = InfiltrationModels.horton_cumulative(f0, fc, k, 1.0)
        assert cumulative > 0

    def test_green_ampt_model(self):
        Ks = 15.0
        theta_s = 0.45
        theta_i = 0.2
        psi_f = 10.0

        rate, volume = InfiltrationModels.green_ampt(
            Ks, theta_s, theta_i, psi_f,
            cumulative_infiltration=0.0,
            rainfall_rate=20.0,
            dt=0.1
        )
        assert rate > 0
        assert volume > 0

        rate2, volume2 = InfiltrationModels.green_ampt(
            Ks, theta_s, theta_i, psi_f,
            cumulative_infiltration=50.0,
            rainfall_rate=20.0,
            dt=0.1
        )
        assert rate2 <= rate

    def test_philip_model(self):
        S = 5.0
        A = 7.5

        f_at_1h = InfiltrationModels.philip(S, A, 1.0)
        assert f_at_1h > 0

        f_at_5h = InfiltrationModels.philip(S, A, 5.0)
        assert f_at_5h < f_at_1h

        cumulative = InfiltrationModels.philip_cumulative(S, A, 1.0)
        assert cumulative > 0

    def test_scs_model(self):
        CN = 85
        rainfall = 50.0

        runoff = InfiltrationModels.scs_cn(CN, rainfall)
        assert runoff >= 0
        assert runoff <= rainfall

        runoff_small = InfiltrationModels.scs_cn(CN, 5.0)
        assert runoff_small == 0


class TestHydrologicEngine:
    def setup_method(self):
        self.engine = HydrologicEngine()

        self.rainfall_data = [
            RainfallDataPoint(time=0, intensity=0),
            RainfallDataPoint(time=5, intensity=2),
            RainfallDataPoint(time=10, intensity=5),
            RainfallDataPoint(time=15, intensity=12),
            RainfallDataPoint(time=20, intensity=18),
            RainfallDataPoint(time=25, intensity=25),
            RainfallDataPoint(time=30, intensity=28),
            RainfallDataPoint(time=35, intensity=25),
            RainfallDataPoint(time=40, intensity=20),
            RainfallDataPoint(time=45, intensity=15),
            RainfallDataPoint(time=50, intensity=10),
            RainfallDataPoint(time=55, intensity=6),
            RainfallDataPoint(time=60, intensity=3),
            RainfallDataPoint(time=65, intensity=1),
            RainfallDataPoint(time=70, intensity=0),
        ]

        self.rainfall = RainfallSeries(
            name="design_5y",
            return_period=5.0,
            time_unit=TimeUnit.MINUTE,
            intensity_unit=LengthUnit.MILLIMETER,
            data=self.rainfall_data,
        )

        self.soil = SoilInfiltrationTest(
            test_id="soil_01",
            soil_type="sandy_loam",
            initial_moisture=0.2,
            saturated_moisture=0.45,
            saturated_hydraulic_conductivity=15.0,
            suction_head=10.0,
        )

        self.catchments = [
            CatchmentArea(
                name="rooftop",
                area=500.0,
                area_unit=AreaUnit.SQUARE_METER,
                runoff_coefficient=0.85,
                land_use_type="building",
                impervious_ratio=0.95,
            ),
            CatchmentArea(
                name="parking",
                area=800.0,
                area_unit=AreaUnit.SQUARE_METER,
                runoff_coefficient=0.8,
                land_use_type="pavement",
                impervious_ratio=0.9,
            ),
            CatchmentArea(
                name="lawn",
                area=1200.0,
                area_unit=AreaUnit.SQUARE_METER,
                runoff_coefficient=0.3,
                land_use_type="grass",
                impervious_ratio=0.1,
            ),
        ]

        self.pond = PondGeometry(
            name="rain_garden_1",
            surface_area=100.0,
            area_unit=AreaUnit.SQUARE_METER,
            depth=0.8,
            depth_unit=LengthUnit.METER,
            underdrain_rate=30.0,
            underdrain_unit=LengthUnit.MILLIMETER,
            underdrain_time_unit=TimeUnit.HOUR,
        )

        self.config = SimulationConfig(
            infiltration_model=InfiltrationModel.HORTON,
            time_step=5.0,
            time_unit=TimeUnit.MINUTE,
            max_drain_hours=72.0,
            enable_underdrain=True,
        )

    def test_simulation_with_horton(self):
        self.config.infiltration_model = InfiltrationModel.HORTON

        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        assert result is not None
        assert result.rainfall_name == "design_5y"
        assert result.return_period == 5.0
        assert len(result.time_series) > 0
        assert result.total_runoff_volume > 0
        assert result.total_infiltration_volume > 0

    def test_simulation_with_green_ampt(self):
        self.config.infiltration_model = InfiltrationModel.GREEN_AMPT

        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        assert result is not None
        assert len(result.time_series) > 0

    def test_simulation_with_philip(self):
        self.config.infiltration_model = InfiltrationModel.PHILIP

        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        assert result is not None

    def test_water_balance(self):
        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        total_in = result.total_runoff_volume
        total_out = result.total_infiltration_volume + result.total_overflow_volume

        assert total_in > 0
        assert abs(total_in - total_out) < total_in * 0.05

    def test_drain_time_calculation(self):
        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        assert result.drain_time_hours >= 0

    def test_overflow_detection(self):
        small_pond = PondGeometry(
            name="small_pond",
            surface_area=10.0,
            depth=0.1,
            underdrain_rate=1.0,
        )

        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=small_pond,
            config=self.config,
        )

        assert result.has_overflow is True
        assert result.total_overflow_volume > 0

    def test_compare_simulations(self):
        result1 = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        low_ks_soil = SoilInfiltrationTest(
            test_id="low_ks",
            soil_type="clay",
            initial_moisture=0.3,
            saturated_moisture=0.5,
            saturated_hydraulic_conductivity=0.1,
        )

        result2 = self.engine.simulate(
            rainfall=self.rainfall,
            soil=low_ks_soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        comparison = self.engine.compare_simulations(result1, result2)

        assert comparison["rainfall_a_name"] == result1.rainfall_name
        assert comparison["rainfall_b_name"] == result2.rainfall_name
        assert "volume_difference" in comparison
        assert "peak_difference" in comparison

    def test_no_underdrain(self):
        self.config.enable_underdrain = False

        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=self.catchments,
            pond=self.pond,
            config=self.config,
        )

        assert result is not None

    def test_empty_catchments(self):
        result = self.engine.simulate(
            rainfall=self.rainfall,
            soil=self.soil,
            catchments=[],
            pond=self.pond,
            config=self.config,
        )

        assert result is None
