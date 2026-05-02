"""测试计算算法模块"""

from datetime import datetime

import pytest

from section_flow_reviewer.calculator import FlowCalculator, MethodComparison
from section_flow_reviewer.models import (
    CalibrationRecord,
    FlowMethod,
    MeasuringPoint,
    SectionData,
    UnitType,
)


class TestFlowCalculator:
    """测试流量计算器"""

    @pytest.fixture
    def simple_section(self):
        """创建一个简单的测试断面"""
        points = [
            MeasuringPoint(id=1, distance_from_left=0.0, water_depth=1.0, velocity=0.0, is_edge=True),
            MeasuringPoint(id=2, distance_from_left=10.0, water_depth=2.0, velocity=1.0),
            MeasuringPoint(id=3, distance_from_left=20.0, water_depth=1.0, velocity=0.0, is_edge=True),
        ]
        
        return SectionData(
            section_id="TEST001",
            measurement_date=datetime.now(),
            measuring_points=points,
        )

    @pytest.fixture
    def triangular_section(self):
        """创建一个三角形断面（用于验证计算）"""
        # 三角形断面：左岸0-10m水深从0到2m，右岸10-20m从2m到0
        # 流速在中间最大
        points = [
            MeasuringPoint(id=1, distance_from_left=0.0, water_depth=0.0, velocity=0.0, is_edge=True),
            MeasuringPoint(id=2, distance_from_left=5.0, water_depth=1.0, velocity=0.5),
            MeasuringPoint(id=3, distance_from_left=10.0, water_depth=2.0, velocity=1.0),
            MeasuringPoint(id=4, distance_from_left=15.0, water_depth=1.0, velocity=0.5),
            MeasuringPoint(id=5, distance_from_left=20.0, water_depth=0.0, velocity=0.0, is_edge=True),
        ]
        
        return SectionData(
            section_id="TEST002",
            measurement_date=datetime.now(),
            measuring_points=points,
        )

    def test_calculate_midpoint_simple(self, simple_section):
        """测试中垂线法计算"""
        calculator = FlowCalculator(method=FlowMethod.MIDPOINT)
        result = calculator.calculate(simple_section, include_uncertainty=False)
        
        # 中垂线法：
        # 测点1的分段：0-5m，水深1.0m，流速0.0 → 流量0
        # 测点2的分段：5-15m，水深2.0m，流速1.0 → 流量=10*2*1=20
        # 测点3的分段：15-20m，水深1.0m，流速0.0 → 流量0
        # 总流量应为20 m³/s
        
        assert result.total_discharge == pytest.approx(20.0, rel=1e-6)
        # 总面积：5*1 + 10*2 + 5*1 = 5 + 20 + 5 = 30
        assert result.total_area == pytest.approx(30.0, rel=1e-6)
        # 平均流速：20 / 30 = 0.666...
        assert result.average_velocity == pytest.approx(20.0 / 30.0, rel=1e-6)

    def test_calculate_trapezoidal_simple(self, simple_section):
        """测试梯形法计算"""
        calculator = FlowCalculator(method=FlowMethod.TRAPEZOIDAL)
        result = calculator.calculate(simple_section, include_uncertainty=False)
        
        # 梯形法：
        # 分段1-2：间距10m，平均水深(1+2)/2=1.5m，平均流速(0+1)/2=0.5
        # 流量 = 10 * 1.5 * 0.5 = 7.5
        # 分段2-3：间距10m，平均水深(2+1)/2=1.5m，平均流速(1+0)/2=0.5
        # 流量 = 10 * 1.5 * 0.5 = 7.5
        # 总流量 = 15 m³/s
        
        assert result.total_discharge == pytest.approx(15.0, rel=1e-6)
        # 总面积：10*1.5 + 10*1.5 = 30
        assert result.total_area == pytest.approx(30.0, rel=1e-6)

    def test_method_difference(self, simple_section):
        """测试两种方法的差异"""
        # 对于简单断面，中垂线法和梯形法应该有差异
        calc_mid = FlowCalculator(method=FlowMethod.MIDPOINT)
        calc_trap = FlowCalculator(method=FlowMethod.TRAPEZOIDAL)
        
        result_mid = calc_mid.calculate(simple_section, include_uncertainty=False)
        result_trap = calc_trap.calculate(simple_section, include_uncertainty=False)
        
        # 中垂线法结果应该大于梯形法（在这个特定情况下）
        assert result_mid.total_discharge > result_trap.total_discharge

    def test_calculate_with_calibration(self, simple_section):
        """测试应用校准系数"""
        calibration = CalibrationRecord(
            instrument_id="TEST",
            instrument_type="ADCP",
            calibration_date=datetime.now(),
            calibration_factor=1.1,
            offset=0.0,
        )
        
        calculator = FlowCalculator(method=FlowMethod.MIDPOINT)
        result = calculator.calculate(simple_section, calibration=calibration, include_uncertainty=False)
        
        # 校准系数1.1，所以流量应该是原来的1.1倍
        # 无校准时流量是20，校准后应该是22
        assert result.total_discharge == pytest.approx(22.0, rel=1e-6)

    def test_uncertainty_calculation(self, simple_section):
        """测试不确定度计算"""
        calculator = FlowCalculator(method=FlowMethod.MIDPOINT)
        result = calculator.calculate(simple_section, include_uncertainty=True)
        
        assert result.uncertainty is not None
        assert result.uncertainty.combined_uncertainty > 0
        assert result.uncertainty.relative_uncertainty > 0
        assert result.uncertainty.expanded_uncertainty > 0
        # 扩展不确定度应该是合成不确定度的2倍（k=2）
        assert result.uncertainty.expanded_uncertainty == pytest.approx(
            result.uncertainty.combined_uncertainty * 2.0,
            rel=1e-6
        )

    def test_uncertainty_source_components(self, simple_section):
        """测试不确定度来源分量"""
        calculator = FlowCalculator(method=FlowMethod.MIDPOINT)
        result = calculator.calculate(simple_section, include_uncertainty=True)
        
        # 应该有多个不确定度来源
        assert len(result.uncertainty.source_uncertainties) > 0
        
        # 检查是否包含主要来源
        sources = [s.source for s in result.uncertainty.source_uncertainties]
        assert "水深测量" in sources
        assert "流速测量" in sources
        assert "间距测量" in sources
        assert "仪器校准" in sources
        assert "计算方法" in sources

    def test_edge_velocity_zero(self, simple_section):
        """测试边缘点流速设为零"""
        # 默认情况下边缘点流速应该设为零
        calculator = FlowCalculator(method=FlowMethod.MIDPOINT, zero_velocity_at_edge=True)
        result = calculator.calculate(simple_section, include_uncertainty=False)
        
        # 边缘点流速为零，所以分段1和3的流量为零
        assert result.total_discharge == pytest.approx(20.0, rel=1e-6)

    def test_imperial_to_metric_conversion(self):
        """测试英制单位到公制的转换"""
        # 创建英制单位的断面
        points = [
            MeasuringPoint(id=1, distance_from_left=0.0, water_depth=3.28084, velocity=0.0, is_edge=True),  # 1米 = 3.28084英尺
            MeasuringPoint(id=2, distance_from_left=32.8084, water_depth=6.56168, velocity=3.28084),  # 10m, 2m, 1m/s
            MeasuringPoint(id=3, distance_from_left=65.6168, water_depth=3.28084, velocity=0.0, is_edge=True),
        ]
        
        section = SectionData(
            section_id="TEST_IMPERIAL",
            measurement_date=datetime.now(),
            measuring_points=points,
            unit=UnitType.IMPERIAL,
        )
        
        calculator = FlowCalculator(method=FlowMethod.MIDPOINT)
        result = calculator.calculate(section, include_uncertainty=False)
        
        # 转换后应该和公制的simple_section结果相同（20 m³/s）
        assert result.total_discharge == pytest.approx(20.0, rel=1e-3)


class TestMethodComparison:
    """测试方法比较器"""

    @pytest.fixture
    def sample_section(self):
        """创建一个示例断面"""
        points = [
            MeasuringPoint(id=1, distance_from_left=0.0, water_depth=0.5, velocity=0.0, is_edge=True),
            MeasuringPoint(id=2, distance_from_left=10.0, water_depth=1.5, velocity=0.8),
            MeasuringPoint(id=3, distance_from_left=20.0, water_depth=2.5, velocity=1.2),
            MeasuringPoint(id=4, distance_from_left=30.0, water_depth=3.0, velocity=1.5),
            MeasuringPoint(id=5, distance_from_left=40.0, water_depth=2.0, velocity=1.0),
            MeasuringPoint(id=6, distance_from_left=50.0, water_depth=1.0, velocity=0.5),
            MeasuringPoint(id=7, distance_from_left=60.0, water_depth=0.5, velocity=0.0, is_edge=True),
        ]
        
        return SectionData(
            section_id="TEST_COMPARE",
            measurement_date=datetime.now(),
            measuring_points=points,
        )

    def test_compare_methods(self, sample_section):
        """测试比较两种方法"""
        result_mid, result_trap, comparison = MethodComparison.compare_methods(sample_section)
        
        # 验证返回了两个结果
        assert result_mid.method == FlowMethod.MIDPOINT
        assert result_trap.method == FlowMethod.TRAPEZOIDAL
        
        # 验证比较统计
        assert "discharge_difference" in comparison
        assert "discharge_relative_difference_percent" in comparison
        assert "area_difference" in comparison
        
        # 差异百分比应该是合理的（通常在10%以内）
        assert comparison["discharge_relative_difference_percent"] < 20.0

    def test_both_methods_produce_valid_results(self, sample_section):
        """测试两种方法都产生有效结果"""
        result_mid, result_trap, _ = MethodComparison.compare_methods(sample_section)
        
        # 两个结果都应该有正的流量
        assert result_mid.total_discharge > 0
        assert result_trap.total_discharge > 0
        
        # 两个结果都应该有正的面积
        assert result_mid.total_area > 0
        assert result_trap.total_area > 0
        
        # 两个结果都应该有正的平均流速
        assert result_mid.average_velocity > 0
        assert result_trap.average_velocity > 0
