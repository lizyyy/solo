import pytest
from datetime import datetime
from water_quality_simulator.models import (
    PondConfig,
    WaterQualityParams,
    SimulationParams,
    ThresholdParams,
    Scenario,
    WaterChangePlan,
    AerationPlan,
)
from water_quality_simulator.simulation import WaterQualityModel, WaterQualitySimulator


class TestWaterQualityModel:
    def test_calculate_temperature_factor(self):
        model = WaterQualityModel()
        
        factor_20 = model._calculate_temperature_factor(20.0)
        assert factor_20 == 1.0
        
        factor_25 = model._calculate_temperature_factor(25.0)
        assert factor_25 > 1.0
        
        factor_15 = model._calculate_temperature_factor(15.0)
        assert factor_15 < 1.0

    def test_calculate_ph_factor(self):
        model = WaterQualityModel()
        
        factor_optimal = model._calculate_ph_factor(8.0)
        assert factor_optimal > 0.5
        
        factor_low = model._calculate_ph_factor(6.0)
        assert factor_low < 0.5

    def test_calculate_do_factor(self):
        model = WaterQualityModel()
        
        factor_high = model._calculate_do_factor(6.0)
        assert factor_high > 0.8
        
        factor_low = model._calculate_do_factor(1.0)
        assert factor_low < 0.5

    def test_calculate_nitrification_rate(self):
        model = WaterQualityModel()
        
        rate = model.calculate_nitrification_rate(
            temperature=28.0,
            ph=8.0,
            dissolved_oxygen=5.0,
            ammonia_nitrogen=0.5,
        )
        
        assert rate > 0
        assert rate < 1.0

    def test_calculate_ammonia_production(self):
        model = WaterQualityModel()
        
        production = model.calculate_ammonia_production(
            feed_rate=0.5,
            feed_protein_content=40.0,
        )
        
        assert production > 0

    def test_calculate_water_exchange_effect(self):
        model = WaterQualityModel()
        
        new_concentration = model.calculate_water_exchange_effect(
            original_concentration=1.0,
            source_concentration=0.1,
            exchange_ratio=0.3,
        )
        
        expected = 1.0 * (1 - 0.3) + 0.1 * 0.3
        assert abs(new_concentration - expected) < 0.0001

    def test_calculate_saturation_oxygen(self):
        model = WaterQualityModel()
        
        do_20 = model.calculate_saturation_oxygen(temperature=20.0, salinity=0.0)
        do_25 = model.calculate_saturation_oxygen(temperature=25.0, salinity=0.0)
        do_20_salt = model.calculate_saturation_oxygen(temperature=20.0, salinity=30.0)
        
        assert do_20 > do_25
        assert do_20 > do_20_salt

    def test_calculate_aeration_effect(self):
        model = WaterQualityModel()
        
        new_do = model.calculate_aeration_effect(
            current_do=3.0,
            temperature=28.0,
            salinity=25.0,
            aeration_rate=0.5,
            time_hours=1.0,
        )
        
        assert new_do > 3.0

    def test_calculate_probiotics_effect(self):
        model = WaterQualityModel()
        
        effect = model.calculate_probiotics_effect(
            current_ammonia=0.8,
            current_nitrite=0.3,
            dosage=10.0,
            time_hours=12,
        )
        
        assert "ammonia_reduction" in effect
        assert "nitrite_reduction" in effect
        assert effect["ammonia_reduction"] > 0
        assert effect["nitrite_reduction"] > 0


class TestWaterQualitySimulator:
    def test_create_simulator(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
        simulator = WaterQualitySimulator(config)
        assert simulator is not None

    def test_simulate_baseline(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
        simulator = WaterQualitySimulator(config)
        
        initial_params = WaterQualityParams(
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        
        sim_params = SimulationParams(
            simulation_hours=24,
            time_step=1.0,
            feed_rate=0.5,
        )
        
        start_time = datetime(2026, 5, 3, 8, 0, 0)
        result = simulator.simulate_baseline(initial_params, sim_params, start_time)
        
        assert result is not None
        assert len(result.time_series) == 24
        
        final_state = result.get_final_state()
        assert "ammonia_nitrogen" in final_state
        assert "nitrite" in final_state
        assert "ph" in final_state

    def test_simulate_with_scenario(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
        simulator = WaterQualitySimulator(config)
        
        initial_params = WaterQualityParams(
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        
        sim_params = SimulationParams(
            simulation_hours=24,
            time_step=1.0,
            feed_rate=0.5,
            source_water_ph=8.0,
            source_water_salinity=25.0,
            source_water_ammonia=0.02,
            source_water_nitrite=0.01,
        )
        
        water_change = WaterChangePlan(
            exchange_ratio=0.3,
            source_water_ph=8.0,
            source_water_salinity=25.0,
            timing="立即",
        )
        
        aeration = AerationPlan(
            intensity="中等",
            duration_hours=12,
            start_hour=0,
        )
        
        scenario = Scenario(
            scenario_id="scenario_001",
            scenario_name="测试方案",
            water_change_plan=water_change,
            aeration_plan=aeration,
        )
        
        start_time = datetime(2026, 5, 3, 8, 0, 0)
        result = simulator.simulate_with_scenario(initial_params, sim_params, scenario, start_time)
        
        assert result is not None
        assert len(result.time_series) == 24

    def test_get_statistics(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
        simulator = WaterQualitySimulator(config)
        
        initial_params = WaterQualityParams(
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        
        sim_params = SimulationParams(
            simulation_hours=24,
            time_step=1.0,
            feed_rate=0.5,
        )
        
        start_time = datetime(2026, 5, 3, 8, 0, 0)
        result = simulator.simulate_baseline(initial_params, sim_params, start_time)
        
        stats = result.get_statistics()
        
        assert "ammonia_nitrogen" in stats
        assert "nitrite" in stats
        assert "ph" in stats
        assert "dissolved_oxygen" in stats
        
        for param_stats in stats.values():
            assert "min" in param_stats
            assert "max" in param_stats
            assert "mean" in param_stats
            assert "final" in param_stats
            assert "change" in param_stats
