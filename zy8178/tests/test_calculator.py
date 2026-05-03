"""测试核心计算模块"""

import pytest
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rail_freight_checker.calculator import (
    LoadingCalculator, Vehicle, Cargo, RuleConfig,
    Issue, IssueLevel
)
from rail_freight_checker.utils import parse_weight, parse_length


class TestUnitConversion:
    """测试单位转换功能"""
    
    def test_parse_weight_kg(self):
        """测试解析kg单位"""
        weight, unit = parse_weight("1000kg")
        assert weight == 1000.0
        assert unit == "kg"
    
    def test_parse_weight_t(self):
        """测试解析t单位"""
        weight, unit = parse_weight("5t")
        assert weight == 5000.0
        assert unit == "t"
    
    def test_parse_weight_ton(self):
        """测试解析吨单位"""
        weight, unit = parse_weight("3吨")
        assert weight == 3000.0
        assert unit == "t"
    
    def test_parse_weight_numeric(self):
        """测试解析数字（默认kg）"""
        weight, unit = parse_weight(2000)
        assert weight == 2000.0
        assert unit == "kg"
    
    def test_parse_weight_with_space(self):
        """测试带空格的重量字符串"""
        weight, unit = parse_weight("2.5 t")
        assert weight == 2500.0
        assert unit == "t"
    
    def test_parse_length_mm(self):
        """测试解析mm单位"""
        length, unit = parse_length("1000mm")
        assert length == 1000.0
        assert unit == "mm"
    
    def test_parse_length_cm(self):
        """测试解析cm单位"""
        length, unit = parse_length("100cm")
        assert length == 1000.0
        assert unit == "cm"
    
    def test_parse_length_m(self):
        """测试解析m单位"""
        length, unit = parse_length("1.5m")
        assert length == 1500.0
        assert unit == "m"


class TestWeightCalculation:
    """测试重量计算功能"""
    
    @pytest.fixture
    def standard_vehicle(self):
        """标准测试车辆"""
        return Vehicle(
            id="test_001",
            type="敞车",
            tare_weight=23800.0,  # 23.8t
            max_load_weight=70000.0,  # 70t
            length=13000.0,
            width=3140.0,
            height_limit=4800.0,
            axle_count=4,
            wheelbase=1830.0,
            center_of_gravity_x=6500.0
        )
    
    @pytest.fixture
    def standard_rules(self):
        """标准测试规则"""
        return RuleConfig(
            max_longitudinal_offset=100.0,
            max_lateral_offset=50.0,
            min_dangerous_goods_distance=1000.0,
            axle_weight_tolerance=0.05,
            over_weight_warning_threshold=0.9,
            over_weight_error_threshold=1.0,
            height_limit_tolerance=0.0,
            width_limit_tolerance=0.0
        )
    
    def test_normal_weight(self, standard_vehicle, standard_rules):
        """测试正常重量装载"""
        cargos = [
            Cargo(
                id="c1",
                name="货物1",
                weight=30000.0,  # 30t
                length=2000.0,
                width=1500.0,
                height=1800.0,
                x_position=5500.0,  # 中心位置附近
                y_position=0.0,
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        assert result.cargo_weight == 30000.0
        assert result.total_weight == 23800.0 + 30000.0
        assert result.weight_utilization == (30000.0 / 70000.0) * 100
        
        # 检查是否有错误问题
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR]
        assert len(errors) == 0
    
    def test_mixed_units_weight(self, standard_vehicle, standard_rules):
        """测试混用kg/t单位的重量计算"""
        # 这里测试parse_weight解析不同单位后，计算是否正确
        cargos = [
            Cargo(
                id="c1",
                name="货物1(t)",
                weight=5000.0,  # 5t
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=2000.0,
                y_position=0.0,
                z_position=0.0
            ),
            Cargo(
                id="c2",
                name="货物2(kg)",
                weight=20000.0,  # 20000kg = 20t
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=6000.0,
                y_position=0.0,
                z_position=0.0
            ),
            Cargo(
                id="c3",
                name="货物3(吨)",
                weight=3000.0,  # 3吨
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=10000.0,
                y_position=0.0,
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 总重量应该是 5t + 20t + 3t = 28t = 28000kg
        assert result.cargo_weight == 28000.0
    
    def test_over_weight_warning(self, standard_vehicle, standard_rules):
        """测试超重警告（超过90%但未超过100%）"""
        # 65t，超过90%（63t）但未超过100%（70t）
        cargos = [
            Cargo(
                id="c1",
                name="超重货物",
                weight=65000.0,  # 65t
                length=5000.0,
                width=3000.0,
                height=2000.0,
                x_position=4000.0,
                y_position=0.0,
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有警告
        warnings = [i for i in result.issues if i.level == IssueLevel.WARNING and i.category == "weight"]
        assert len(warnings) == 1
        
        # 检查是否有错误（不应该有，因为未超过100%）
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "weight"]
        assert len(errors) == 0
    
    def test_over_weight_error(self, standard_vehicle, standard_rules):
        """测试超重错误（超过100%）"""
        # 80t，超过限重70t
        cargos = [
            Cargo(
                id="c1",
                name="严重超重货物",
                weight=80000.0,  # 80t
                length=5000.0,
                width=3000.0,
                height=2000.0,
                x_position=4000.0,
                y_position=0.0,
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有错误
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "weight"]
        assert len(errors) == 1


class TestCenterOfGravity:
    """测试重心偏移计算"""
    
    @pytest.fixture
    def standard_vehicle(self):
        return Vehicle(
            id="test_001",
            type="敞车",
            tare_weight=23800.0,
            max_load_weight=70000.0,
            length=13000.0,  # 中心在6500mm
            width=3140.0,
            height_limit=4800.0,
            axle_count=4,
            wheelbase=1830.0,
            center_of_gravity_x=6500.0  # 自身重心在中心
        )
    
    @pytest.fixture
    def standard_rules(self):
        return RuleConfig(
            max_longitudinal_offset=100.0,
            max_lateral_offset=50.0,
            min_dangerous_goods_distance=1000.0,
            axle_weight_tolerance=0.05,
            over_weight_warning_threshold=0.9,
            over_weight_error_threshold=1.0,
            height_limit_tolerance=0.0,
            width_limit_tolerance=0.0
        )
    
    def test_centered_cargo(self, standard_vehicle, standard_rules):
        """测试中心装载的货物"""
        cargos = [
            Cargo(
                id="c1",
                name="中心货物",
                weight=10000.0,
                length=2000.0,
                width=1500.0,
                height=1500.0,
                x_position=5500.0,  # 货物中心在 5500 + 1000 = 6500mm（车辆中心）
                y_position=0.0,
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 纵向偏移应该很小（接近0）
        assert abs(result.longitudinal_offset) < 10.0  # 允许小的计算误差
        assert abs(result.lateral_offset) < 10.0
        
        # 检查是否有错误
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "center_of_gravity"]
        assert len(errors) == 0
    
    def test_lateral_offset_error(self, standard_vehicle, standard_rules):
        """测试横向重心偏移超标"""
        # 使用较重的货物，使得综合重心偏移超过限制
        # 车辆自重23800kg，货物60000kg，横向位置200mm
        # 综合重心 = (60000 * 200) / (23800 + 60000) ≈ 143mm > 50mm
        cargos = [
            Cargo(
                id="c1",
                name="偏右货物",
                weight=60000.0,  # 较重的货物
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=6000.0,
                y_position=200.0,  # 横向位置200mm
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查横向偏移
        assert result.lateral_offset > 50.0
        
        # 检查是否有错误
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "center_of_gravity"]
        assert len(errors) == 1
        assert "横向" in errors[0].message


class TestMissingDimensions:
    """测试缺少货物尺寸的情况"""
    
    @pytest.fixture
    def standard_vehicle(self):
        return Vehicle(
            id="test_001",
            type="敞车",
            tare_weight=23800.0,
            max_load_weight=70000.0,
            length=13000.0,
            width=3140.0,
            height_limit=4800.0,
            axle_count=4,
            wheelbase=1830.0,
            center_of_gravity_x=6500.0
        )
    
    @pytest.fixture
    def standard_rules(self):
        return RuleConfig(
            max_longitudinal_offset=100.0,
            max_lateral_offset=50.0,
            min_dangerous_goods_distance=1000.0,
            axle_weight_tolerance=0.05,
            over_weight_warning_threshold=0.9,
            over_weight_error_threshold=1.0,
            height_limit_tolerance=0.0,
            width_limit_tolerance=0.0
        )
    
    def test_missing_all_dimensions(self, standard_vehicle, standard_rules):
        """测试缺少所有尺寸的货物"""
        cargos = [
            Cargo(
                id="c1",
                name="无尺寸货物",
                weight=5000.0,
                length=0.0,  # 缺少长度
                width=0.0,   # 缺少宽度
                height=0.0,  # 缺少高度
                x_position=5000.0,
                y_position=0.0,
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有警告
        warnings = [i for i in result.issues if i.level == IssueLevel.WARNING and i.category == "cargo_data"]
        assert len(warnings) == 1
        assert "缺少尺寸信息" in warnings[0].message
        assert "长度" in warnings[0].message
        assert "宽度" in warnings[0].message
        assert "高度" in warnings[0].message
    
    def test_missing_some_dimensions(self, standard_vehicle, standard_rules):
        """测试缺少部分尺寸的货物"""
        cargos = [
            Cargo(
                id="c1",
                name="部分尺寸货物",
                weight=5000.0,
                length=2000.0,  # 有长度
                width=0.0,       # 缺少宽度
                height=1500.0,   # 有高度
                x_position=5000.0,
                y_position=0.0,
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有警告
        warnings = [i for i in result.issues if i.level == IssueLevel.WARNING and i.category == "cargo_data"]
        assert len(warnings) == 1
        assert "缺少尺寸信息" in warnings[0].message
        assert "宽度" in warnings[0].message
        assert "长度" not in warnings[0].message  # 不应该包含长度
        assert "高度" not in warnings[0].message  # 不应该包含高度


class TestDangerousGoodsIsolation:
    """测试危险品隔离检查"""
    
    @pytest.fixture
    def standard_vehicle(self):
        return Vehicle(
            id="test_001",
            type="敞车",
            tare_weight=23800.0,
            max_load_weight=70000.0,
            length=13000.0,
            width=3140.0,
            height_limit=4800.0,
            axle_count=4,
            wheelbase=1830.0,
            center_of_gravity_x=6500.0
        )
    
    @pytest.fixture
    def standard_rules(self):
        return RuleConfig(
            max_longitudinal_offset=100.0,
            max_lateral_offset=50.0,
            min_dangerous_goods_distance=1000.0,  # 要求最小1000mm
            axle_weight_tolerance=0.05,
            over_weight_warning_threshold=0.9,
            over_weight_error_threshold=1.0,
            height_limit_tolerance=0.0,
            width_limit_tolerance=0.0
        )
    
    def test_dangerous_goods_sufficient_distance(self, standard_vehicle, standard_rules):
        """测试危险品隔离距离足够"""
        cargos = [
            Cargo(
                id="c1",
                name="易燃液体",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=2000.0,  # 中心在 2000 + 500 = 2500mm
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="易燃液体",
                dangerous_class="3"
            ),
            Cargo(
                id="c2",
                name="氧化剂",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=5000.0,  # 中心在 5000 + 500 = 5500mm
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="氧化剂",
                dangerous_class="5.1"
            )
        ]
        
        # 距离：5500 - 2500 = 3000mm > 1000mm，应该没问题
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有危险品隔离错误
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "dangerous_goods"]
        assert len(errors) == 0
    
    def test_dangerous_goods_insufficient_distance(self, standard_vehicle, standard_rules):
        """测试危险品隔离距离不足"""
        cargos = [
            Cargo(
                id="c1",
                name="易燃液体",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=8000.0,  # 中心在 8000 + 500 = 8500mm
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="易燃液体",
                dangerous_class="3"
            ),
            Cargo(
                id="c2",
                name="氧化剂",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=8500.0,  # 中心在 8500 + 500 = 9000mm
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="氧化剂",
                dangerous_class="5.1"
            )
        ]
        
        # 距离：9000 - 8500 = 500mm < 1000mm，应该报错
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有危险品隔离错误
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "dangerous_goods"]
        assert len(errors) == 1
        assert "隔离距离不足" in errors[0].message
    
    def test_same_category_dangerous_goods(self, standard_vehicle, standard_rules):
        """测试同一类别的危险品（不需要隔离）"""
        cargos = [
            Cargo(
                id="c1",
                name="易燃液体A",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=5000.0,
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="易燃液体",
                dangerous_class="3"
            ),
            Cargo(
                id="c2",
                name="易燃液体B",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=5500.0,  # 距离很近
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="易燃液体",  # 同一类别
                dangerous_class="3"
            )
        ]
        
        # 同一类别的危险品，即使距离近也不应该报错
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有危险品隔离错误（不应该有）
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "dangerous_goods"]
        assert len(errors) == 0
    
    def test_single_dangerous_goods(self, standard_vehicle, standard_rules):
        """测试只有一件危险品（不需要检查隔离）"""
        cargos = [
            Cargo(
                id="c1",
                name="易燃液体",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=5000.0,
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="易燃液体",
                dangerous_class="3"
            ),
            Cargo(
                id="c2",
                name="普通货物",
                weight=5000.0,
                length=2000.0,
                width=1500.0,
                height=1500.0,
                x_position=7000.0,
                y_position=0.0,
                z_position=0.0,
                is_dangerous=False  # 非危险品
            )
        ]
        
        # 只有一件危险品，不应该检查隔离
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有危险品隔离错误（不应该有）
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "dangerous_goods"]
        assert len(errors) == 0


class TestClearance:
    """测试限界检查"""
    
    @pytest.fixture
    def standard_vehicle(self):
        return Vehicle(
            id="test_001",
            type="敞车",
            tare_weight=23800.0,
            max_load_weight=70000.0,
            length=13000.0,
            width=3140.0,  # 半宽1570mm
            height_limit=4800.0,
            axle_count=4,
            wheelbase=1830.0,
            center_of_gravity_x=6500.0
        )
    
    @pytest.fixture
    def standard_rules(self):
        return RuleConfig(
            max_longitudinal_offset=100.0,
            max_lateral_offset=50.0,
            min_dangerous_goods_distance=1000.0,
            axle_weight_tolerance=0.05,
            over_weight_warning_threshold=0.9,
            over_weight_error_threshold=1.0,
            height_limit_tolerance=0.0,
            width_limit_tolerance=0.0
        )
    
    def test_height_exceed(self, standard_vehicle, standard_rules):
        """测试高度超标"""
        cargos = [
            Cargo(
                id="c1",
                name="超高货物",
                weight=5000.0,
                length=2000.0,
                width=1500.0,
                height=5000.0,  # 高度5000mm > 4800mm限制
                x_position=5000.0,
                y_position=0.0,
                z_position=0.0  # 从地板开始
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有限界错误
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "clearance"]
        assert len(errors) == 1
        assert "高度" in errors[0].message
    
    def test_width_exceed(self, standard_vehicle, standard_rules):
        """测试宽度超标"""
        cargos = [
            Cargo(
                id="c1",
                name="超宽货物",
                weight=5000.0,
                length=2000.0,
                width=3500.0,  # 宽度3500mm > 3140mm限制（半宽1750mm > 1570mm）
                height=2000.0,
                x_position=5000.0,
                y_position=0.0,  # 居中放置
                z_position=0.0
            )
        ]
        
        calculator = LoadingCalculator(standard_vehicle, cargos, standard_rules)
        result = calculator.calculate()
        
        # 检查是否有限界错误
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "clearance"]
        assert len(errors) == 1
        assert "宽度" in errors[0].message


class TestIntegration:
    """集成测试"""
    
    @pytest.fixture
    def sample_vehicle(self):
        return Vehicle(
            id="C70_001",
            type="敞车C70",
            tare_weight=23800.0,  # 23.8t
            max_load_weight=70000.0,  # 70t
            length=13000.0,
            width=3140.0,
            height_limit=4800.0,
            axle_count=4,
            wheelbase=1830.0,
            center_of_gravity_x=6500.0
        )
    
    @pytest.fixture
    def sample_rules(self):
        return RuleConfig(
            max_longitudinal_offset=100.0,
            max_lateral_offset=50.0,
            min_dangerous_goods_distance=1000.0,
            axle_weight_tolerance=0.05,
            over_weight_warning_threshold=0.9,
            over_weight_error_threshold=1.0,
            height_limit_tolerance=0.0,
            width_limit_tolerance=0.0
        )
    
    def test_normal_loading_scenario(self, sample_vehicle, sample_rules):
        """测试正常装载场景"""
        cargos = [
            Cargo(
                id="c1",
                name="机械设备",
                weight=20000.0,  # 20t
                length=3000.0,
                width=2000.0,
                height=2000.0,
                x_position=5000.0,  # 中心在 5000 + 1500 = 6500mm（车辆中心）
                y_position=0.0,
                z_position=0.0,
                is_dangerous=False
            )
        ]
        
        calculator = LoadingCalculator(sample_vehicle, cargos, sample_rules)
        result = calculator.calculate()
        
        # 检查基本计算
        assert result.cargo_weight == 20000.0
        assert result.total_weight == 23800.0 + 20000.0
        
        # 检查问题数量（应该没有错误）
        errors = [i for i in result.issues if i.level == IssueLevel.ERROR]
        assert len(errors) == 0
    
    def test_multiple_issues_scenario(self, sample_vehicle, sample_rules):
        """测试存在多个问题的场景"""
        cargos = [
            # 超重货物（80t > 70t）
            Cargo(
                id="c1",
                name="超重货物",
                weight=80000.0,  # 80t
                length=5000.0,
                width=3000.0,
                height=2500.0,
                x_position=4000.0,
                y_position=0.0,
                z_position=0.0,
                is_dangerous=False
            ),
            # 缺少尺寸的货物
            Cargo(
                id="c2",
                name="无尺寸货物",
                weight=1000.0,
                length=0.0,
                width=0.0,
                height=0.0,
                x_position=10000.0,
                y_position=0.0,
                z_position=0.0,
                is_dangerous=False
            ),
            # 两个隔离不足的危险品
            Cargo(
                id="c3",
                name="易燃液体",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=2000.0,
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="易燃液体"
            ),
            Cargo(
                id="c4",
                name="氧化剂",
                weight=1000.0,
                length=1000.0,
                width=1000.0,
                height=1000.0,
                x_position=2500.0,  # 距离只有约500mm
                y_position=0.0,
                z_position=0.0,
                is_dangerous=True,
                dangerous_category="氧化剂"
            )
        ]
        
        calculator = LoadingCalculator(sample_vehicle, cargos, sample_rules)
        result = calculator.calculate()
        
        # 检查问题
        weight_errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "weight"]
        dangerous_errors = [i for i in result.issues if i.level == IssueLevel.ERROR and i.category == "dangerous_goods"]
        dimension_warnings = [i for i in result.issues if i.level == IssueLevel.WARNING and i.category == "cargo_data"]
        
        assert len(weight_errors) == 1  # 超重错误
        assert len(dangerous_errors) == 1  # 危险品隔离错误
        assert len(dimension_warnings) == 1  # 缺少尺寸警告
