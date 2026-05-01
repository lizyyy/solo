"""风险引擎测试"""

import pytest
from pre_cool_validator.risk_engine import (
    RiskEngine,
    PrecoolInsufficientRule,
    CoolingCapacityInsufficientRule,
    DoorOpenTooLongRule,
    TargetTempConflictRule,
    BatchTimeoutRule,
)
from pre_cool_validator.models import (
    ProductParams,
    VehicleConfig,
    BatchItem,
    LoadingPlan,
    SimulationResult,
    BatchSimulationResult,
    TimeStepData,
    RiskType,
    RiskSeverity,
)


class TestPrecoolInsufficientRule:
    """预冷不足规则测试"""

    @pytest.fixture
    def rule(self):
        return PrecoolInsufficientRule()

    @pytest.fixture
    def vehicle(self):
        return VehicleConfig(
            vehicle_id="TEST",
            vehicle_name="测试",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
        )

    @pytest.fixture
    def products(self):
        return {}

    @pytest.fixture
    def plan(self):
        return LoadingPlan(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            batches=[],
        )

    def test_detects_precool_insufficient(self, rule, vehicle, products, plan):
        """测试检测预冷不足"""
        batch_result = BatchSimulationResult(
            batch_id="B001",
            product_name="测试产品",
            initial_temp=15.0,
            target_temp=0.0,
            final_temp=5.0,
            reached_target=False,
            time_to_target=None,
            time_steps=[],
            total_heat_removed=0.0,
            peak_heat_load=0.0,
            avg_heat_load=0.0,
        )

        simulation = SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            vehicle_cooling_capacity=8.0,
            batch_results=[batch_result],
            total_cooling_required=0.0,
            total_cooling_provided=0.0,
            cooling_surplus=0.0,
            success=True,
        )

        risk = rule.evaluate(simulation, plan, vehicle, products)

        assert risk is not None
        assert risk.risk_type == RiskType.PRECOOL_INSUFFICIENT
        assert "B001" in risk.affected_batches

    def test_no_risk_when_precool_sufficient(self, rule, vehicle, products, plan):
        """测试预冷足够时无风险"""
        batch_result = BatchSimulationResult(
            batch_id="B001",
            product_name="测试产品",
            initial_temp=15.0,
            target_temp=0.0,
            final_temp=0.0,
            reached_target=True,
            time_to_target=45.0,
            time_steps=[],
            total_heat_removed=0.0,
            peak_heat_load=0.0,
            avg_heat_load=0.0,
        )

        simulation = SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            vehicle_cooling_capacity=8.0,
            batch_results=[batch_result],
            total_cooling_required=0.0,
            total_cooling_provided=0.0,
            cooling_surplus=0.0,
            success=True,
        )

        risk = rule.evaluate(simulation, plan, vehicle, products)

        assert risk is None


class TestCoolingCapacityInsufficientRule:
    """制冷量不足规则测试"""

    @pytest.fixture
    def rule(self):
        return CoolingCapacityInsufficientRule()

    @pytest.fixture
    def vehicle(self):
        return VehicleConfig(
            vehicle_id="TEST",
            vehicle_name="测试",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
        )

    @pytest.fixture
    def products(self):
        return {}

    @pytest.fixture
    def plan(self):
        return LoadingPlan(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            batches=[],
        )

    def test_detects_insufficient_capacity(self, rule, vehicle, products, plan):
        """测试检测制冷量不足"""
        simulation = SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            vehicle_cooling_capacity=8.0,
            batch_results=[],
            total_cooling_required=50000.0,
            total_cooling_provided=40000.0,
            cooling_surplus=-10000.0,
            door_heat_infiltration=5000.0,
            ambient_heat_infiltration=3000.0,
            respiration_heat_total=2000.0,
            success=True,
        )

        risk = rule.evaluate(simulation, plan, vehicle, products)

        assert risk is not None
        assert risk.risk_type == RiskType.COOLING_CAPACITY_INSUFFICIENT

    def test_no_risk_when_capacity_sufficient(self, rule, vehicle, products, plan):
        """测试制冷量足够时无风险"""
        simulation = SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            vehicle_cooling_capacity=8.0,
            batch_results=[],
            total_cooling_required=40000.0,
            total_cooling_provided=50000.0,
            cooling_surplus=10000.0,
            success=True,
        )

        risk = rule.evaluate(simulation, plan, vehicle, products)

        assert risk is None


class TestDoorOpenTooLongRule:
    """开门过久规则测试"""

    @pytest.fixture
    def rule(self):
        return DoorOpenTooLongRule()

    @pytest.fixture
    def products(self):
        return {}

    @pytest.fixture
    def plan(self):
        return LoadingPlan(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            batches=[],
        )

    def test_detects_door_open_too_long(self, rule, products, plan):
        """测试检测开门过久"""
        vehicle = VehicleConfig(
            vehicle_id="TEST",
            vehicle_name="测试",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
            max_door_open_duration=20,
        )

        plan_with_long_door = LoadingPlan(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=40,
            batches=[],
        )

        simulation = SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=40,
            vehicle_cooling_capacity=8.0,
            batch_results=[],
            total_cooling_required=0.0,
            total_cooling_provided=0.0,
            cooling_surplus=0.0,
            success=True,
        )

        risk = rule.evaluate(simulation, plan_with_long_door, vehicle, products)

        assert risk is not None
        assert risk.risk_type == RiskType.DOOR_OPEN_TOO_LONG

    def test_no_risk_when_door_time_ok(self, rule, products, plan):
        """测试开门时间正常时无风险"""
        vehicle = VehicleConfig(
            vehicle_id="TEST",
            vehicle_name="测试",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
            max_door_open_duration=30,
        )

        simulation = SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=15,
            vehicle_cooling_capacity=8.0,
            batch_results=[],
            total_cooling_required=0.0,
            total_cooling_provided=0.0,
            cooling_surplus=0.0,
            success=True,
        )

        risk = rule.evaluate(simulation, plan, vehicle, products)

        assert risk is None


class TestTargetTempConflictRule:
    """目标温度冲突规则测试"""

    @pytest.fixture
    def rule(self):
        return TargetTempConflictRule()

    @pytest.fixture
    def vehicle(self):
        return VehicleConfig(
            vehicle_id="TEST",
            vehicle_name="测试",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
        )

    @pytest.fixture
    def products(self):
        return {}

    @pytest.fixture
    def simulation(self):
        return SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            vehicle_cooling_capacity=8.0,
            batch_results=[],
            total_cooling_required=0.0,
            total_cooling_provided=0.0,
            cooling_surplus=0.0,
            success=True,
        )

    def test_detects_temp_conflict(self, rule, vehicle, products, simulation):
        """测试检测目标温度冲突"""
        plan = LoadingPlan(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            batches=[
                BatchItem(
                    batch_id="B001",
                    product_id="APPLE",
                    product_name="苹果",
                    volume=1.0,
                    mass=500,
                    initial_temp=10.0,
                    target_temp=0.0,
                ),
                BatchItem(
                    batch_id="B002",
                    product_id="FROZEN",
                    product_name="冻肉",
                    volume=1.0,
                    mass=900,
                    initial_temp=-5.0,
                    target_temp=-18.0,
                ),
            ],
        )

        risk = rule.evaluate(simulation, plan, vehicle, products)

        assert risk is not None
        assert risk.risk_type == RiskType.TARGET_TEMP_CONFLICT

    def test_no_risk_when_temps_close(self, rule, vehicle, products, simulation):
        """测试目标温度接近时无风险"""
        plan = LoadingPlan(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            batches=[
                BatchItem(
                    batch_id="B001",
                    product_id="APPLE",
                    product_name="苹果",
                    volume=1.0,
                    mass=500,
                    initial_temp=10.0,
                    target_temp=0.0,
                ),
                BatchItem(
                    batch_id="B002",
                    product_id="GRAPE",
                    product_name="葡萄",
                    volume=1.0,
                    mass=500,
                    initial_temp=10.0,
                    target_temp=2.0,
                ),
            ],
        )

        risk = rule.evaluate(simulation, plan, vehicle, products)

        assert risk is None


class TestRiskEngine:
    """风险引擎综合测试"""

    @pytest.fixture
    def engine(self):
        return RiskEngine()

    @pytest.fixture
    def vehicle(self):
        return VehicleConfig(
            vehicle_id="TEST",
            vehicle_name="测试",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
        )

    @pytest.fixture
    def products(self):
        return {}

    def test_risk_engine_evaluates_all_rules(self, engine, vehicle, products):
        """测试风险引擎评估所有规则"""
        plan = LoadingPlan(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            batches=[],
        )

        simulation = SimulationResult(
            plan_id="TEST",
            vehicle_id="TEST",
            ambient_temp=25.0,
            total_precool_time=60,
            door_open_duration=10,
            vehicle_cooling_capacity=8.0,
            batch_results=[],
            total_cooling_required=0.0,
            total_cooling_provided=0.0,
            cooling_surplus=0.0,
            success=True,
        )

        report = engine.evaluate(simulation, plan, vehicle, products)

        assert report.plan_id == "TEST"
        assert isinstance(report.overall_pass, bool)
