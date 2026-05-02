"""测试数据模型模块"""

from datetime import datetime

import pytest

from section_flow_reviewer.models import (
    CalibrationRecord,
    FlowMethod,
    FlowResult,
    HistoricalComparison,
    ManualNote,
    MeasuringPoint,
    SectionData,
    SegmentResult,
    SourceUncertainty,
    UncertaintyResult,
    UnitType,
    ValidationIssue,
)


class TestMeasuringPoint:
    """测试测点数据模型"""

    def test_create_measuring_point(self):
        """测试创建测点"""
        point = MeasuringPoint(
            id=1,
            distance_from_left=0.0,
            water_depth=0.5,
            velocity=0.0,
            is_edge=True,
            notes="左岸起点",
        )
        
        assert point.id == 1
        assert point.distance_from_left == 0.0
        assert point.water_depth == 0.5
        assert point.velocity == 0.0
        assert point.is_edge is True
        assert point.velocity_depth_ratio == 0.6  # 默认值

    def test_measuring_point_with_custom_ratio(self):
        """测试自定义流速测量相对水深"""
        point = MeasuringPoint(
            id=2,
            distance_from_left=10.0,
            water_depth=1.2,
            velocity=0.85,
            velocity_depth_ratio=0.5,
        )
        
        assert point.velocity_depth_ratio == 0.5


class TestSectionData:
    """测试断面数据模型"""

    def test_create_section(self):
        """测试创建断面"""
        points = [
            MeasuringPoint(id=1, distance_from_left=0.0, water_depth=0.5, velocity=0.0, is_edge=True),
            MeasuringPoint(id=2, distance_from_left=10.0, water_depth=1.2, velocity=0.85),
            MeasuringPoint(id=3, distance_from_left=20.0, water_depth=0.6, velocity=0.0, is_edge=True),
        ]
        
        section = SectionData(
            section_id="S001",
            section_name="测试断面",
            measurement_date=datetime(2023, 7, 15, 10, 30),
            measuring_points=points,
            operator="测试员",
            unit=UnitType.METRIC,
        )
        
        assert section.section_id == "S001"
        assert section.section_name == "测试断面"
        assert len(section.measuring_points) == 3
        assert section.river_width == 20.0  # 自动计算
        assert section.max_depth == 1.2  # 自动计算
        assert section.unit == UnitType.METRIC

    def test_section_sorts_points(self):
        """测试断面自动排序测点"""
        # 按逆序创建测点
        points = [
            MeasuringPoint(id=3, distance_from_left=20.0, water_depth=0.6, velocity=0.0),
            MeasuringPoint(id=1, distance_from_left=0.0, water_depth=0.5, velocity=0.0),
            MeasuringPoint(id=2, distance_from_left=10.0, water_depth=1.2, velocity=0.85),
        ]
        
        section = SectionData(
            section_id="S001",
            measurement_date=datetime.now(),
            measuring_points=points,
        )
        
        # 验证测点已按距离排序
        assert section.measuring_points[0].distance_from_left == 0.0
        assert section.measuring_points[1].distance_from_left == 10.0
        assert section.measuring_points[2].distance_from_left == 20.0


class TestCalibrationRecord:
    """测试校准记录模型"""

    def test_create_calibration(self):
        """测试创建校准记录"""
        calibration = CalibrationRecord(
            instrument_id="ADCP-001",
            instrument_type="ADCP",
            calibration_date=datetime(2023, 1, 15),
            next_calibration_date=datetime(2024, 1, 15),
            calibration_factor=1.002,
            offset=0.001,
            uncertainty=0.005,
        )
        
        assert calibration.instrument_id == "ADCP-001"
        assert calibration.calibration_factor == 1.002
        assert calibration.offset == 0.001
        assert calibration.uncertainty == 0.005

    def test_apply_calibration(self):
        """测试应用校准系数"""
        calibration = CalibrationRecord(
            instrument_id="ADCP-001",
            instrument_type="ADCP",
            calibration_date=datetime.now(),
            calibration_factor=1.002,
            offset=0.001,
        )
        
        # 测试应用校准
        original_value = 1.5
        calibrated_value = calibration.apply_calibration(original_value)
        
        assert calibrated_value == 1.5 * 1.002 + 0.001

    def test_is_expired(self):
        """测试检查校准是否过期"""
        # 未过期
        calibration_valid = CalibrationRecord(
            instrument_id="ADCP-001",
            instrument_type="ADCP",
            calibration_date=datetime(2023, 1, 15),
            next_calibration_date=datetime(2025, 1, 15),
        )
        
        assert calibration_valid.is_expired(datetime(2024, 7, 15)) is False
        
        # 已过期
        calibration_expired = CalibrationRecord(
            instrument_id="ADCP-001",
            instrument_type="ADCP",
            calibration_date=datetime(2023, 1, 15),
            next_calibration_date=datetime(2024, 1, 15),
        )
        
        assert calibration_expired.is_expired(datetime(2024, 7, 15)) is True


class TestManualNote:
    """测试人工备注模型"""

    def test_create_note(self):
        """测试创建备注"""
        note = ManualNote(
            id="N001",
            section_id="S001",
            note_date=datetime(2023, 7, 15, 14, 30),
            author="测试员",
            category="异常",
            content="测点流速异常，可能受水草影响",
            related_point_id=5,
            severity="warning",
        )
        
        assert note.id == "N001"
        assert note.section_id == "S001"
        assert note.related_point_id == 5
        assert note.severity == "warning"


class TestValidationIssue:
    """测试验证问题模型"""

    def test_create_issue(self):
        """测试创建验证问题"""
        issue = ValidationIssue(
            issue_id="V001",
            section_id="S001",
            issue_type="anomaly",
            severity="warning",
            message="测点流速异常",
            related_point_id=5,
            related_field="velocity",
            expected_value=1.2,
            actual_value=3.5,
            suggestion="建议检查测量",
        )
        
        assert issue.issue_id == "V001"
        assert issue.severity == "warning"
        assert issue.related_point_id == 5


class TestFlowResult:
    """测试流量计算结果模型"""

    def test_create_flow_result(self):
        """测试创建流量结果"""
        result = FlowResult(
            section_id="S001",
            method=FlowMethod.MIDPOINT,
            total_discharge=1250.5,
            total_area=875.0,
            average_velocity=1.43,
            max_velocity=2.1,
            river_width=500.0,
            max_depth=3.5,
        )
        
        assert result.section_id == "S001"
        assert result.method == FlowMethod.MIDPOINT
        assert result.total_discharge == 1250.5


class TestSegmentResult:
    """测试分段结果模型"""

    def test_create_segment(self):
        """测试创建分段"""
        segment = SegmentResult(
            segment_id=1,
            start_distance=0.0,
            end_distance=10.0,
            width=10.0,
            average_depth=0.85,
            average_velocity=0.425,
            area=8.5,
            discharge=3.6125,
            left_point_id=1,
            right_point_id=2,
        )
        
        assert segment.segment_id == 1
        assert segment.width == 10.0
        assert segment.area == 8.5


class TestUncertaintyResult:
    """测试不确定度结果模型"""

    def test_create_uncertainty(self):
        """测试创建不确定度"""
        sources = [
            SourceUncertainty(
                source="水深测量",
                standard_uncertainty=25.01,
                sensitivity_coefficient=1.0,
                contribution=625.5,
                relative_contribution=30.0,
            ),
        ]
        
        uncertainty = UncertaintyResult(
            combined_uncertainty=25.01,
            relative_uncertainty=2.0,
            expanded_uncertainty=50.02,
            coverage_factor=2.0,
            source_uncertainties=sources,
        )
        
        assert uncertainty.combined_uncertainty == 25.01
        assert uncertainty.relative_uncertainty == 2.0
        assert len(uncertainty.source_uncertainties) == 1


class TestHistoricalComparison:
    """测试历史对比模型"""

    def test_create_comparison(self):
        """测试创建历史对比"""
        comparison = HistoricalComparison(
            current_section_id="S001-2023",
            historical_section_id="S001-2022",
            discharge_difference=125.5,
            discharge_difference_percent=10.0,
            area_difference=50.0,
            area_difference_percent=5.0,
            velocity_difference=0.1,
            velocity_difference_percent=3.0,
            depth_profile_difference=0.05,
        )
        
        assert comparison.current_section_id == "S001-2023"
        assert comparison.discharge_difference == 125.5
        assert comparison.discharge_difference_percent == 10.0
