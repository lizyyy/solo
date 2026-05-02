"""热负荷计算器测试"""

import pytest
from pre_cool_validator.heat_calculator import HeatCalculator, HeatLoadComponents
from pre_cool_validator.models import (
    ProductParams,
    VehicleConfig,
    BatchItem,
    LoadingPlan,
)


class TestHeatCalculator:
    """热负荷计算器测试"""

    @pytest.fixture
    def calculator(self):
        """创建计算器实例"""
        return HeatCalculator(time_step_minutes=1.0)

    def test_calculate_door_infiltration_positive(self, calculator):
        """测试开门热侵入计算（环境温度高于车厢）"""
        heat_kj, power_kw = calculator.calculate_door_infiltration(
            door_area=4.0,
            ambient_temp=30.0,
            cabin_temp=0.0,
            duration_minutes=10.0,
            wind_speed=0.0,
        )

        assert heat_kj > 0
        assert power_kw > 0

    def test_calculate_door_infiltration_no_temp_diff(self, calculator):
        """测试无温差时开门热侵入为0"""
        heat_kj, power_kw = calculator.calculate_door_infiltration(
            door_area=4.0,
            ambient_temp=0.0,
            cabin_temp=0.0,
            duration_minutes=10.0,
        )

        assert heat_kj == 0.0
        assert power_kw == 0.0

    def test_calculate_door_infiltration_negative_temp_diff(self, calculator):
        """测试环境温度低于车厢时开门热侵入为0"""
        heat_kj, power_kw = calculator.calculate_door_infiltration(
            door_area=4.0,
            ambient_temp=-5.0,
            cabin_temp=0.0,
            duration_minutes=10.0,
        )

        assert heat_kj == 0.0
        assert power_kw == 0.0

    def test_calculate_ambient_conduction(self, calculator):
        """测试箱体热传导计算"""
        heat_kj, power_kw = calculator.calculate_ambient_conduction(
            surface_area=42.0,
            insulation_k=0.4,
            ambient_temp=30.0,
            cabin_temp=0.0,
            duration_minutes=60.0,
        )

        assert heat_kj > 0
        assert power_kw > 0

    def test_calculate_ambient_conduction_no_diff(self, calculator):
        """测试无温差时热传导为0"""
        heat_kj, power_kw = calculator.calculate_ambient_conduction(
            surface_area=42.0,
            insulation_k=0.4,
            ambient_temp=0.0,
            cabin_temp=0.0,
            duration_minutes=60.0,
        )

        assert heat_kj == 0.0
        assert power_kw == 0.0

    def test_calculate_respiration_heat(self, calculator):
        """测试呼吸热计算"""
        heat_kj, power_kw = calculator.calculate_respiration_heat(
            mass=1000.0,
            respiration_rate=0.005,
            temp_c=20.0,
            duration_minutes=60.0,
        )

        assert heat_kj > 0
        assert power_kw > 0

    def test_calculate_respiration_heat_no_rate(self, calculator):
        """测试无呼吸热时结果为0"""
        heat_kj, power_kw = calculator.calculate_respiration_heat(
            mass=1000.0,
            respiration_rate=0.0,
            temp_c=20.0,
            duration_minutes=60.0,
        )

        assert heat_kj == 0.0
        assert power_kw == 0.0

    def test_calculate_product_cooling_load(self, calculator):
        """测试货品冷却需冷量计算"""
        heat_kj = calculator.calculate_product_cooling_load(
            mass=1000.0,
            specific_heat=3.5,
            initial_temp=15.0,
            target_temp=0.0,
        )

        assert heat_kj == 1000 * 3.5 * 15

    def test_calculate_product_cooling_load_no_need(self, calculator):
        """测试已达标时需冷量为0"""
        heat_kj = calculator.calculate_product_cooling_load(
            mass=1000.0,
            specific_heat=3.5,
            initial_temp=0.0,
            target_temp=0.0,
        )

        assert heat_kj == 0.0

    def test_calculate_temp_change(self, calculator):
        """测试温度变化计算"""
        temp_change = calculator.calculate_temp_change(
            mass=1000.0,
            specific_heat=3.5,
            net_heat_kj=-52500.0,
        )

        assert temp_change == -15.0

    def test_calculate_temp_change_zero_mass(self, calculator):
        """测试质量为0时温度变化为0"""
        temp_change = calculator.calculate_temp_change(
            mass=0.0,
            specific_heat=3.5,
            net_heat_kj=-52500.0,
        )

        assert temp_change == 0.0


class TestSimulation:
    """仿真测试"""

    @pytest.fixture
    def calculator(self):
        return HeatCalculator(time_step_minutes=5.0)

    @pytest.fixture
    def test_vehicle(self):
        return VehicleConfig(
            vehicle_id="TEST_VEHICLE",
            vehicle_name="测试冷藏车",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
            ambient_temp_standard=30.0,
            max_door_open_duration=30,
        )

    @pytest.fixture
    def test_products(self):
        return {
            "APPLE": ProductParams(
                product_id="APPLE",
                product_name="苹果",
                specific_heat=3.5,
                density=500,
                default_target_temp=0.0,
                max_precool_time=120,
                respiration_rate=0.005,
            ),
        }

    @pytest.fixture
    def test_plan(self):
        batches = [
            BatchItem(
                batch_id="B001",
                product_id="APPLE",
                product_name="苹果",
                volume=2.0,
                mass=1000,
                initial_temp=10.0,
                target_temp=0.0,
                arrival_time=0,
            ),
        ]

        return LoadingPlan(
            plan_id="TEST_PLAN",
            plan_name="测试计划",
            vehicle_id="TEST_VEHICLE",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            batches=batches,
        )

    def test_simulation_runs_successfully(self, calculator, test_vehicle, test_products, test_plan):
        """测试仿真成功执行"""
        result = calculator.simulate(
            plan=test_plan,
            vehicle=test_vehicle,
            products=test_products,
        )

        assert result.success is True
        assert result.plan_id == "TEST_PLAN"
        assert len(result.batch_results) == 1

    def test_simulation_temperature_decreases(self, calculator, test_vehicle, test_products, test_plan):
        """测试仿真过程中温度下降"""
        result = calculator.simulate(
            plan=test_plan,
            vehicle=test_vehicle,
            products=test_products,
        )

        batch_result = result.batch_results[0]
        assert batch_result.final_temp <= batch_result.initial_temp

    def test_simulation_cooling_surplus(self, calculator, test_vehicle, test_products, test_plan):
        """测试冷量计算"""
        result = calculator.simulate(
            plan=test_plan,
            vehicle=test_vehicle,
            products=test_products,
        )

        assert result.total_cooling_provided > 0
        assert result.total_cooling_required > 0

    def test_simulation_with_missing_product(self, calculator, test_vehicle, test_plan):
        """测试缺少货品参数时仿真失败"""
        empty_products = {}

        result = calculator.simulate(
            plan=test_plan,
            vehicle=test_vehicle,
            products=empty_products,
        )

        assert result.success is False
