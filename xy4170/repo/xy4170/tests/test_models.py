"""测试数据模型"""

import pytest
from datetime import datetime
from kiln_curve_validator.models import (
    KilnParameters,
    FiringRecipe,
    CurveSegment,
    SegmentType,
    PlannedCurve,
    TemperaturePoint,
    MeasuredCurve,
    BodyProperties,
    GlazeProperties,
    FiringType,
)


class TestKilnParameters:
    """测试窑炉参数模型"""

    def test_valid_kiln_parameters(self):
        """测试有效的窑炉参数"""
        kiln = KilnParameters(
            name="测试窑炉",
            max_temperature=1300.0,
            chamber_volume=60.0,
            power_rating=6.0,
            thermal_inertia_factor=2.5,
            max_heating_rate=8.0,
            max_cooling_rate=5.0,
            sensor_accuracy=2.0,
        )
        assert kiln.name == "测试窑炉"
        assert kiln.max_temperature == 1300.0
        assert kiln.chamber_volume == 60.0

    def test_invalid_temperature(self):
        """测试无效温度值"""
        with pytest.raises(ValueError):
            KilnParameters(
                name="测试窑炉",
                max_temperature=-100.0,
                chamber_volume=60.0,
                power_rating=6.0,
                thermal_inertia_factor=2.5,
                max_heating_rate=8.0,
                max_cooling_rate=5.0,
                sensor_accuracy=2.0,
            )

    def test_inertia_factor_bounds(self):
        """测试热惯性系数边界"""
        with pytest.raises(ValueError):
            KilnParameters(
                name="测试窑炉",
                max_temperature=1300.0,
                chamber_volume=60.0,
                power_rating=6.0,
                thermal_inertia_factor=10.0,
                max_heating_rate=8.0,
                max_cooling_rate=5.0,
                sensor_accuracy=2.0,
            )


class TestCurveSegment:
    """测试曲线段模型"""

    def test_ramp_segment_auto_rate(self):
        """测试升温段自动计算速率"""
        segment = CurveSegment(
            segment_type=SegmentType.RAMP,
            start_temp=25.0,
            end_temp=200.0,
            duration=70.0,
        )
        expected_rate = (200.0 - 25.0) / 70.0
        assert segment.rate == pytest.approx(expected_rate, rel=1e-3)

    def test_hold_segment_rate(self):
        """测试保温段速率为0"""
        segment = CurveSegment(
            segment_type=SegmentType.HOLD,
            start_temp=1240.0,
            end_temp=1240.0,
            duration=30.0,
        )
        assert segment.rate == 0.0

    def test_cool_segment_negative_rate(self):
        """测试降温段负速率"""
        segment = CurveSegment(
            segment_type=SegmentType.COOL,
            start_temp=1240.0,
            end_temp=500.0,
            duration=180.0,
        )
        expected_rate = (500.0 - 1240.0) / 180.0
        assert segment.rate == pytest.approx(expected_rate, rel=1e-3)


class TestPlannedCurve:
    """测试计划曲线模型"""

    def test_total_duration(self):
        """测试总时长计算"""
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
                duration=30.0,
            ),
        ]

        curve = PlannedCurve(
            recipe_name="测试配方",
            kiln_name="测试窑炉",
            segments=segments,
        )

        assert curve.get_total_duration() == 200.0

    def test_peak_temperature(self):
        """测试峰值温度计算"""
        segments = [
            CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=25.0,
                end_temp=500.0,
                duration=100.0,
            ),
            CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=500.0,
                end_temp=1240.0,
                duration=200.0,
            ),
            CurveSegment(
                segment_type=SegmentType.COOL,
                start_temp=1240.0,
                end_temp=500.0,
                duration=150.0,
            ),
        ]

        curve = PlannedCurve(
            recipe_name="测试配方",
            kiln_name="测试窑炉",
            segments=segments,
        )

        assert curve.get_peak_temperature() == 1240.0


class TestMeasuredCurve:
    """测试实测曲线模型"""

    def test_duration_calculation(self):
        """测试时长计算"""
        start_time = datetime(2026, 5, 2, 9, 0, 0)
        end_time = datetime(2026, 5, 2, 12, 30, 0)

        points = [
            TemperaturePoint(timestamp=start_time, temperature=25.0),
            TemperaturePoint(timestamp=end_time, temperature=500.0),
        ]

        curve = MeasuredCurve(
            kiln_name="测试窑炉",
            start_time=start_time,
            end_time=end_time,
            data_points=points,
        )

        assert curve.get_duration_minutes() == 210.0

    def test_temperatures_array(self):
        """测试温度数组获取"""
        start_time = datetime(2026, 5, 2, 9, 0, 0)

        points = [
            TemperaturePoint(timestamp=start_time, temperature=25.0, is_valid=True),
            TemperaturePoint(timestamp=start_time, temperature=100.0, is_valid=True),
            TemperaturePoint(timestamp=start_time, temperature=-999.0, is_valid=False),
            TemperaturePoint(timestamp=start_time, temperature=200.0, is_valid=True),
        ]

        curve = MeasuredCurve(
            kiln_name="测试窑炉",
            start_time=start_time,
            data_points=points,
        )

        temps = curve.get_temperatures_array()
        assert len(temps) == 3
        assert -999.0 not in temps


class TestFiringRecipe:
    """测试烧成配方模型"""

    def test_default_heating_rate_calculation(self):
        """测试默认升温速率计算"""
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
            target_temperature=1000.0,
            total_thickness=2.5,
            body=body,
        )

        assert recipe.max_allowed_heating_rate is not None
        assert recipe.max_allowed_heating_rate < 5.0

    def test_glaze_recipe(self):
        """测试带釉料的配方"""
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
            name="釉烧配方",
            firing_type=FiringType.GLAZE,
            target_temperature=1240.0,
            total_thickness=1.5,
            body=body,
            glaze=glaze,
        )

        assert recipe.glaze is not None
        assert recipe.glaze.name == "测试釉料"
        assert recipe.glaze.hold_time_recommended == 30.0
