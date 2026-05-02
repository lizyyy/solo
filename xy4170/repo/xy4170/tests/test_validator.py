"""测试规则校验模块"""

import pytest
from datetime import datetime, timedelta

from kiln_curve_validator.validator import (
    HeatingRateValidator,
    ThermalWorkValidator,
    CoolingValidator,
    SensorValidator,
    FullValidator,
    CurveComparator,
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
    MeasuredCurve,
    TemperaturePoint,
    SimulationResult,
)


class TestHeatingRateValidator:
    """测试升温速率校验器"""

    @pytest.fixture
    def setup_validator(self):
        """设置测试用的校验器"""
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
            max_allowed_heating_rate=4.0,
        )

        validator = HeatingRateValidator(kiln, recipe)
        return validator, kiln, recipe

    def test_normal_heating_rate(self, setup_validator):
        """测试正常升温速率"""
        validator, kiln, recipe = setup_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(20):
            time = start_time + timedelta(minutes=i * 5)
            temp = 25.0 + i * 15.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        issues = validator.validate(curve)

        critical_issues = [i for i in issues if i.severity == "critical"]
        assert len(critical_issues) == 0

    def test_excessive_heating_rate(self, setup_validator):
        """测试过快的升温速率"""
        validator, kiln, recipe = setup_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(20):
            time = start_time + timedelta(minutes=i * 5)
            temp = 25.0 + i * 50.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        issues = validator.validate(curve)

        heating_issues = [i for i in issues if i.category == "heating_rate"]
        assert len(heating_issues) > 0

    def test_safe_rate_for_thickness(self, setup_validator):
        """测试基于厚度的安全速率计算"""
        validator, kiln, recipe = setup_validator

        thin_rate = validator._calculate_safe_rate_for_thickness(0.8)
        thick_rate = validator._calculate_safe_rate_for_thickness(2.5)

        assert thick_rate < thin_rate


class TestThermalWorkValidator:
    """测试热功校验器"""

    @pytest.fixture
    def setup_validator(self):
        """设置测试用的校验器"""
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

        glaze = GlazeProperties(
            name="测试釉料",
            maturing_temp_range=[1220.0, 1260.0],
            hold_time_recommended=30.0,
            expansion_coefficient=5.0,
            is_matte=False,
        )

        recipe = FiringRecipe(
            name="测试配方",
            firing_type=FiringType.GLAZE,
            target_temperature=1240.0,
            total_thickness=1.5,
            body=body,
            glaze=glaze,
        )

        validator = ThermalWorkValidator(kiln, recipe)
        return validator, kiln, recipe

    def test_insufficient_peak_temperature(self, setup_validator):
        """测试峰值温度不足"""
        validator, kiln, recipe = setup_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(30):
            time = start_time + timedelta(minutes=i * 10)
            if i < 20:
                temp = 25.0 + i * 60.0
            else:
                temp = 1200.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        issues = validator.validate(curve)

        thermal_issues = [i for i in issues if i.category == "thermal_work"]
        assert len(thermal_issues) > 0


class TestCoolingValidator:
    """测试冷却风险校验器"""

    @pytest.fixture
    def setup_validator(self):
        """设置测试用的校验器"""
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
            critical_cooling_rate=2.0,
        )

        recipe = FiringRecipe(
            name="测试配方",
            firing_type=FiringType.GLAZE,
            target_temperature=1240.0,
            total_thickness=2.0,
            body=body,
        )

        validator = CoolingValidator(kiln, recipe)
        return validator, kiln, recipe

    def test_excessive_cooling_rate(self, setup_validator):
        """测试过快的冷却速率（临界区间）"""
        validator, kiln, recipe = setup_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(20):
            time = start_time + timedelta(minutes=i * 5)
            if i < 5:
                temp = 1240.0
            else:
                temp = 1240.0 - (i - 5) * 30.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        issues = validator.validate(curve)

        cooling_issues = [i for i in issues if i.category == "cooling"]
        assert len(cooling_issues) > 0


class TestSensorValidator:
    """测试传感器校验器"""

    @pytest.fixture
    def setup_validator(self):
        """设置测试用的校验器"""
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

        validator = SensorValidator(kiln)
        return validator, kiln

    def test_invalid_data_points(self, setup_validator):
        """测试无效数据点"""
        validator, kiln = setup_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(20):
            time = start_time + timedelta(minutes=i * 5)
            if i % 3 == 0:
                temp = -999.0
                is_valid = False
            else:
                temp = 25.0 + i * 10.0
                is_valid = True
            points.append(TemperaturePoint(timestamp=time, temperature=temp, is_valid=is_valid))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        issues = validator.validate(curve)

        sensor_issues = [i for i in issues if i.category == "sensor"]
        assert len(sensor_issues) > 0

    def test_temperature_jump(self, setup_validator):
        """测试温度突变"""
        validator, kiln = setup_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(20):
            time = start_time + timedelta(minutes=i * 5)
            if i == 10:
                temp = 25.0 + 9 * 10.0 + 100.0
            else:
                temp = 25.0 + i * 10.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        issues = validator.validate(curve)

        jump_issues = [i for i in issues if "突变" in i.message or "jump" in i.message.lower()]
        assert len(issues) > 0


class TestFullValidator:
    """测试完整校验器"""

    @pytest.fixture
    def setup_full_validator(self):
        """设置完整校验器"""
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

        validator = FullValidator(kiln, recipe)
        return validator, kiln, recipe

    def test_pass_validation(self, setup_full_validator):
        """测试通过校验的曲线"""
        validator, kiln, recipe = setup_full_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(50):
            time = start_time + timedelta(minutes=i * 5)
            if i < 40:
                temp = 25.0 + i * 24.0
            else:
                temp = 980.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        result = validator.run_full_validation(curve)

        assert result.overall_status in ["pass", "warning"]

    def test_fail_validation(self, setup_full_validator):
        """测试未通过校验的曲线"""
        validator, kiln, recipe = setup_full_validator

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(30):
            time = start_time + timedelta(minutes=i * 5)
            temp = 25.0 + i * 50.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        curve = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        result = validator.run_full_validation(curve)

        assert len(result.issues) > 0


class TestCurveComparator:
    """测试曲线对比器"""

    def test_compare_planned_measured(self):
        """测试计划与实测曲线对比"""
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
                duration=30.0,
            ),
        ]

        planned = PlannedCurve(
            recipe_name="测试",
            kiln_name="测试",
            segments=segments,
        )

        start_time = datetime(2026, 5, 2, 9, 0, 0)
        points = []

        for i in range(30):
            time = start_time + timedelta(minutes=i * 5)
            if i < 20:
                temp = 25.0 + i * 25.0
            else:
                temp = 500.0
            points.append(TemperaturePoint(timestamp=time, temperature=temp))

        measured = MeasuredCurve(
            kiln_name="测试",
            start_time=start_time,
            data_points=points,
        )

        result = CurveComparator.compare(planned, measured)

        assert result.planned_duration == 130.0
        assert result.planned_peak == 500.0
        assert result.measured_peak == 500.0
