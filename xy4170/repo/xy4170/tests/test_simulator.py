"""测试数值模拟模块"""

import pytest
from kiln_curve_validator.simulator import (
    ThermalInertiaSimulator,
    FullCurveSimulator,
    ThermalWorkCalculator,
    ThermalState,
)
from kiln_curve_validator.models import (
    KilnParameters,
    FiringRecipe,
    FiringType,
    BodyProperties,
    GlazeProperties,
    CurveSegment,
    SegmentType,
    PlannedCurve,
)


class TestThermalInertiaSimulator:
    """测试热惯性模拟器"""

    @pytest.fixture
    def setup_simulator(self):
        """设置测试用的模拟器"""
        kiln = KilnParameters(
            name="测试窑炉",
            max_temperature=1320.0,
            chamber_volume=60.0,
            power_rating=6.0,
            thermal_inertia_factor=2.5,
            max_heating_rate=8.0,
            max_cooling_rate=5.0,
            sensor_accuracy=2.0,
        )

        body = BodyProperties(
            name="测试泥料",
            thickness_range=[0.5, 3.0],
            thermal_conductivity=1.0,
            porosity=0.3,
            recommended_bisque_temp=1000.0,
            critical_cooling_rate=3.0,
        )

        recipe = FiringRecipe(
            name="测试配方",
            firing_type=FiringType.BISQUE,
            target_temperature=980.0,
            total_thickness=1.5,
            body=body,
        )

        simulator = ThermalInertiaSimulator(kiln, recipe)
        return simulator

    def test_ramp_segment_simulation(self, setup_simulator):
        """测试升温段模拟"""
        simulator = setup_simulator

        segment = CurveSegment(
            segment_type=SegmentType.RAMP,
            start_temp=25.0,
            end_temp=200.0,
            duration=70.0,
        )

        states = simulator.simulate_segment(segment, initial_temp=25.0, time_step=5.0)

        assert len(states) > 0
        assert states[0].surface_temp == pytest.approx(25.0, rel=1e-1)
        assert states[-1].surface_temp <= 200.0

    def test_hold_segment_simulation(self, setup_simulator):
        """测试保温段模拟"""
        simulator = setup_simulator

        segment = CurveSegment(
            segment_type=SegmentType.HOLD,
            start_temp=1000.0,
            end_temp=1000.0,
            duration=30.0,
        )

        states = simulator.simulate_segment(segment, initial_temp=1000.0, time_step=5.0)

        assert len(states) > 0
        for state in states:
            assert state.surface_temp == pytest.approx(1000.0, rel=5e-2)

    def test_cool_segment_simulation(self, setup_simulator):
        """测试降温段模拟"""
        simulator = setup_simulator

        segment = CurveSegment(
            segment_type=SegmentType.COOL,
            start_temp=1000.0,
            end_temp=500.0,
            duration=100.0,
        )

        states = simulator.simulate_segment(segment, initial_temp=1000.0, time_step=5.0)

        assert len(states) > 0
        assert states[-1].surface_temp >= 500.0
        assert states[-1].surface_temp <= 1000.0

    def test_core_temperature_calculation(self, setup_simulator):
        """测试中心温度计算"""
        simulator = setup_simulator

        core_temp = simulator._calculate_core_temperature(
            surface_temp=200.0,
            previous_core=25.0,
            time_step=10.0
        )

        assert core_temp > 25.0
        assert core_temp < 200.0

    def test_inertia_effect(self, setup_simulator):
        """测试热惯性效应"""
        simulator = setup_simulator

        effect = simulator._calculate_inertia_effect(
            current_temp=100.0,
            target_temp_step=150.0,
            rate=5.0
        )

        assert effect >= 0.0

    def test_thicker_body_higher_inertia(self):
        """测试更厚的坯体有更大的热惯性"""
        kiln = KilnParameters(
            name="测试窑炉",
            max_temperature=1320.0,
            chamber_volume=60.0,
            power_rating=6.0,
            thermal_inertia_factor=2.5,
            max_heating_rate=8.0,
            max_cooling_rate=5.0,
            sensor_accuracy=2.0,
        )

        body = BodyProperties(
            name="测试泥料",
            thickness_range=[0.5, 3.0],
            thermal_conductivity=1.0,
            porosity=0.3,
            recommended_bisque_temp=1000.0,
            critical_cooling_rate=3.0,
        )

        thin_recipe = FiringRecipe(
            name="薄坯配方",
            firing_type=FiringType.BISQUE,
            target_temperature=980.0,
            total_thickness=0.5,
            body=body,
        )

        thick_recipe = FiringRecipe(
            name="厚坯配方",
            firing_type=FiringType.BISQUE,
            target_temperature=980.0,
            total_thickness=3.0,
            body=body,
        )

        thin_sim = ThermalInertiaSimulator(kiln, thin_recipe)
        thick_sim = ThermalInertiaSimulator(kiln, thick_recipe)

        segment = CurveSegment(
            segment_type=SegmentType.RAMP,
            start_temp=25.0,
            end_temp=500.0,
            duration=100.0,
        )

        thin_states = thin_sim.simulate_segment(segment, initial_temp=25.0, time_step=10.0)
        thick_states = thick_sim.simulate_segment(segment, initial_temp=25.0, time_step=10.0)

        assert len(thin_states) == len(thick_states)

        for i in range(len(thin_states)):
            thick_inertia = thick_states[i].thermal_inertia_effect
            thin_inertia = thin_states[i].thermal_inertia_effect
            assert thick_inertia >= thin_inertia


class TestFullCurveSimulator:
    """测试完整曲线模拟器"""

    @pytest.fixture
    def setup_full_simulator(self):
        """设置完整模拟器"""
        kiln = KilnParameters(
            name="测试窑炉",
            max_temperature=1320.0,
            chamber_volume=60.0,
            power_rating=6.0,
            thermal_inertia_factor=2.5,
            max_heating_rate=8.0,
            max_cooling_rate=5.0,
            sensor_accuracy=2.0,
        )

        body = BodyProperties(
            name="测试泥料",
            thickness_range=[0.5, 3.0],
            thermal_conductivity=1.0,
            porosity=0.3,
            recommended_bisque_temp=1000.0,
            critical_cooling_rate=3.0,
        )

        recipe = FiringRecipe(
            name="测试配方",
            firing_type=FiringType.GLAZE,
            target_temperature=1240.0,
            total_thickness=1.5,
            body=body,
        )

        segments = [
            CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=25.0,
                end_temp=200.0,
                duration=70.0,
            ),
            CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=200.0,
                end_temp=600.0,
                duration=100.0,
            ),
            CurveSegment(
                segment_type=SegmentType.HOLD,
                start_temp=600.0,
                end_temp=600.0,
                duration=10.0,
            ),
        ]

        planned_curve = PlannedCurve(
            recipe_name="测试配方",
            kiln_name="测试窑炉",
            segments=segments,
        )

        simulator = FullCurveSimulator(kiln, recipe)

        return simulator, planned_curve

    def test_simulate_planned_curve(self, setup_full_simulator):
        """测试模拟计划曲线"""
        simulator, planned_curve = setup_full_simulator

        result = simulator.simulate_planned_curve(planned_curve)

        assert len(result.simulated_temperatures) > 0
        assert len(result.time_points) == len(result.simulated_temperatures)
        assert result.simulated_temperatures[-1] >= 600.0

    def test_simulation_outputs(self, setup_full_simulator):
        """测试模拟输出"""
        simulator, planned_curve = setup_full_simulator

        result = simulator.simulate_planned_curve(planned_curve)

        assert len(result.thermal_inertia_effects) == len(result.simulated_temperatures)
        assert len(result.lag_times) == len(result.simulated_temperatures)
        assert len(result.core_surface_diff) == len(result.simulated_temperatures)


class TestThermalWorkCalculator:
    """测试热功计算器"""

    @pytest.fixture
    def setup_calculator(self):
        """设置测试环境"""
        kiln = KilnParameters(
            name="测试窑炉",
            max_temperature=1320.0,
            chamber_volume=60.0,
            power_rating=6.0,
            thermal_inertia_factor=2.5,
            max_heating_rate=8.0,
            max_cooling_rate=5.0,
            sensor_accuracy=2.0,
        )

        return kiln

    def test_ramp_segment_thermal_work(self, setup_calculator):
        """测试升温段热功计算"""
        kiln = setup_calculator

        segment = CurveSegment(
            segment_type=SegmentType.RAMP,
            start_temp=25.0,
            end_temp=500.0,
            duration=100.0,
        )

        work = ThermalWorkCalculator.calculate_segment_thermal_work(segment, kiln)

        assert 'theoretical_energy_kj' in work
        assert 'actual_energy_kj' in work
        assert 'efficiency' in work
        assert work['actual_energy_kj'] > 0.0

    def test_hold_segment_thermal_work(self, setup_calculator):
        """测试保温段热功计算"""
        kiln = setup_calculator

        segment = CurveSegment(
            segment_type=SegmentType.HOLD,
            start_temp=1000.0,
            end_temp=1000.0,
            duration=30.0,
        )

        work = ThermalWorkCalculator.calculate_segment_thermal_work(segment, kiln)

        assert 'hold_energy_kj' in work
        assert 'heat_loss_kj' in work
        assert work['hold_energy_kj'] > 0.0

    def test_cool_segment_thermal_work(self, setup_calculator):
        """测试降温段热功计算"""
        kiln = setup_calculator

        segment = CurveSegment(
            segment_type=SegmentType.COOL,
            start_temp=1000.0,
            end_temp=500.0,
            duration=100.0,
        )

        work = ThermalWorkCalculator.calculate_segment_thermal_work(segment, kiln)

        assert 'released_energy_kj' in work
        assert work['released_energy_kj'] > 0.0

    def test_total_thermal_work(self, setup_calculator):
        """测试总热功计算"""
        kiln = setup_calculator

        segments = [
            CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=25.0,
                end_temp=500.0,
                duration=100.0,
            ),
            CurveSegment(
                segment_type=SegmentType.HOLD,
                start_temp=500.0,
                end_temp=500.0,
                duration=20.0,
            ),
            CurveSegment(
                segment_type=SegmentType.COOL,
                start_temp=500.0,
                end_temp=100.0,
                duration=80.0,
            ),
        ]

        planned_curve = PlannedCurve(
            recipe_name="测试",
            kiln_name="测试",
            segments=segments,
        )

        total_work = ThermalWorkCalculator.calculate_total_thermal_work(planned_curve, kiln)

        assert 'total_heating_energy_kj' in total_work
        assert 'total_hold_energy_kj' in total_work
        assert 'total_input_energy_kj' in total_work
        assert 'total_released_energy_kj' in total_work
        assert 'estimated_efficiency' in total_work
        assert 'segment_results' in total_work
        assert 'total_duration_minutes' in total_work
