"""数据模型测试"""

import pytest
from pre_cool_validator.models import (
    ProductParams,
    VehicleConfig,
    BatchItem,
    LoadingPlan,
    RiskType,
    RiskSeverity,
)


class TestProductParams:
    """货品参数模型测试"""

    def test_create_valid_product(self):
        """测试创建有效的货品参数"""
        product = ProductParams(
            product_id="TEST_001",
            product_name="测试水果",
            specific_heat=3.5,
            density=500,
            default_target_temp=0.0,
            max_precool_time=120,
        )

        assert product.product_id == "TEST_001"
        assert product.specific_heat == 3.5
        assert product.heat_transfer_coeff == 10.0
        assert product.respiration_rate == 0.0

    def test_product_requires_positive_specific_heat(self):
        """测试比热容必须为正"""
        with pytest.raises(Exception):
            ProductParams(
                product_id="TEST_001",
                product_name="测试水果",
                specific_heat=-1.0,
                density=500,
                default_target_temp=0.0,
                max_precool_time=120,
            )

    def test_default_values(self):
        """测试默认值"""
        product = ProductParams(
            product_id="TEST_001",
            product_name="测试水果",
            specific_heat=3.5,
            density=500,
            default_target_temp=0.0,
            max_precool_time=120,
        )

        assert product.heat_transfer_coeff == 10.0
        assert product.respiration_rate == 0.0
        assert product.notes is None


class TestVehicleConfig:
    """车辆配置模型测试"""

    def test_create_valid_vehicle(self):
        """测试创建有效的车辆配置"""
        vehicle = VehicleConfig(
            vehicle_id="REF_001",
            vehicle_name="测试冷藏车",
            cargo_volume=18.0,
            cargo_surface_area=42.0,
            insulation_k=0.4,
            cooling_capacity=8.0,
            fan_airflow=3000.0,
            door_area=4.0,
        )

        assert vehicle.vehicle_id == "REF_001"
        assert vehicle.cooling_capacity == 8.0
        assert vehicle.ambient_temp_standard == 30.0
        assert vehicle.max_door_open_duration == 30

    def test_surface_area_validation(self):
        """测试表面积验证"""
        with pytest.raises(Exception):
            VehicleConfig(
                vehicle_id="REF_001",
                vehicle_name="测试冷藏车",
                cargo_volume=100.0,
                cargo_surface_area=10.0,
                insulation_k=0.4,
                cooling_capacity=8.0,
                fan_airflow=3000.0,
                door_area=4.0,
            )


class TestBatchItem:
    """批次项模型测试"""

    def test_create_valid_batch(self):
        """测试创建有效的批次项"""
        batch = BatchItem(
            batch_id="B001",
            product_id="APPLE_001",
            product_name="红富士苹果",
            volume=2.5,
            mass=1250,
            initial_temp=15.0,
            target_temp=0.0,
        )

        assert batch.batch_id == "B001"
        assert batch.arrival_time == 0
        assert batch.deadline_time is None
        assert batch.specific_heat_override is None

    def test_batch_with_arrival_time(self):
        """测试带到达时间的批次"""
        batch = BatchItem(
            batch_id="B001",
            product_id="APPLE_001",
            product_name="红富士苹果",
            volume=2.5,
            mass=1250,
            initial_temp=15.0,
            target_temp=0.0,
            arrival_time=30,
            deadline_time=90,
        )

        assert batch.arrival_time == 30
        assert batch.deadline_time == 90


class TestLoadingPlan:
    """装车计划模型测试"""

    def test_create_valid_plan(self):
        """测试创建有效的装车计划"""
        batches = [
            BatchItem(
                batch_id="B001",
                product_id="APPLE_001",
                product_name="红富士苹果",
                volume=2.5,
                mass=1250,
                initial_temp=15.0,
                target_temp=0.0,
            ),
            BatchItem(
                batch_id="B002",
                product_id="ORANGE_001",
                product_name="脐橙",
                volume=2.0,
                mass=1100,
                initial_temp=12.0,
                target_temp=5.0,
            ),
        ]

        plan = LoadingPlan(
            plan_id="TEST_PLAN_001",
            plan_name="测试计划",
            vehicle_id="REF_001",
            ambient_temp=28.0,
            total_precool_time=90,
            door_open_duration=15,
            batches=batches,
        )

        assert plan.plan_id == "TEST_PLAN_001"
        assert plan.get_total_volume() == 4.5
        assert plan.get_total_mass() == 2350
        assert plan.get_unique_target_temps() == [0.0, 5.0]

    def test_empty_plan(self):
        """测试空装车计划"""
        plan = LoadingPlan(
            plan_id="EMPTY_PLAN",
            vehicle_id="REF_001",
            ambient_temp=28.0,
            total_precool_time=90,
            door_open_duration=15,
        )

        assert plan.get_total_volume() == 0.0
        assert plan.get_total_mass() == 0.0
        assert plan.get_unique_target_temps() == []


class TestRiskType:
    """风险类型测试"""

    def test_all_risk_types_exist(self):
        """测试所有风险类型都已定义"""
        expected_types = [
            "precool_insufficient",
            "cooling_capacity_insufficient",
            "door_open_too_long",
            "target_temp_conflict",
            "batch_timeout",
            "ambient_temp_high",
        ]

        for risk_type in RiskType:
            assert risk_type.value in expected_types


class TestRiskSeverity:
    """风险严重程度测试"""

    def test_severity_order(self):
        """测试严重程度顺序"""
        assert RiskSeverity.HIGH.value == "high"
        assert RiskSeverity.MEDIUM.value == "medium"
        assert RiskSeverity.LOW.value == "low"
